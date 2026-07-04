import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth';
import { SessionService } from '../services/session';

@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  constructor(
    private auth: AuthService,
    private session: SessionService,
    private router: Router
  ) {}

  private esAdmin(rol: string | undefined | null): boolean {
    return rol === 'admin' || rol === 'superadmin';
  }

  canActivate(): boolean | Observable<boolean> {
    if (!this.auth.estaAutenticado()) {
      this.router.navigate(['/login']);
      return false;
    }

    // Si ya tenemos el perfil en sesión, comprobar el rol al momento
    const perfil = this.session.obtenerPerfil();
    if (perfil?.rol) {
      if (this.esAdmin(perfil.rol)) return true;
      this.router.navigate(['/perfil']);
      return false;
    }

    // Si no, pedir el perfil al servidor y comprobar el rol
    return this.auth.obtenerPerfil().pipe(
      map((u: any) => {
        if (this.esAdmin(u?.rol)) return true;
        this.router.navigate(['/perfil']);
        return false;
      }),
      catchError(() => {
        this.router.navigate(['/login']);
        return of(false);
      })
    );
  }
}
