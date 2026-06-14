import { Injectable, OnDestroy } from '@angular/core';
import { Subject, interval, takeUntil } from 'rxjs';
import { AuthService } from './auth';
import { SyncService } from './sync';

@Injectable({
  providedIn: 'root'
})
export class AutoSyncService implements OnDestroy {
  private destroy$ = new Subject<void>();
  private syncInterval: number = 60000; // 1 minuto

  constructor(
    private authService: AuthService,
    private syncService: SyncService
  ) {}

  /**
   * Inicia la verificación periódica de cambios
   * Se ejecuta cada minuto si el usuario está autenticado
   */
  iniciarVerificacionPeriodica(): void {
    // Solo iniciar si está autenticado
    if (!this.authService.estaAutenticado()) {
      console.log('⚠️ No autenticado, no iniciando verificación periódica');
      return;
    }

    console.log('🔄 Iniciando verificación periódica de cambios (cada 60s)');

    interval(this.syncInterval)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.verificarCambios();
      });
  }

  /**
   * Verifica cambios y sincroniza si es necesario
   */
  private verificarCambios(): void {
    if (!this.authService.estaAutenticado()) {
      console.log('⚠️ Sesión expirada, deteniendo sincronización');
      this.detener();
      return;
    }

    console.log('🔍 Verificando cambios...');
    this.syncService.sincronizarSiHayCambios().subscribe({
      next: () => {
        // Log ya incluido en SyncService
      },
      error: (err) => {
        console.error('⚠️ Error verificando cambios:', err);
        // Continuar intentando
      }
    });
  }

  /**
   * Detiene la verificación periódica
   */
  detener(): void {
    console.log('🛑 Deteniendo verificación periódica');
    this.destroy$.next();
  }

  ngOnDestroy(): void {
    this.detener();
  }

  /**
   * Cambia el intervalo de sincronización (en ms)
   */
  establecerIntervalo(ms: number): void {
    if (ms < 30000) {
      console.warn('⚠️ Intervalo muy corto (mínimo 30s)');
      return;
    }
    this.syncInterval = ms;
    console.log('⏱️ Intervalo de sincronización actualizado a', ms / 1000, 'segundos');
    this.detener();
    this.iniciarVerificacionPeriodica();
  }
}
