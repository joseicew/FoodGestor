import { Injectable } from '@angular/core';
import { Observable, Subject, EMPTY, throwError } from 'rxjs';
import { tap, catchError, concatMap } from 'rxjs/operators';
import { CacheService } from './cache';
import { SyncStatusService } from './sync-status';

export interface OperacionEnCola {
  accion: () => Observable<any>;
  enExito?: (data: any) => void;
  enError?: (err: any) => void;
}

interface OptimisticUpdateConfig<T> {
  updateLocal: () => void;
  serverAction: () => Observable<T>;
  rollback: () => void;
  onSuccess?: (data: T) => void;
  onError?: (error: any) => void;
}

@Injectable({
  providedIn: 'root'
})
export class OptimisticUpdateService {

  private cola$ = new Subject<OperacionEnCola>();

  constructor(
    private cacheService: CacheService,
    private syncStatusService: SyncStatusService
  ) {
    // Procesar operaciones de una en una (FIFO)
    this.cola$.pipe(
      concatMap(op =>
        op.accion().pipe(
          tap(data => op.enExito?.(data)),
          catchError(err => {
            op.enError?.(err);
            return EMPTY; // No romper la cola en caso de error
          })
        )
      )
    ).subscribe();
  }

  /** Encola una operación de servidor; se ejecuta cuando la anterior termina */
  encolar(op: OperacionEnCola): void {
    this.cola$.next(op);
  }

  // ── Métodos legacy (usados en otros componentes) ──

  executar<T>(config: OptimisticUpdateConfig<T>): Observable<T> {
    const calendarioAnterior = [...this.cacheService.obtenerCalendario()];
    try {
      config.updateLocal();
    } catch (err) {
      throw err;
    }

    this.syncStatusService.startSync();
    this.syncStatusService.incrementPendingChanges();

    return config.serverAction().pipe(
      tap((data) => {
        this.syncStatusService.decrementPendingChanges();
        this.syncStatusService.completeSync();
        config.onSuccess?.(data);
      }),
      catchError((error) => {
        try {
          config.rollback();
          this.cacheService.guardarCalendario(calendarioAnterior);
        } catch {}
        this.syncStatusService.syncError(error.message || 'Error desconocido');
        this.syncStatusService.decrementPendingChanges();
        config.onError?.(error);
        return throwError(() => error);
      })
    );
  }

  agregarRacionOptimista(
    fecha: string, tipoComida: string, racionId: number, cantidad: number,
    diaActual: any, serverAction: () => Observable<any>
  ): Observable<any> {
    return this.executar({
      updateLocal: () => {},
      serverAction,
      rollback: () => {}
    });
  }

  agregarAlimentoOptimista(
    fecha: string, tipoComida: string, alimentoId: number, gramos: number,
    serverAction: () => Observable<any>
  ): Observable<any> {
    return this.executar({
      updateLocal: () => {},
      serverAction,
      rollback: () => {}
    });
  }

  actualizarCantidadRacionOptimista(
    fecha: string, tipoComida: string, racionId: number, cantidad: number,
    serverAction: () => Observable<any>
  ): Observable<any> {
    return this.executar({
      updateLocal: () => {},
      serverAction,
      rollback: () => {}
    });
  }

  actualizarCantidadAlimentoOptimista(
    fecha: string, tipoComida: string, alimentoId: number, cantidad: number,
    serverAction: () => Observable<any>
  ): Observable<any> {
    return this.executar({
      updateLocal: () => {},
      serverAction,
      rollback: () => {}
    });
  }
}
