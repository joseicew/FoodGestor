import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = `${environment.apiUrl}/api/auth`;
  private tokenKey = 'admin_token';
  perfil: any = null;

  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, { email, password }).pipe(
      tap((res: any) => {
        if (res?.token) localStorage.setItem(this.tokenKey, res.token);
        this.perfil = res?.usuario ?? null;
      })
    );
  }

  obtenerPerfil(): Observable<any> {
    return this.http.get(`${this.apiUrl}/me`).pipe(tap((u: any) => (this.perfil = u)));
  }

  estaAutenticado(): boolean {
    return !!localStorage.getItem(this.tokenKey);
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    this.perfil = null;
  }

  get rol(): string | null {
    return this.perfil?.rol ?? null;
  }

  esAdmin(): boolean {
    return this.rol === 'admin' || this.rol === 'superadmin';
  }

  esSuperadmin(): boolean {
    return this.rol === 'superadmin';
  }
}
