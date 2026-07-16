import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth';
import { environment } from '../../environments/environment';

const API = `${environment.apiUrl}/api/reportes`;

@Injectable({
  providedIn: 'root',
})
export class ReportesService {
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

  crearReporte(alimentoId: number, campos: string[], comentario: string): Observable<any> {
    return this.http.post(API, { alimento_id: alimentoId, campos, comentario }, this.getHeaders());
  }
}
