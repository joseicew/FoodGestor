import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { SessionService } from './session';
import { IngredientesService } from './ingredientes';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/api/auth`;
  private usuarioSubject = new BehaviorSubject<any>(null);
  public usuario$ = this.usuarioSubject.asObservable();
  private tokenKey = 'auth_token';

  constructor(
    private http: HttpClient,
    private sessionService: SessionService,
    private ingredientesService: IngredientesService
  ) {
    // No cargar usuario en el constructor
    // El PerfilComponent lo hará en ngOnInit
  }

  /**
   * Registra un nuevo usuario
   */
  registro(email: string, password: string, datosOnboarding: any): Observable<any> {
    const payload = {
      email,
      password,
      nombre_completo: datosOnboarding.nombre_completo || ''
    };
    return this.http.post<any>(`${this.apiUrl}/registro`, payload)
      .pipe(
        tap(response => {
          console.log('✓ Registro exitoso, guardando token:', !!response.token);
          this.guardarToken(response.token);
          this.usuarioSubject.next(response.usuario);
          console.log('✓ Token guardado, estaAutenticado():', this.estaAutenticado());

          // Cargar todos los ingredientes después del registro
          console.log('📦 Iniciando carga de ingredientes en caché...');
          this.ingredientesService.cargarTodosLosIngredientes().pipe(
            catchError(err => {
              console.error('⚠️ Error cargando ingredientes:', err);
              return of([]);
            })
          ).subscribe();
        })
      );
  }

  /**
   * Autentica un usuario con email y contraseña
   */
  login(email: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, { email, password })
      .pipe(
        tap(response => {
          console.log('✓ Login exitoso, guardando token:', !!response.token);
          this.guardarToken(response.token);
          this.usuarioSubject.next(response.usuario);
          console.log('✓ Token guardado, estaAutenticado():', this.estaAutenticado());

          // Cargar todos los ingredientes después del login
          console.log('📦 Iniciando carga de ingredientes en caché...');
          this.ingredientesService.cargarTodosLosIngredientes().pipe(
            catchError(err => {
              console.error('⚠️ Error cargando ingredientes:', err);
              return of([]);
            })
          ).subscribe();
        })
      );
  }

  /**
   * Obtiene los datos del usuario autenticado
   */
  obtenerPerfil(): Observable<any> {
    const token = this.obtenerToken();
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    console.log('[AuthService.obtenerPerfil] Token:', !!token);
    console.log('[AuthService.obtenerPerfil] Headers:', headers);
    return this.http.get<any>(`${this.apiUrl}/me`, { headers })
      .pipe(
        tap(usuario => {
          console.log('[AuthService.obtenerPerfil] ✓ Perfil recibido:', usuario);
          this.usuarioSubject.next(usuario);
          // Guardar en sesión para evitar peticiones innecesarias
          this.sessionService.guardarPerfil(usuario);
        })
      );
  }

  /**
   * Actualiza los datos del usuario y límites
   */
  actualizarPerfil(datos: any): Observable<any> {
    const token = this.obtenerToken();
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    console.log('[AuthService.actualizarPerfil] Token:', !!token);
    console.log('[AuthService.actualizarPerfil] Headers:', headers);
    return this.http.put<any>(`${this.apiUrl}/perfil`, datos, { headers })
      .pipe(
        tap(usuario => {
          console.log('[AuthService.actualizarPerfil] ✓ Perfil actualizado:', usuario);
          this.usuarioSubject.next(usuario);
          // Actualizar sesión con los nuevos datos
          this.sessionService.guardarPerfil(usuario);
        })
      );
  }

  /**
   * Retorna el token guardado
   */
  obtenerToken(): string | null {
    const token = localStorage.getItem(this.tokenKey);
    if (!token) {
      console.warn('⚠️ Token no encontrado en localStorage');
      console.log('Keys en localStorage:', Object.keys(localStorage));
    }
    return token;
  }

  /**
   * Verifica si el usuario está autenticado
   */
  estaAutenticado(): boolean {
    return !!this.obtenerToken();
  }

  /**
   * Obtiene el usuario actual
   */
  obtenerUsuarioActual(): any {
    return this.usuarioSubject.value;
  }

  /**
   * Cierra sesión
   */
  logout(): void {
    localStorage.removeItem(this.tokenKey);
    this.sessionService.limpiar();
    this.ingredientesService.limpiar();
    this.usuarioSubject.next(null);
  }

  /**
   * Solicita un email de recuperación de contraseña
   */
  solicitarReset(email: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/solicitar-reset`, { email });
  }

  /**
   * Restablece la contraseña usando el token del email
   */
  resetearPassword(token: string, nueva_password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/resetear-password`, { token, nueva_password });
  }

  /**
   * Cambia la contraseña estando autenticado
   */
  cambiarPassword(password_actual: string, nueva_password: string): Observable<any> {
    const token = this.obtenerToken();
    let headers = new HttpHeaders();
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    return this.http.put<any>(`${this.apiUrl}/cambiar-password`, { password_actual, nueva_password }, { headers });
  }

  /**
   * Guarda el token en localStorage
   */
  private guardarToken(token: string): void {
    if (!token) {
      console.warn('⚠️ Intento de guardar token vacío');
      return;
    }
    localStorage.setItem(this.tokenKey, token);
    const tokenGuardado = localStorage.getItem(this.tokenKey);
    console.log('✓ Token guardado en localStorage:', !!tokenGuardado);
    console.log('  Token key:', this.tokenKey);
    console.log('  localStorage.auth_token:', !!localStorage.getItem('auth_token'));
  }

}
