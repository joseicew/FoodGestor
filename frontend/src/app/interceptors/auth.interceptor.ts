import { Injectable, inject } from '@angular/core';
import {
  HttpEvent,
  HttpInterceptor,
  HttpHandler,
  HttpRequest,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError, timer } from 'rxjs';
import { catchError, retry, tap } from 'rxjs/operators';
import { AuthService } from '../services/auth';
import { ServerWakeupService } from '../services/server-wakeup';
import { Router } from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private authService = inject(AuthService);
  private router = inject(Router);
  private serverWakeup = inject(ServerWakeupService);
  private cerrandoSesionPorConexion = false;

  // Nº de fallos de red/BD consecutivos antes de forzar el cierre de sesión.
  // En redes móviles/VPN un parpadeo aislado (status 0) es normal y se
  // recupera solo; forzar logout+borrado de caché en el primer fallo dejaba
  // pantallas vacías (p.ej. Raciones) tras un simple hipo de conexión.
  private readonly UMBRAL_FALLOS_CONEXION = 3;
  private fallosConsecutivos = 0;

  // El plan gratuito de Render duerme el backend tras ~15 min sin trafico;
  // la primera peticion tras despertar puede tardar 30-50s y mientras tanto
  // llega como status 0 (conexion rechazada o preflight de CORS bloqueado,
  // ya que el error real no tiene cabeceras CORS). Solo tiene sentido
  // reintentar ese caso: un 401/404/500 significa que el servidor SI
  // respondio, y reintentar ahi no arreglaria nada.
  private readonly REINTENTOS_DESPERTAR = 8;
  private readonly INTERVALO_REINTENTO_MS = 5000;

  constructor() {
    console.log('[AuthInterceptor] Inicializado');
  }

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // NO agregar autenticación a archivos estáticos
    const esArchivoEstatico = /\.(json|js|css|ico|png|svg|woff|woff2)$/.test(request.url);

    if (esArchivoEstatico) {
      console.log(`[AuthInterceptor] Saltando autenticación para: ${request.url}`);
      return next.handle(request);
    }

    // Obtener el token
    const token = this.authService.obtenerToken();

    console.log(`[AuthInterceptor] Request a: ${request.url}`);
    console.log(`[AuthInterceptor] Token disponible: ${!!token}`);

    // Si existe token, agregarlo a la request (solo para APIs)
    if (token) {
      console.log(`[AuthInterceptor] Agregando token al header`);
      request = request.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    } else {
      console.log(`[AuthInterceptor] ⚠️ No hay token disponible`);
    }

    return next.handle(request).pipe(
      retry({
        count: this.REINTENTOS_DESPERTAR,
        delay: (error: HttpErrorResponse, intento: number) => {
          if (error.status !== 0) {
            return throwError(() => error);
          }
          this.serverWakeup.marcarDespertando();
          console.warn(`[AuthInterceptor] Sin respuesta (posible cold start de Render), reintento ${intento}/${this.REINTENTOS_DESPERTAR}...`);
          return timer(this.INTERVALO_REINTENTO_MS);
        }
      }),
      tap(() => {
        this.fallosConsecutivos = 0;
        this.serverWakeup.marcarListo();
      }),
      catchError((error: HttpErrorResponse) => {
        this.serverWakeup.marcarListo();
        console.error(`[AuthInterceptor] Error ${error.status}:`, error.error);

        // Si recibimos 401 (no autorizado), limpiar token y redirigir a login
        if (error.status === 401) {
          console.warn(`[AuthInterceptor] 401 Unauthorized - logout y redirigiendo a login`);
          this.authService.logout();
          this.router.navigate(['/login']);
        } else if (token && (error.status === 0 || error.status >= 500)) {
          // Backend/BD inaccesible en una sesión ya autenticada: forzar logout
          // para evitar que la app siga operando con datos a medias o errores
          // en cascada. status 0 = sin red/servidor caído; 5xx = fallo del backend
          // (normalmente la conexión a la base de datos, ver errorhandler global).
          // Solo se dispara tras varios fallos consecutivos: en redes móviles/VPN
          // un único parpadeo (status 0) es normal y no debe tirar la sesión ni
          // vaciar la caché local.
          this.fallosConsecutivos++;
          if (this.fallosConsecutivos >= this.UMBRAL_FALLOS_CONEXION && !this.cerrandoSesionPorConexion) {
            this.cerrandoSesionPorConexion = true;
            console.warn(`[AuthInterceptor] Sin acceso al servidor/BD tras ${this.fallosConsecutivos} fallos (status ${error.status}) - cerrando sesión`);
            this.authService.logout();
            this.router.navigate(['/login'], { queryParams: { motivo: 'sin_conexion' } });
            this.fallosConsecutivos = 0;
            setTimeout(() => { this.cerrandoSesionPorConexion = false; }, 3000);
          }
        }
        return throwError(() => error);
      })
    );
  }
}
