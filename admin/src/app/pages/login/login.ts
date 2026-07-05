import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-wrap">
      <div class="login-card card">
        <div class="login-head">
          <div class="logo">⚙️</div>
          <h1>FoodGestor · Administración</h1>
          <p>Accede con una cuenta de administrador</p>
        </div>

        @if (error) { <div class="aviso error">{{ error }}</div> }

        <form (ngSubmit)="login()">
          <label class="campo">
            <span>Email</span>
            <input type="email" name="email" [(ngModel)]="email" placeholder="tu@email.com"
                   autocomplete="username" [disabled]="cargando" required />
          </label>
          <label class="campo">
            <span>Contraseña</span>
            <input type="password" name="password" [(ngModel)]="password" placeholder="••••••••"
                   autocomplete="current-password" [disabled]="cargando" required />
          </label>
          <button type="submit" class="btn btn-primary full" [disabled]="cargando || !email || !password">
            {{ cargando ? 'Entrando...' : 'Entrar' }}
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .login-wrap { min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .login-card { width: 100%; max-width: 380px; padding: 32px; }
    .login-head { text-align: center; margin-bottom: 20px; }
    .logo { font-size: 40px; }
    .login-head h1 { font-size: 19px; font-weight: 700; margin: 8px 0 4px; }
    .login-head p { color: var(--text-muted); margin: 0; font-size: 13px; }
    .campo { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
    .campo span { font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
    .campo input { width: 100%; }
    .full { width: 100%; margin-top: 6px; }
    .aviso { margin-bottom: 16px; }
  `]
})
export class LoginComponent implements OnInit {
  email = '';
  password = '';
  cargando = false;
  error = '';

  constructor(private auth: AuthService, private router: Router, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    if (this.auth.estaAutenticado()) this.router.navigate(['/panel']);
  }

  login(): void {
    this.error = '';
    this.cargando = true;
    this.auth.login(this.email.trim(), this.password).subscribe({
      next: () => {
        if (this.auth.esAdmin()) {
          this.router.navigate(['/panel']);
        } else {
          this.auth.logout();
          this.cargando = false;
          this.error = 'Esta cuenta no tiene acceso al panel de administración.';
          this.cdr.markForCheck();
        }
      },
      error: (err) => {
        this.cargando = false;
        if (err.status === 0 || err.status >= 500) {
          this.error = 'No se puede conectar con el servidor. Comprueba que el backend está activo.';
        } else {
          this.error = err.error?.error || 'Email o contraseña incorrectos.';
        }
        this.cdr.markForCheck();
      }
    });
  }
}
