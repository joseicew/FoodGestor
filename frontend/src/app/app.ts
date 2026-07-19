import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth';
import { SyncStatusService, SyncStatus } from './services/sync-status';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  authService = inject(AuthService);
  syncStatusService = inject(SyncStatusService);
  private router = inject(Router);
  syncStatus$!: Observable<SyncStatus>;

  private onVisibilityChange = () => {
    if (document.visibilityState === 'visible' && this.authService.estaAutenticado()) {
      // Al volver de segundo plano, comprobar si el backend sigue siendo
      // alcanzable; si no lo es, forzar cierre de sesión para que el
      // siguiente login cargue todo correctamente (en vez de quedarse con
      // datos a medias hasta que alguna petición falle por su cuenta).
      this.authService.servidorAlcanzable().subscribe((ok) => {
        if (!ok) {
          this.authService.logout();
          this.router.navigate(['/login'], { queryParams: { motivo: 'sin_conexion' } });
        }
      });
    }
  };

  ngOnInit(): void {
    this.syncStatus$ = this.syncStatusService.status$;
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  ngOnDestroy(): void {
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  getSyncIcon(): string {
    return this.syncStatusService.getStatusIcon();
  }

  getSyncText(): string {
    return this.syncStatusService.getStatusText();
  }
}
