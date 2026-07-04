import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth';

/** Deja pasar solo a usuarios con rol admin o superadmin. */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.estaAutenticado()) {
    router.navigate(['/login']);
    return false;
  }

  if (auth.perfil?.rol) {
    if (auth.esAdmin()) return true;
    router.navigate(['/login']);
    return false;
  }

  return auth.obtenerPerfil().pipe(
    map(() => {
      if (auth.esAdmin()) return true;
      router.navigate(['/login']);
      return false;
    }),
    catchError(() => {
      router.navigate(['/login']);
      return of(false);
    })
  );
};
