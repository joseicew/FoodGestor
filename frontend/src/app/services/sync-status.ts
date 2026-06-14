import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncTime: Date | null;
  pendingChanges: number;
  isOffline: boolean;
  lastError: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class SyncStatusService {
  private statusSubject = new BehaviorSubject<SyncStatus>({
    isSyncing: false,
    lastSyncTime: null,
    pendingChanges: 0,
    isOffline: false,
    lastError: null
  });

  public status$ = this.statusSubject.asObservable();

  constructor() {
    this.initializeNetworkListener();
  }

  /**
   * Inicia sincronización
   */
  startSync(): void {
    const current = this.statusSubject.value;
    this.statusSubject.next({
      ...current,
      isSyncing: true
    });
  }

  /**
   * Completa sincronización exitosamente
   */
  completeSync(): void {
    const current = this.statusSubject.value;
    this.statusSubject.next({
      ...current,
      isSyncing: false,
      lastSyncTime: new Date(),
      lastError: null
    });
  }

  /**
   * Error en sincronización
   */
  syncError(error: string): void {
    const current = this.statusSubject.value;
    this.statusSubject.next({
      ...current,
      isSyncing: false,
      lastError: error
    });
  }

  /**
   * Establece número de cambios pendientes
   */
  setPendingChanges(count: number): void {
    const current = this.statusSubject.value;
    this.statusSubject.next({
      ...current,
      pendingChanges: count
    });
  }

  /**
   * Incrementa cambios pendientes
   */
  incrementPendingChanges(): void {
    const current = this.statusSubject.value;
    this.statusSubject.next({
      ...current,
      pendingChanges: current.pendingChanges + 1
    });
  }

  /**
   * Decrementa cambios pendientes
   */
  decrementPendingChanges(): void {
    const current = this.statusSubject.value;
    const newCount = Math.max(0, current.pendingChanges - 1);
    this.statusSubject.next({
      ...current,
      pendingChanges: newCount
    });
  }

  /**
   * Establece estado offline
   */
  setOfflineMode(offline: boolean): void {
    const current = this.statusSubject.value;
    this.statusSubject.next({
      ...current,
      isOffline: offline,
      lastError: offline ? 'Sin conexión' : null
    });

    if (offline) {
      console.log('📡 Modo offline activado');
    } else {
      console.log('📡 Modo offline desactivado');
    }
  }

  /**
   * Obtiene estado actual
   */
  getCurrentStatus(): SyncStatus {
    return this.statusSubject.value;
  }

  /**
   * Obtiene tiempo transcurrido desde última sincronización
   */
  getTimeSinceLastSync(): string {
    const lastSync = this.statusSubject.value.lastSyncTime;
    if (!lastSync) return 'Nunca';

    const now = new Date();
    const seconds = Math.floor((now.getTime() - lastSync.getTime()) / 1000);

    if (seconds < 60) return 'Hace unos segundos';
    if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} min`;
    if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)} horas`;
    return 'Hace más de un día';
  }

  /**
   * Genera icono/emoji basado en estado
   */
  getStatusIcon(): string {
    const status = this.statusSubject.value;

    if (status.isOffline) return '📡'; // Sin conexión
    if (status.isSyncing) return '🔄'; // Sincronizando
    if (status.lastError) return '⚠️'; // Error
    if (status.pendingChanges > 0) return '⏳'; // Cambios pendientes
    return '✅'; // Todo sincronizado
  }

  /**
   * Genera texto de estado
   */
  getStatusText(): string {
    const status = this.statusSubject.value;

    if (status.isOffline) return 'Sin conexión';
    if (status.isSyncing) return 'Sincronizando...';
    if (status.lastError) return `Error: ${status.lastError}`;
    if (status.pendingChanges > 0) return `${status.pendingChanges} cambios pendientes`;
    return `Sincronizado ${this.getTimeSinceLastSync()}`;
  }

  /**
   * Escucha cambios en la conexión de red
   */
  private initializeNetworkListener(): void {
    if (typeof window !== 'undefined' && navigator) {
      window.addEventListener('online', () => {
        console.log('🌐 Conexión restaurada');
        this.setOfflineMode(false);
      });

      window.addEventListener('offline', () => {
        console.log('📡 Conexión perdida');
        this.setOfflineMode(true);
      });

      // Verificar estado inicial
      if (!navigator.onLine) {
        this.setOfflineMode(true);
      }
    }
  }
}
