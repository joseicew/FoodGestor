import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CalendarioService {
  private apiUrl = `${environment.apiUrl}/api/calendario`;

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

  /**
   * Obtiene todo el calendario del usuario
   */
  obtenerCalendario(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl, this.getHeaders());
  }

  /**
   * Obtiene el día completo con todas las 5 comidas
   */
  obtenerDia(fecha: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${fecha}`, this.getHeaders());
  }

  /**
   * Agrega una ración a una comida del día
   */
  agregarRacionAlComida(
    fecha: string,
    tipoComida: string,
    racionId: number,
    cantidad: number = 1
  ): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/${fecha}/${tipoComida}/raciones`,
      { racion_id: racionId, cantidad },
      this.getHeaders()
    );
  }

  /**
   * Agrega un alimento a una comida del día
   */
  agregarAlimentoAlComida(
    fecha: string,
    tipoComida: string,
    alimentoId: number,
    cantidad: number = 100
  ): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/${fecha}/${tipoComida}/alimentos`,
      { alimento_id: alimentoId, cantidad },
      this.getHeaders()
    );
  }

  /**
   * Remueve una ración de una comida
   */
  removerRacionDelComida(
    fecha: string,
    tipoComida: string,
    racionId: number
  ): Observable<any> {
    return this.http.delete<any>(
      `${this.apiUrl}/${fecha}/${tipoComida}/raciones/${racionId}`,
      this.getHeaders()
    );
  }

  /**
   * Remueve un alimento de una comida
   */
  removerAlimentoDelComida(
    fecha: string,
    tipoComida: string,
    alimentoId: number
  ): Observable<any> {
    return this.http.delete<any>(
      `${this.apiUrl}/${fecha}/${tipoComida}/alimentos/${alimentoId}`,
      this.getHeaders()
    );
  }

  /**
   * Actualiza la cantidad de una ración en una comida
   */
  actualizarCantidadRacion(
    fecha: string,
    tipoComida: string,
    racionId: number,
    cantidad: number
  ): Observable<any> {
    return this.http.put<any>(
      `${this.apiUrl}/${fecha}/${tipoComida}/raciones/${racionId}`,
      { cantidad },
      this.getHeaders()
    );
  }

  /**
   * Actualiza la cantidad de un alimento en una comida
   */
  actualizarCantidadAlimento(
    fecha: string,
    tipoComida: string,
    alimentoId: number,
    cantidad: number
  ): Observable<any> {
    return this.http.put<any>(
      `${this.apiUrl}/${fecha}/${tipoComida}/alimentos/${alimentoId}`,
      { cantidad },
      this.getHeaders()
    );
  }
}
