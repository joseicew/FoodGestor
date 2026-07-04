import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UsuarioAdmin {
  id: number;
  email: string;
  nombre_completo: string;
  rol: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private apiUrl = `${environment.apiUrl}/api/admin`;

  constructor(private http: HttpClient) {}

  listarUsuarios(): Observable<{ usuarios: UsuarioAdmin[] }> {
    return this.http.get<{ usuarios: UsuarioAdmin[] }>(`${this.apiUrl}/usuarios`);
  }

  cambiarRol(id: number, rol: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/usuarios/${id}/rol`, { rol });
  }
}
