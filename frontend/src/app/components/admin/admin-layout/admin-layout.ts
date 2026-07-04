import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="admin-shell">
      <header class="admin-header">
        <h1>⚙️ Panel de administración</h1>
        <a routerLink="/perfil" class="admin-volver">← Volver a la app</a>
      </header>

      <nav class="admin-nav">
        <a routerLink="usuarios" routerLinkActive="active">👤 Usuarios</a>
        <a routerLink="alimentos" routerLinkActive="active">🥗 Alimentos</a>
        <a routerLink="ingredientes" routerLinkActive="active">🥘 Ingredientes</a>
      </nav>

      <main class="admin-content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .admin-shell {
      min-height: 100dvh;
      max-width: 1100px;
      margin: 0 auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      box-sizing: border-box;
    }
    .admin-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .admin-header h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: var(--text-primary);
    }
    .admin-volver {
      color: var(--primary);
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
    }
    .admin-nav {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 8px;
    }
    .admin-nav a {
      padding: 8px 16px;
      border-radius: 8px;
      text-decoration: none;
      color: var(--text-secondary);
      font-size: 14px;
      font-weight: 600;
      transition: all 0.2s;
    }
    .admin-nav a:hover { background: var(--bg-secondary); }
    .admin-nav a.active {
      background: var(--primary);
      color: #fff;
    }
    .admin-content { flex: 1; }
  `]
})
export class AdminLayoutComponent {}
