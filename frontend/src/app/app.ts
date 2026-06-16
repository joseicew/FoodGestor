import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth';
import { ThemeService } from './services/theme';
import { SyncStatusService, SyncStatus } from './services/sync-status';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  authService = inject(AuthService);
  themeService = inject(ThemeService);
  syncStatusService = inject(SyncStatusService);
  private router = inject(Router);

  syncStatus$!: Observable<SyncStatus>;
  confirmarLogout = false;

  ngOnInit(): void {
    this.syncStatus$ = this.syncStatusService.status$;
  }

  abrirConfirmacionLogout() { this.confirmarLogout = true; }
  cerrarConfirmacionLogout() { this.confirmarLogout = false; }

  logout() {
    this.confirmarLogout = false;
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  getSyncIcon(): string {
    return this.syncStatusService.getStatusIcon();
  }

  getSyncText(): string {
    return this.syncStatusService.getStatusText();
  }
}
