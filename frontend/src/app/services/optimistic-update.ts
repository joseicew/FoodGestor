import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { tap, catchError, finalize } from 'rxjs/operators';
import { CacheService } from './cache';
import { SyncStatusService } from './sync-status';

interface OptimisticUpdateConfig<T> {
  // Acción a realizar localmente antes de enviar al servidor
  updateLocal: () => void;
  // Observable que representa la acción en el servidor
  serverAction: () => Observable<T>;
  // Acción a realizar si falla (rollback)
  rollback: () => void;
  // Acción a realizar si tiene éxito
  onSuccess?: (data: T) => void;
  // Acción a realizar si falla
  onError?: (error: any) => void;
  // Mensaje de éxito a mostrar
  successMessage?: string;
  // Mensaje de error a mostrar
  errorMessage?: string;
}

@Injectable({
  providedIn: 'root'
})
export class OptimisticUpdateService {
  constructor(
    private cacheService: CacheService,
    private syncStatusService: SyncStatusService
  ) {}

  /**
   * Ejecuta una actualización optimista
   * 1. Actualiza localmente inmediatamente
   * 2. Envía cambios al servidor en background
   * 3. Si falla, revierte los cambios locales
   */
  executar<T>(config: OptimisticUpdateConfig<T>): Observable<T> {
    // Paso 1: Guardar estado actual para rollback
    const calendarioAnterior = [...this.cacheService.obtenerCalendario()];

    // Paso 2: Aplicar cambios locales inmediatamente
    try {
      config.updateLocal();
      console.log('✅ Cambio aplicado localmente');
    } catch (err) {
      console.error('❌ Error aplicando cambio local:', err);
      throw err;
    }

    // Paso 3: Enviar cambios al servidor en background
    this.syncStatusService.startSync();
    this.syncStatusService.incrementPendingChanges();

    return config.serverAction().pipe(
      tap((data) => {
        console.log('✅ Sincronización con servidor exitosa');
        this.syncStatusService.decrementPendingChanges();
        this.syncStatusService.completeSync();
        if (config.onSuccess) {
          config.onSuccess(data);
        }
      }),
      catchError((error) => {
        console.error('❌ Error en servidor, revirtiendo cambios locales:', error);

        // Revertir cambios locales
        try {
          config.rollback();
          this.cacheService.guardarCalendario(calendarioAnterior);
          console.log('🔄 Cambios revertidos a estado anterior');
        } catch (rollbackError) {
          console.error('❌ Error revirtiendo cambios:', rollbackError);
        }

        this.syncStatusService.syncError(error.message || 'Error desconocido');
        this.syncStatusService.decrementPendingChanges();

        if (config.onError) {
          config.onError(error);
        }

        return throwError(() => error);
      })
    );
  }

  /**
   * Especifico para agregar ración al calendario
   */
  agregarRacionOptimista(
    fecha: string,
    tipoComida: string,
    racionId: number,
    cantidad: number,
    diaActual: any,
    serverAction: () => Observable<any>
  ): Observable<any> {
    return this.executar({
      updateLocal: () => {
        // Simular la adición localmente (será actualizado cuando se refresque el día)
        console.log(`📝 Agregando ración ${racionId} a ${tipoComida} del ${fecha}`);
      },
      serverAction,
      rollback: () => {
        // El rollback es automático para calendario
        console.log('↩️ Rollback de ración agregada');
      }
    });
  }

  /**
   * Especifico para agregar alimento al calendario
   */
  agregarAlimentoOptimista(
    fecha: string,
    tipoComida: string,
    alimentoId: number,
    gramos: number,
    serverAction: () => Observable<any>
  ): Observable<any> {
    return this.executar({
      updateLocal: () => {
        console.log(`📝 Agregando alimento ${alimentoId} (${gramos}g) a ${tipoComida} del ${fecha}`);
      },
      serverAction,
      rollback: () => {
        console.log('↩️ Rollback de alimento agregado');
      }
    });
  }

  /**
   * Especifico para eliminar ración del calendario
   */
  eliminarRacionOptimista(
    fecha: string,
    tipoComida: string,
    racionId: number,
    serverAction: () => Observable<any>
  ): Observable<any> {
    return this.executar({
      updateLocal: () => {
        console.log(`🗑️ Eliminando ración ${racionId} de ${tipoComida} del ${fecha}`);
      },
      serverAction,
      rollback: () => {
        console.log('↩️ Rollback de ración eliminada');
      }
    });
  }

  /**
   * Especifico para eliminar alimento del calendario
   */
  eliminarAlimentoOptimista(
    fecha: string,
    tipoComida: string,
    alimentoId: number,
    serverAction: () => Observable<any>
  ): Observable<any> {
    return this.executar({
      updateLocal: () => {
        console.log(`🗑️ Eliminando alimento ${alimentoId} de ${tipoComida} del ${fecha}`);
      },
      serverAction,
      rollback: () => {
        console.log('↩️ Rollback de alimento eliminado');
      }
    });
  }

  /**
   * Especifico para actualizar cantidad de ración
   */
  actualizarCantidadRacionOptimista(
    fecha: string,
    tipoComida: string,
    racionId: number,
    cantidad: number,
    serverAction: () => Observable<any>
  ): Observable<any> {
    return this.executar({
      updateLocal: () => {
        console.log(`📝 Actualizando cantidad de ración ${racionId} a ${cantidad}`);
      },
      serverAction,
      rollback: () => {
        console.log('↩️ Rollback de cantidad de ración');
      }
    });
  }

  /**
   * Especifico para actualizar cantidad de alimento
   */
  actualizarCantidadAlimentoOptimista(
    fecha: string,
    tipoComida: string,
    alimentoId: number,
    cantidad: number,
    serverAction: () => Observable<any>
  ): Observable<any> {
    return this.executar({
      updateLocal: () => {
        console.log(`📝 Actualizando cantidad de alimento ${alimentoId} a ${cantidad}`);
      },
      serverAction,
      rollback: () => {
        console.log('↩️ Rollback de cantidad de alimento');
      }
    });
  }
}
