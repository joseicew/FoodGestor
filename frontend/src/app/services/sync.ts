import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuthService } from './auth';
import { CacheService } from './cache';
import { AlimentosService } from './alimentos';
import { RacionesService } from './raciones';
import { CalendarioService } from './calendario';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private cacheService: CacheService,
    private alimentosService: AlimentosService,
    private racionesService: RacionesService,
    private calendarioService: CalendarioService
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
   * Carga inicial de datos al login
   * Descarga alimentos, raciones y calendario y los guarda en caché
   */
  cargarDatosIniciales(): Observable<any> {
    console.log('🔄 Iniciando carga de datos...');

    return forkJoin({
      alimentos: this.alimentosService.obtenerAlimentos(),
      raciones: this.racionesService.obtenerRaciones(),
      calendario: this.calendarioService.obtenerCalendario()
    }).pipe(
      tap(({ alimentos, raciones, calendario }) => {
        console.log('✅ Datos iniciales cargados:');
        console.log('  - Alimentos:', alimentos.length);
        console.log('  - Raciones:', raciones.length);
        console.log('  - Calendario:', calendario.length);

        // Guardar en caché
        this.cacheService.guardarAlimentos(alimentos);
        this.cacheService.guardarRaciones(raciones);
        this.cacheService.guardarCalendario(calendario);
      })
    );
  }

  /**
   * Verifica si hay cambios en alimentos en el servidor
   * Retorna true si hay cambios, false si están sincronizados
   */
  verificarCambiosAlimentos(): Observable<any> {
    const alimentos = this.cacheService.obtenerAlimentos();
    const payload = { count: alimentos.length };

    return this.http.post<any>(
      `${this.apiUrl}/api/alimentos/sync/diff`,
      payload,
      this.getHeaders()
    ).pipe(
      tap(response => {
        if (response.hay_cambios) {
          console.log('⚠️ Cambios detectados en alimentos');
          console.log(`  Server: ${response.count_servidor}, Local: ${response.count_cliente}`);
        }
      })
    );
  }

  /**
   * Verifica si hay cambios en raciones en el servidor
   */
  verificarCambiosRaciones(): Observable<any> {
    const raciones = this.cacheService.obtenerRaciones();
    const payload = { count: raciones.length };

    return this.http.post<any>(
      `${this.apiUrl}/api/raciones/sync/diff`,
      payload,
      this.getHeaders()
    ).pipe(
      tap(response => {
        if (response.hay_cambios) {
          console.log('⚠️ Cambios detectados en raciones');
          console.log(`  Server: ${response.count_servidor}, Local: ${response.count_cliente}`);
        }
      })
    );
  }

  /**
   * Verifica si hay cambios en calendario en el servidor
   */
  verificarCambiosCalendario(): Observable<any> {
    const calendario = this.cacheService.obtenerCalendario();
    const payload = { count: calendario.length };

    return this.http.post<any>(
      `${this.apiUrl}/api/calendario/sync/diff`,
      payload,
      this.getHeaders()
    ).pipe(
      tap(response => {
        if (response.hay_cambios) {
          console.log('⚠️ Cambios detectados en calendario');
          console.log(`  Server: ${response.count_servidor}, Local: ${response.count_cliente}`);
        }
      })
    );
  }

  /**
   * Verifica cambios en todos los datos
   * Retorna observable con el resultado de todas las verificaciones
   */
  verificarTodosCambios(): Observable<any> {
    return forkJoin({
      alimentos: this.verificarCambiosAlimentos(),
      raciones: this.verificarCambiosRaciones(),
      calendario: this.verificarCambiosCalendario()
    }).pipe(
      tap(({ alimentos, raciones, calendario }) => {
        const cambios = [
          alimentos.hay_cambios ? '📝 Alimentos' : null,
          raciones.hay_cambios ? '📊 Raciones' : null,
          calendario.hay_cambios ? '📅 Calendario' : null
        ].filter(x => x);

        if (cambios.length > 0) {
          console.log('⚠️ Cambios en: ' + cambios.join(', '));
        } else {
          console.log('✅ Todo sincronizado');
        }
      })
    );
  }

  /**
   * Sincroniza datos si hay cambios
   * Recarga los datos que han cambiado en el servidor
   */
  sincronizarSiHayCambios(): Observable<any> {
    return this.verificarTodosCambios().pipe(
      tap(result => {
        // Si hay cambios, recargar los datos correspondientes
        if (result.alimentos.hay_cambios) {
          this.alimentosService.obtenerAlimentos().subscribe(
            alimentos => this.cacheService.guardarAlimentos(alimentos)
          );
        }
        if (result.raciones.hay_cambios) {
          this.racionesService.obtenerRaciones().subscribe(
            raciones => this.cacheService.guardarRaciones(raciones)
          );
        }
        if (result.calendario.hay_cambios) {
          this.calendarioService.obtenerCalendario().subscribe(
            calendario => this.cacheService.guardarCalendario(calendario)
          );
        }
      })
    );
  }

  /**
   * Limpia toda la caché (útil al logout)
   */
  limpiar(): void {
    this.cacheService.limpiar();
    console.log('✅ Sincronización limpiada');
  }
}
