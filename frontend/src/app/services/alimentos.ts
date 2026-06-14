import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth';
import { environment } from '../../environments/environment';

const API = `${environment.apiUrl}/api/alimentos`;

@Injectable({
  providedIn: 'root',
})
export class AlimentosService {
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

  obtenerAlimentos(): Observable<any[]> {
    return this.http.get<any[]>(`${API}/`, this.getHeaders());
  }

  obtenerAlimento(id: number): Observable<any> {
    return this.http.get<any>(`${API}/${id}`, this.getHeaders());
  }

  crearAlimento(formData: FormData): Observable<any> {
    return this.http.post<any>(`${API}/`, formData, this.getHeaders());
  }

  actualizarAlimento(id: number, formData: FormData): Observable<any> {
    return this.http.put<any>(`${API}/${id}`, formData, this.getHeaders());
  }

  eliminarAlimento(id: number): Observable<any> {
    return this.http.delete<any>(`${API}/${id}`, this.getHeaders());
  }

  eliminarIngrediente(id: number): Observable<any> {
    const ingredientesAPI = `${environment.apiUrl}/api/ingredientes`;
    return this.http.delete<any>(`${ingredientesAPI}/${id}`, this.getHeaders());
  }

  procesarOCRIngredientes(formData: FormData): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/api/ocr/ingredientes`, formData, this.getHeaders());
  }

  procesarOCRMacros(formData: FormData): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/api/ocr/macros`, formData, this.getHeaders());
  }

  toggleFavorito(id: number): Observable<any> {
    return this.http.post<any>(`${API}/${id}/favorito`, {}, this.getHeaders());
  }

  obtenerFavoritos(): Observable<any[]> {
    return this.http.get<any[]>(`${API}/favoritos/lista`, this.getHeaders());
  }

  actualizarCodigoBarras(id: number, codigo_barras: string): Observable<any> {
    return this.http.post<any>(`${API}/${id}/actualizar-codigo`, { codigo_barras }, this.getHeaders());
  }

  obtenerCategoriasAlergenos(): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/api/ingredientes/alergenos-categorias/disponibles`, this.getHeaders());
  }

  obtenerCategoriasAlimentos(): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/api/ingredientes/alimentos-categorias/disponibles`, this.getHeaders());
  }

  actualizarIngrediente(ingredienteId: number, datos: any): Observable<any> {
    return this.http.put<any>(`${environment.apiUrl}/api/ingredientes/${ingredienteId}`, datos, this.getHeaders());
  }

  actualizarAlergenos(alimentoId: number, ingredientes: any[]): Observable<any> {
    return this.http.post<any>(`${API}/${alimentoId}/actualizar-alergenos`, { ingredientes }, this.getHeaders());
  }
}
