import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): boolean {
    // Si está autenticado, permitir acceso
    if (this.authService.estaAutenticado()) {
      return true;
    }

    // Si no está autenticado, redirigir a login
    this.router.navigate(['/login']);
    return false;
  }
}
