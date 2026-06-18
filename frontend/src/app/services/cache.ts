import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

interface CacheData<T> {
  data: T[];
  timestamp: number;
  hash: string; // Hash para detectar cambios
}

@Injectable({
  providedIn: 'root'
})
export class CacheService {
  private readonly CACHE_KEYS = {
    alimentos: 'cache_alimentos',
    raciones: 'cache_raciones',
    calendario: 'cache_calendario'
  };

  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas

  // BehaviorSubjects para notificar cambios
  private alimentosSubject = new BehaviorSubject<any[]>([]);
  private racionesSubject = new BehaviorSubject<any[]>([]);
  private calendarioSubject = new BehaviorSubject<any[]>([]);

  public alimentos$ = this.alimentosSubject.asObservable();
  public raciones$ = this.racionesSubject.asObservable();
  public calendario$ = this.calendarioSubject.asObservable();

  constructor() {
    this.cargarDelLocalStorage();
  }

  /**
   * Calcula un hash simple de los datos para detectar cambios
   */
  private calcularHash(data: any[]): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }

  /**
   * Guarda alimentos en caché
   */
  guardarAlimentos(alimentos: any[]): void {
    const cacheData: CacheData<any> = {
      data: alimentos,
      timestamp: Date.now(),
      hash: this.calcularHash(alimentos)
    };
    localStorage.setItem(this.CACHE_KEYS.alimentos, JSON.stringify(cacheData));
    this.alimentosSubject.next(alimentos);
    console.log('✅ Alimentos guardados en caché:', alimentos.length);
  }

  /**
   * Obtiene alimentos del caché
   */
  obtenerAlimentos(): any[] {
    const cached = localStorage.getItem(this.CACHE_KEYS.alimentos);
    if (!cached) return [];

    try {
      const cacheData: CacheData<any> = JSON.parse(cached);

      // Verificar si el caché expiró
      if (Date.now() - cacheData.timestamp > this.CACHE_DURATION) {
        console.log('⏱️ Caché de alimentos expirado');
        return [];
      }

      return cacheData.data || [];
    } catch (e) {
      console.error('Error al leer caché de alimentos:', e);
      return [];
    }
  }

  /**
   * Obtiene alimentos del caché como Observable
   */
  obtenerAlimentosObservable(): Observable<any[]> {
    return this.alimentos$;
  }

  /**
   * Verifica si los datos del caché coinciden con los nuevos datos
   */
  hanCambiadoAlimentos(nuevosAlimentos: any[]): boolean {
    const cached = localStorage.getItem(this.CACHE_KEYS.alimentos);
    if (!cached) return true;

    try {
      const cacheData: CacheData<any> = JSON.parse(cached);
      const hashNuevo = this.calcularHash(nuevosAlimentos);
      return cacheData.hash !== hashNuevo;
    } catch (e) {
      return true;
    }
  }

  /**
   * Guarda raciones en caché
   */
  guardarRaciones(raciones: any[]): void {
    const cacheData: CacheData<any> = {
      data: raciones,
      timestamp: Date.now(),
      hash: this.calcularHash(raciones)
    };
    localStorage.setItem(this.CACHE_KEYS.raciones, JSON.stringify(cacheData));
    this.racionesSubject.next(raciones);
    console.log('✅ Raciones guardadas en caché:', raciones.length);
  }

  /**
   * Obtiene raciones del caché
   */
  obtenerRaciones(): any[] {
    const cached = localStorage.getItem(this.CACHE_KEYS.raciones);
    if (!cached) return [];

    try {
      const cacheData: CacheData<any> = JSON.parse(cached);

      if (Date.now() - cacheData.timestamp > this.CACHE_DURATION) {
        console.log('⏱️ Caché de raciones expirado');
        return [];
      }

      return cacheData.data || [];
    } catch (e) {
      console.error('Error al leer caché de raciones:', e);
      return [];
    }
  }

  /**
   * Obtiene raciones del caché como Observable
   */
  obtenerRacionesObservable(): Observable<any[]> {
    return this.raciones$;
  }

  /**
   * Verifica si han cambiado las raciones
   */
  hanCambiadoRaciones(nuevasRaciones: any[]): boolean {
    const cached = localStorage.getItem(this.CACHE_KEYS.raciones);
    if (!cached) return true;

    try {
      const cacheData: CacheData<any> = JSON.parse(cached);
      const hashNuevo = this.calcularHash(nuevasRaciones);
      return cacheData.hash !== hashNuevo;
    } catch (e) {
      return true;
    }
  }

  /**
   * Guarda calendario en caché
   */
  guardarCalendario(calendario: any[]): void {
    const cacheData: CacheData<any> = {
      data: calendario,
      timestamp: Date.now(),
      hash: this.calcularHash(calendario)
    };
    localStorage.setItem(this.CACHE_KEYS.calendario, JSON.stringify(cacheData));
    this.calendarioSubject.next(calendario);
    console.log('✅ Calendario guardado en caché:', calendario.length);
  }

  /**
   * Obtiene calendario del caché
   */
  obtenerCalendario(): any[] {
    const cached = localStorage.getItem(this.CACHE_KEYS.calendario);
    if (!cached) return [];

    try {
      const cacheData: CacheData<any> = JSON.parse(cached);

      if (Date.now() - cacheData.timestamp > this.CACHE_DURATION) {
        console.log('⏱️ Caché de calendario expirado');
        return [];
      }

      return cacheData.data || [];
    } catch (e) {
      console.error('Error al leer caché de calendario:', e);
      return [];
    }
  }

  /**
   * Obtiene calendario del caché como Observable
   */
  obtenerCalendarioObservable(): Observable<any[]> {
    return this.calendario$;
  }

  /**
   * Verifica si han cambiado los datos del calendario
   */
  hanCambiadoCalendario(nuevoCalendario: any[]): boolean {
    const cached = localStorage.getItem(this.CACHE_KEYS.calendario);
    if (!cached) return true;

    try {
      const cacheData: CacheData<any> = JSON.parse(cached);
      const hashNuevo = this.calcularHash(nuevoCalendario);
      return cacheData.hash !== hashNuevo;
    } catch (e) {
      return true;
    }
  }

  /**
   * Actualiza un alimento en el caché local sin esperar al servidor
   */
  actualizarAlimentoLocal(id: number, cambios: any): void {
    const alimentos = this.obtenerAlimentos();
    const index = alimentos.findIndex(a => a.id === id);
    if (index !== -1) {
      alimentos[index] = { ...alimentos[index], ...cambios };
      this.guardarAlimentos(alimentos);
    }
  }

  /**
   * Agrega una ración al caché local
   */
  agregarRacionLocal(racion: any): void {
    const raciones = this.obtenerRaciones();
    raciones.push(racion);
    this.guardarRaciones(raciones);
  }

  /**
   * Elimina una ración del caché local
   */
  eliminarRacionLocal(id: number): void {
    const raciones = this.obtenerRaciones();
    const filtered = raciones.filter(r => r.id !== id);
    this.guardarRaciones(filtered);
  }

  /**
   * Agrega entrada de calendario al caché local
   */
  agregarCalendarioLocal(entrada: any): void {
    const calendario = this.obtenerCalendario();
    calendario.push(entrada);
    this.guardarCalendario(calendario);
  }

  /**
   * Elimina entrada de calendario del caché local
   */
  eliminarCalendarioLocal(id: number): void {
    const calendario = this.obtenerCalendario();
    const filtered = calendario.filter(c => c.id !== id);
    this.guardarCalendario(filtered);
  }

  /**
   * Carga datos del localStorage al iniciar
   */
  private cargarDelLocalStorage(): void {
    const alimentos = this.obtenerAlimentos();
    const raciones = this.obtenerRaciones();
    const calendario = this.obtenerCalendario();

    if (alimentos.length > 0) {
      this.alimentosSubject.next(alimentos);
    }
    if (raciones.length > 0) {
      this.racionesSubject.next(raciones);
    }
    if (calendario.length > 0) {
      this.calendarioSubject.next(calendario);
    }
  }

  // ── Cache por fecha (calendario) ──

  private readonly CACHE_DIA_PREFIX = 'cache_dia_';

  guardarDia(fecha: string, data: any): void {
    const entry = { data, timestamp: Date.now(), hash: this.calcularHash([data]) };
    localStorage.setItem(this.CACHE_DIA_PREFIX + fecha, JSON.stringify(entry));
  }

  obtenerDia(fecha: string): any | null {
    const raw = localStorage.getItem(this.CACHE_DIA_PREFIX + fecha);
    if (!raw) return null;
    try {
      const entry = JSON.parse(raw);
      if (Date.now() - entry.timestamp > this.CACHE_DURATION) return null;
      return entry.data;
    } catch { return null; }
  }

  haCambiadoDia(fecha: string, nuevaData: any): boolean {
    const raw = localStorage.getItem(this.CACHE_DIA_PREFIX + fecha);
    if (!raw) return true;
    try {
      const entry = JSON.parse(raw);
      return entry.hash !== this.calcularHash([nuevaData]);
    } catch { return true; }
  }

  /**
   * Limpia toda la caché (útil al logout)
   */
  limpiar(): void {
    localStorage.removeItem(this.CACHE_KEYS.alimentos);
    localStorage.removeItem(this.CACHE_KEYS.raciones);
    localStorage.removeItem(this.CACHE_KEYS.calendario);
    this.alimentosSubject.next([]);
    this.racionesSubject.next([]);
    this.calendarioSubject.next([]);
    console.log('✅ Caché limpiado');
  }
}
