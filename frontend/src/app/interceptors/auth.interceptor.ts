import { Injectable, inject } from '@angular/core';
import {
  HttpEvent,
  HttpInterceptor,
  HttpHandler,
  HttpRequest,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth';
import { Router } from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private authService = inject(AuthService);
  private router = inject(Router);
  private cerrandoSesionPorConexion = false;

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
      catchError((error: HttpErrorResponse) => {
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
          if (!this.cerrandoSesionPorConexion) {
            this.cerrandoSesionPorConexion = true;
            console.warn(`[AuthInterceptor] Sin acceso al servidor/BD (status ${error.status}) - cerrando sesión`);
            this.authService.logout();
            this.router.navigate(['/login'], { queryParams: { motivo: 'sin_conexion' } });
            setTimeout(() => { this.cerrandoSesionPorConexion = false; }, 3000);
          }
        }
        return throwError(() => error);
      })
    );
  }
}
