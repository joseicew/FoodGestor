import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="layout">
      <aside class="sidebar">
        <div class="brand">
          <span class="brand-icon">⚙️</span>
          <span class="brand-text">FoodGestor<small>Administración</small></span>
        </div>

        <nav class="nav">
          <a routerLink="usuarios" routerLinkActive="active">👤 Usuarios</a>
          <a routerLink="alimentos" routerLinkActive="active">🥗 Alimentos</a>
          <a routerLink="ingredientes" routerLinkActive="active">🥘 Ingredientes</a>
        </nav>

        <div class="user">
          <div class="user-info">
            <span class="user-email">{{ auth.perfil?.email }}</span>
            <span class="badge badge-primary">{{ auth.rol }}</span>
          </div>
          <button class="btn logout" (click)="logout()">Cerrar sesión</button>
        </div>
      </aside>

      <main class="content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .layout { display: flex; min-height: 100dvh; }
    .sidebar {
      width: 240px; flex-shrink: 0; background: var(--surface); border-right: 1px solid var(--border);
      display: flex; flex-direction: column; padding: 20px 16px; position: sticky; top: 0; height: 100dvh;
    }
    .brand { display: flex; align-items: center; gap: 10px; padding: 0 8px 20px; }
    .brand-icon { font-size: 26px; }
    .brand-text { display: flex; flex-direction: column; font-size: 16px; font-weight: 700; line-height: 1.1; }
    .brand-text small { font-size: 11px; font-weight: 600; color: var(--text-muted); }
    .nav { display: flex; flex-direction: column; gap: 4px; flex: 1; }
    .nav a {
      padding: 10px 12px; border-radius: 8px; text-decoration: none; color: var(--text-muted);
      font-weight: 600; font-size: 14px; transition: all 0.15s;
    }
    .nav a:hover { background: var(--surface-2); color: var(--text); }
    .nav a.active { background: var(--primary-soft); color: var(--primary-dark); }
    .user { border-top: 1px solid var(--border); padding-top: 14px; display: flex; flex-direction: column; gap: 10px; }
    .user-info { display: flex; flex-direction: column; gap: 6px; padding: 0 4px; }
    .user-email { font-size: 12px; color: var(--text-muted); word-break: break-all; }
    .badge { align-self: flex-start; }
    .logout { width: 100%; }
    .content { flex: 1; padding: 28px 32px; max-width: 1100px; }
    @media (max-width: 720px) {
      .layout { flex-direction: column; }
      .sidebar { width: 100%; height: auto; position: static; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 12px; }
      .nav { flex-direction: row; flex-wrap: wrap; }
      .content { padding: 20px 16px; }
    }
  `]
})
export class LayoutComponent {
  constructor(public auth: AuthService, private router: Router) {}

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
