import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private sessionKey = 'user_session';

  /**
   * Guarda los datos del perfil en sessionStorage
   */
  guardarPerfil(perfil: any): void {
    sessionStorage.setItem(this.sessionKey, JSON.stringify(perfil));
  }

  /**
   * Obtiene los datos del perfil desde sessionStorage
   */
  obtenerPerfil(): any {
    const perfilStr = sessionStorage.getItem(this.sessionKey);
    return perfilStr ? JSON.parse(perfilStr) : null;
  }

  /**
   * Limpia los datos de sesión
   */
  limpiar(): void {
    sessionStorage.removeItem(this.sessionKey);
  }

  /**
   * Verifica si hay datos en sesión
   */
  tienePerfilEnSesion(): boolean {
    return sessionStorage.getItem(this.sessionKey) !== null;
  }
}
