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

  constructor() {
    console.log('[AuthInterceptor] Inicializado');
  }

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Obtener el token
    const token = this.authService.obtenerToken();

    console.log(`[AuthInterceptor] Request a: ${request.url}`);
    console.log(`[AuthInterceptor] Token disponible: ${!!token}`);

    // Si existe token, agregarlo a la request
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
        }
        return throwError(() => error);
      })
    );
  }
}
