import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface UsuarioAdmin {
  id: number;
  email: string;
  nombre_completo: string;
  rol: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ── Usuarios ──
  listarUsuarios(): Observable<{ usuarios: UsuarioAdmin[] }> {
    return this.http.get<{ usuarios: UsuarioAdmin[] }>(`${this.base}/api/admin/usuarios`);
  }

  cambiarRol(id: number, rol: string): Observable<any> {
    return this.http.put(`${this.base}/api/admin/usuarios/${id}/rol`, { rol });
  }

  // ── Alimentos ──
  listarAlimentos(): Observable<any[]> {
    return this.http
      .get<{ alimentos: any[] }>(`${this.base}/api/alimentos/`)
      .pipe(map((r) => r.alimentos || []));
  }

  /** El backend espera form-data para el PUT de alimento */
  actualizarAlimento(id: number, datos: Record<string, any>): Observable<any> {
    const fd = new FormData();
    Object.entries(datos).forEach(([k, v]) => {
      if (v !== null && v !== undefined) fd.append(k, typeof v === 'string' ? v : String(v));
    });
    return this.http.put(`${this.base}/api/alimentos/${id}`, fd);
  }

  // ── Ingredientes ──
  listarIngredientes(): Observable<any[]> {
    return this.http
      .get<{ ingredientes: any[] }>(`${this.base}/api/ingredientes/`)
      .pipe(map((r) => r.ingredientes || []));
  }

  actualizarIngrediente(id: number, data: Record<string, any>): Observable<any> {
    return this.http.put(`${this.base}/api/ingredientes/${id}`, data);
  }

  eliminarIngrediente(id: number): Observable<any> {
    return this.http.delete(`${this.base}/api/ingredientes/${id}`);
  }

  /** Marca `id` como duplicado de `destinoId`: transfiere los alimentos y borra `id` */
  reemplazarIngrediente(id: number, destinoId: number): Observable<any> {
    return this.http.post(`${this.base}/api/ingredientes/${id}/reemplazar`, { destino_id: destinoId });
  }

  /** Alimentos que tienen este ingrediente asociado */
  alimentosDeIngrediente(id: number): Observable<{ id: number; nombre: string; marca: string }[]> {
    return this.http
      .get<{ alimentos: any[] }>(`${this.base}/api/ingredientes/${id}/alimentos`)
      .pipe(map((r) => r.alimentos || []));
  }

  /** Categorías oficiales de ingredientes (ALIMENTOS_CATEGORIAS en el backend), las mismas que usa la app móvil */
  listarCategoriasIngredientes(): Observable<string[]> {
    return this.http
      .get<{ categorias: string[] }>(`${this.base}/api/ingredientes/alimentos-categorias/disponibles`)
      .pipe(map((r) => r.categorias || []));
  }
}
