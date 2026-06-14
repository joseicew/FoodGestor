import { Injectable } from '@angular/core';
import { Observable, throwError, of } from 'rxjs';
import { catchError, timeout, tap } from 'rxjs/operators';
import { CacheService } from './cache';

/**
 * Servicio que proporciona fallback a caché cuando el servidor no responde
 * Útil para cuando hay conexión lenta o servidor está caído
 */
@Injectable({
  providedIn: 'root'
})
export class OfflineFallbackService {
  private readonly REQUEST_TIMEOUT = 5000; // 5 segundos

  constructor(private cacheService: CacheService) {}

  /**
   * Ejecuta una solicitud con fallback a caché
   * Si la solicitud falla o tarda más de 5s, usa datos en caché
   */
  executarConFallback<T>(
    serverRequest: Observable<T>,
    fallbackGetter: () => T | null,
    entityType: 'alimentos' | 'raciones' | 'calendario',
    showOfflineMessage?: () => void
  ): Observable<T> {
    return serverRequest.pipe(
      timeout(this.REQUEST_TIMEOUT),
      tap(() => {
        console.log(`✅ Datos obtenidos del servidor: ${entityType}`);
      }),
      catchError((error) => {
        console.warn(`⚠️ Error en servidor (${entityType}), usando caché:`, error.message);

        const fallbackData = fallbackGetter();

        if (fallbackData !== null) {
          if (showOfflineMessage) {
            showOfflineMessage();
          }
          console.log(`📡 Modo offline: mostrando ${entityType} en caché`);
          return of(fallbackData);
        }

        // Si no hay caché disponible, lanzar el error original
        console.error(`❌ Error crítico: sin conexión y sin caché de ${entityType}`);
        return throwError(() => new Error(`No hay conexión y sin datos en caché para ${entityType}`));
      })
    );
  }

  /**
   * Ejecuta una solicitud con fallback a caché para arrays
   */
  executarConFallbackArray<T>(
    serverRequest: Observable<T[]>,
    fallbackGetter: () => T[],
    entityType: 'alimentos' | 'raciones' | 'calendario',
    showOfflineMessage?: () => void
  ): Observable<T[]> {
    return serverRequest.pipe(
      timeout(this.REQUEST_TIMEOUT),
      tap(() => {
        console.log(`✅ Datos obtenidos del servidor: ${entityType}`);
      }),
      catchError((error) => {
        console.warn(`⚠️ Error en servidor (${entityType}), usando caché:`, error.message);

        const fallbackData = fallbackGetter();

        if (fallbackData && fallbackData.length > 0) {
          if (showOfflineMessage) {
            showOfflineMessage();
          }
          console.log(`📡 Modo offline: mostrando ${fallbackData.length} items de ${entityType}`);
          return of(fallbackData);
        }

        // Si no hay caché disponible, retornar array vacío
        console.warn(`⚠️ Sin caché para ${entityType}, retornando array vacío`);
        if (showOfflineMessage) {
          showOfflineMessage();
        }
        return of([]);
      })
    );
  }

  /**
   * Verifica si estamos en modo offline
   */
  isOfflineMode(): boolean {
    // En el futuro podríamos usar navigator.onLine
    return false;
  }
}
