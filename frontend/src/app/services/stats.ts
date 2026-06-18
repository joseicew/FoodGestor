import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class StatsService {
  private authUrl = `${environment.apiUrl}/api/auth`;
  private calUrl = `${environment.apiUrl}/api/calendario`;

  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    const token = localStorage.getItem('auth_token');
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  obtenerPesoHistorico(dias = 30): Observable<any[]> {
    return this.http.get<any[]>(`${this.authUrl}/peso-historico?dias=${dias}`, { headers: this.headers() });
  }

  registrarPeso(peso: number, fecha?: string): Observable<any> {
    const body: any = { peso };
    if (fecha) body.fecha = fecha;
    return this.http.post<any>(`${this.authUrl}/peso-historico`, body, { headers: this.headers() });
  }

  obtenerStatsKcal(dias = 30): Observable<{ dias: any[], objetivo_kcal: number }> {
    return this.http.get<any>(`${this.calUrl}/stats?dias=${dias}`, { headers: this.headers() });
  }
}
