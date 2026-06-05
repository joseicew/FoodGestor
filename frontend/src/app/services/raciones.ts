import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth';

@Injectable({
  providedIn: 'root'
})
export class RacionesService {
  private apiUrl = 'http://192.168.1.17:5000/api/raciones';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getHeaders(): { headers: HttpHeaders } {
    const token = this.authService.obtenerToken();
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return { headers };
  }

  obtenerRaciones(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl, this.getHeaders());
  }

  obtenerRacion(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`, this.getHeaders());
  }

  crearRacion(data: { nombre: string; descripcion?: string }): Observable<any> {
    return this.http.post<any>(this.apiUrl, data, this.getHeaders());
  }

  actualizarRacion(id: number, data: { nombre?: string; descripcion?: string }): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, data, this.getHeaders());
  }

  eliminarRacion(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`, this.getHeaders());
  }

  agregarAlimento(racionId: number, alimentoId: number, cantidad: number = 100): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${racionId}/alimentos`, {
      alimento_id: alimentoId,
      cantidad
    }, this.getHeaders());
  }

  removerAlimento(racionId: number, alimentoId: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${racionId}/alimentos/${alimentoId}`, this.getHeaders());
  }

  actualizarCantidad(racionId: number, alimentoId: number, cantidad: number): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${racionId}/alimentos/${alimentoId}`, {
      cantidad
    }, this.getHeaders());
  }
}
