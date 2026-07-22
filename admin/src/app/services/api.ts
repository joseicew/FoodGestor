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

export interface TipoLimpieza {
  tipo: string;
  nombre: string;
  descripcion: string;
  pendientes: number;
  ia: boolean;
}

export interface AlimentoResumen {
  id: number;
  nombre: string;
  marca: string;
  calorias: number | null;
  proteinas: number | null;
  grasas: number | null;
  grasas_saturadas: number | null;
  hidratos_carbono: number | null;
  azucares: number | null;
  fibra: number | null;
  sal: number | null;
  sodio: number | null;
  potasio: number | null;
  calcio: number | null;
  hierro: number | null;
  [key: string]: any;
}

export interface ReporteAlimento {
  id: number;
  alimento_id: number;
  usuario_id: number;
  campos: string[];
  detalle_macros: { campo: string; valor: string }[];
  detalle_ingredientes: { nombre: string; correccion: string }[];
  marca_correcta: string;
  comentario: string;
  estado: 'pendiente' | 'resuelto' | 'descartado';
  created_at: string | null;
  alimento: AlimentoResumen | null;
  usuario_email: string | null;
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

  obtenerAlimento(id: number): Observable<any> {
    return this.http.get(`${this.base}/api/alimentos/${id}`);
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

  obtenerIngrediente(id: number): Observable<any> {
    return this.http.get(`${this.base}/api/ingredientes/${id}`);
  }

  /** Busca un ingrediente por nombre exacto (case-insensitive) */
  buscarIngredientePorNombre(nombre: string): Observable<any | null> {
    return this.http
      .get<{ ingredientes: any[] }>(`${this.base}/api/ingredientes/`, { params: { nombre } })
      .pipe(map((r) => (r.ingredientes && r.ingredientes[0]) || null));
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

  /** Categorías de alérgenos/intolerancias (ALERGENO_CATEGORIAS en el backend) */
  listarAlergenosDisponibles(): Observable<string[]> {
    return this.http
      .get<{ categorias: string[] }>(`${this.base}/api/ingredientes/alergenos-categorias/disponibles`)
      .pipe(map((r) => r.categorias || []));
  }

  // ── Limpiezas ──
  listarTiposLimpieza(): Observable<TipoLimpieza[]> {
    return this.http
      .get<{ tipos: TipoLimpieza[] }>(`${this.base}/api/admin/limpiezas/tipos`)
      .pipe(map((r) => r.tipos || []));
  }

  /** Lanza el agente de IA para el tipo de limpieza indicado; devuelve un job_id para sondear */
  iniciarLimpieza(tipo: string): Observable<{ job_id: string; estado: string }> {
    return this.http.post<{ job_id: string; estado: string }>(`${this.base}/api/admin/limpiezas/${tipo}/start`, {});
  }

  obtenerJobLimpieza(jobId: string): Observable<any> {
    return this.http.get<any>(`${this.base}/api/admin/limpiezas/job/${jobId}`);
  }

  /** Limpiezas deterministas ya existentes (sin IA), se ejecutan de forma síncrona */
  limpiarHuerfanos(): Observable<any> {
    return this.http.post(`${this.base}/api/ingredientes/limpieza/orfanos`, {});
  }

  consolidarDuplicados(): Observable<any> {
    return this.http.post(`${this.base}/api/ingredientes/limpieza/duplicados`, {});
  }

  listarAlimentosSinIngredientes(): Observable<any> {
    return this.http.post(`${this.base}/api/alimentos/limpieza/sin-ingredientes`, {});
  }

  vincularIngredienteSugerido(alimentoId: number, ingredienteId: number): Observable<any> {
    return this.http.post(`${this.base}/api/alimentos/${alimentoId}/vincular-ingrediente`, { ingrediente_id: ingredienteId });
  }

  listarAlimentosDuplicados(): Observable<any> {
    return this.http.post(`${this.base}/api/alimentos/limpieza/posibles-duplicados`, {});
  }

  // ── Reportes de alimentos ──
  listarReportes(estado?: string): Observable<ReporteAlimento[]> {
    const params: Record<string, string> = estado ? { estado } : {};
    return this.http
      .get<{ reportes: ReporteAlimento[] }>(`${this.base}/api/admin/reportes`, { params })
      .pipe(map((r) => r.reportes || []));
  }

  actualizarReporte(id: number, estado: string): Observable<any> {
    return this.http.put(`${this.base}/api/admin/reportes/${id}`, { estado });
  }
}
