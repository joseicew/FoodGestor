import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AuthService } from './auth';
import { environment } from '../../environments/environment';
import { of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AllergensService {
  private apiUrl = `${environment.apiUrl}/api/ingredientes/alergenos-categorias/disponibles`;
  private allergensSubject = new BehaviorSubject<string[]>([]);
  public allergens$ = this.allergensSubject.asObservable();

  private allergensCached: string[] | null = null;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.cargarAlergenos();
  }

  private getHeaders(): { headers: HttpHeaders } {
    const token = this.authService.obtenerToken();
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return { headers };
  }

  /**
   * Obtiene las categorías de alergenos disponibles
   */
  obtenerAlergenos(): Observable<string[]> {
    if (this.allergensCached) {
      return of(this.allergensCached);
    }

    return this.http.get<string[]>(this.apiUrl, this.getHeaders()).pipe(
      tap((alergenos) => {
        this.allergensCached = alergenos;
        this.allergensSubject.next(alergenos);
        console.log('✅ Alergenos cargados:', alergenos.length);
      }),
      catchError((err) => {
        console.error('Error cargando alergenos:', err);
        // Retornar array vacío en caso de error
        return of([]);
      })
    );
  }

  /**
   * Obtiene alergenos en caché o vacío
   */
  obtenerAlergeonosSync(): string[] {
    return this.allergensCached || [];
  }

  /**
   * Carga alergenos localmente
   */
  private cargarAlergenos(): void {
    this.obtenerAlergenos().subscribe();
  }

  /**
   * Verifica si un alimento tiene alergenos
   */
  tieneAlergeno(alimento: any, alergenosCruzados: string[]): boolean {
    if (!alimento || !alergenosCruzados || alergenosCruzados.length === 0) {
      return false;
    }

    if (!alimento.ingredientes || alimento.ingredientes.length === 0) {
      return false;
    }

    // Buscar si algún ingrediente tiene una categoría de alergeno
    return alimento.ingredientes.some((ingrediente: any) => {
      if (!ingrediente.alergenos_categorias) {
        return false;
      }

      return ingrediente.alergenos_categorias.some((alergenoIng: string) =>
        alergenosCruzados.includes(alergenoIng)
      );
    });
  }
}
