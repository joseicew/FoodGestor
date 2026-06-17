import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
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

  syncStatus$!: Observable<SyncStatus>;

  ngOnInit(): void {
    this.syncStatus$ = this.syncStatusService.status$;
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
