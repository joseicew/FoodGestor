import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

const API = `${environment.apiUrl}/api/ingredientes`;

@Injectable({
  providedIn: 'root',
})
export class IngredientesService {
  private ingredientesSubject = new BehaviorSubject<any[]>([]);
  public ingredientes$ = this.ingredientesSubject.asObservable();
  private ingredientesMap: Map<string, any> = new Map();
  private cargando = false;

  constructor(
    private http: HttpClient
  ) {}

  private getHeaders(): { headers: HttpHeaders } {
    // Obtener token del localStorage directamente para evitar dependencia circular
    const token = localStorage.getItem('auth_token');
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return { headers };
  }

  /**
   * Carga TODOS los ingredientes de una sola vez y los cachea
   */
  cargarTodosLosIngredientes(): Observable<any[]> {
    if (this.cargando) {
      return this.ingredientes$;
    }

    this.cargando = true;
    console.log('📦 Cargando todos los ingredientes...');

    return this.http.get<{ ingredientes: any[] }>(`${API}/`, this.getHeaders()).pipe(
      tap((response) => {
        const ingredientes = response.ingredientes || [];
        console.log(`✅ ${ingredientes.length} ingredientes cargados en caché`);

        // Crear mapa por nombre para acceso rápido
        this.ingredientesMap.clear();
        ingredientes.forEach((ing) => {
          this.ingredientesMap.set(ing.nombre.toLowerCase(), ing);
        });

        this.ingredientesSubject.next(ingredientes);
        this.cargando = false;
      }),
      map((response) => response.ingredientes || [])
    );
  }

  /**
   * Obtiene un ingrediente por nombre del caché local
   */
  obtenerIngredientePorNombre(nombre: string): any | null {
    return this.ingredientesMap.get(nombre.toLowerCase()) || null;
  }

  /**
   * Obtiene todos los ingredientes cacheados
   */
  obtenerIngredientesCacheados(): any[] {
    return Array.from(this.ingredientesMap.values());
  }

  /**
   * Obtiene todos los ingredientes cacheados como Observable
   */
  obtenerIngredientesCacheadosObservable(): Observable<any[]> {
    return this.ingredientes$;
  }

  /**
   * Verifica si el caché está cargado
   */
  estaCargado(): boolean {
    return this.ingredientesMap.size > 0;
  }

  /**
   * Limpia el caché
   */
  limpiar(): void {
    this.ingredientesMap.clear();
    this.ingredientesSubject.next([]);
    console.log('✅ Caché de ingredientes limpiado');
  }
}
