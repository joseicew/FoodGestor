import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { timeout } from 'rxjs/operators';
import { MensajeFlash } from '../shared/mensaje-flash/mensaje-flash';
import { AuthService } from '../../services/auth';
import { SyncService } from '../../services/sync';
import { BiometricAuthService } from '../../services/biometric-auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MensajeFlash],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent implements OnInit, OnDestroy {
  @ViewChild(MensajeFlash) flash!: MensajeFlash;

  email: string = '';
  password: string = '';
  mostrarPassword: boolean = false;
  cargando: boolean = false;

  // Overlay de carga de datos iniciales tras el login
  cargandoDatos: boolean = false;
  progresoCarga: number = 0;
  mensajeCargaIndex: number = 0;
  readonly mensajesCarga: string[] = [
    '🥗 Recolectando tus alimentos...',
    '🥘 Cargando tus raciones...',
    '🧂 Preparando los ingredientes...',
    '📅 Sincronizando tu calendario...',
    '✨ Casi listo...'
  ];
  private intervaloCarga: any = null;
  mostrarModalEmailNoExiste: boolean = false;
  emailNoExiste: string = '';
  mostrarModalPasswordIncorrecto: boolean = false;

  mostrarModalOlvidePassword: boolean = false;
  emailReset: string = '';
  cargandoReset: boolean = false;
  resetEnviado: boolean = false;

  // Acceso rápido con Face ID/Touch ID
  biometriaDisponible = false;
  mostrarBotonBiometria = false;
  etiquetaBiometria = 'Face ID';
  iconoBiometria = '🙂';
  mostrarModalActivarBiometria = false;
  private credencialesParaGuardar: { email: string; password: string } | null = null;

  constructor(
    private authService: AuthService,
    private syncService: SyncService,
    private biometricAuthService: BiometricAuthService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Si nos han redirigido aquí por pérdida de conexión con el servidor/BD
    // (ver AuthInterceptor), avisar al usuario de por qué se cerró su sesión
    if (this.route.snapshot.queryParamMap.get('motivo') === 'sin_conexion') {
      setTimeout(() => {
        this.flash?.mostrar('⚠️ Se cerró tu sesión: no se pudo conectar con el servidor. Vuelve a iniciar sesión cuando tengas conexión.', 'error');
        this.cdr.detectChanges();
      });
    }

    // Si ya está autenticado, redirigir al perfil
    if (this.authService.estaAutenticado()) {
      this.router.navigate(['/perfil']);
      return;
    }
    // Prerellenar el email del último inicio de sesión (la contraseña la gestiona
    // el llavero del sistema vía autocomplete, no la guardamos nosotros)
    const ultimoEmail = localStorage.getItem('ultimo_email');
    if (ultimoEmail) {
      this.email = ultimoEmail;
    }

    this.comprobarBiometria();
  }

  private async comprobarBiometria(): Promise<void> {
    const disponible = await this.biometricAuthService.disponible();
    if (!disponible) return;

    this.biometriaDisponible = true;
    this.etiquetaBiometria = await this.biometricAuthService.etiqueta();
    this.iconoBiometria = await this.biometricAuthService.icono();
    this.mostrarBotonBiometria = await this.biometricAuthService.hayCredencialesGuardadas();
    this.cdr.detectChanges();
  }

  ngOnDestroy(): void {
    this.detenerAnimacionCarga();
  }

  get mensajeCargaActual(): string {
    return this.mensajesCarga[this.mensajeCargaIndex];
  }

  private iniciarAnimacionCarga(): void {
    this.cargandoDatos = true;
    this.progresoCarga = 0;
    this.mensajeCargaIndex = 0;
    this.cdr.detectChanges();
    this.intervaloCarga = setInterval(() => {
      // Avanzar de forma asintótica hacia el 90%: rápido al principio y cada vez
      // más lento. Refleja el tiempo de espera real sin llegar a 100 antes de hora.
      if (this.progresoCarga < 90) {
        this.progresoCarga = Math.min(90, this.progresoCarga + Math.max(0.6, (90 - this.progresoCarga) * 0.07));
      }
      // El mensaje avanza ligado al progreso real de la barra
      this.mensajeCargaIndex = Math.min(
        this.mensajesCarga.length - 1,
        Math.floor((this.progresoCarga / 90) * this.mensajesCarga.length)
      );
      this.cdr.detectChanges();
    }, 130);
  }

  // Completa la barra al 100% cuando los datos reales han cargado, la deja ver
  // un instante y entonces navega al perfil.
  private completarYNavegar(): void {
    if (this.intervaloCarga) {
      clearInterval(this.intervaloCarga);
      this.intervaloCarga = null;
    }
    this.progresoCarga = 100;
    this.mensajeCargaIndex = this.mensajesCarga.length - 1;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.cargandoDatos = false;
      this.router.navigate(['/perfil']);
    }, 350);
  }

  private detenerAnimacionCarga(): void {
    this.cargandoDatos = false;
    if (this.intervaloCarga) {
      clearInterval(this.intervaloCarga);
      this.intervaloCarga = null;
    }
  }

  login(): void {
    const emailLimpio = this.email.trim();
    const passwordLimpia = this.password.trim();

    // Validación de email
    if (!emailLimpio) {
      this.flash.mostrar('Por favor ingresa tu email', 'error');
      return;
    }

    // Validación de contraseña
    if (!passwordLimpia) {
      this.flash.mostrar('Por favor ingresa tu contraseña', 'error');
      return;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailLimpio)) {
      this.flash.mostrar('Email inválido (debe contener @ y un dominio)', 'error');
      return;
    }

    console.log('Intentando login con:', emailLimpio);
    this.cargando = true;
    this.authService.login(emailLimpio, passwordLimpia).subscribe({
      next: async (response) => {
        console.log('✓ Login exitoso, respuesta:', response);
        console.log('✓ Token disponible:', !!this.authService.obtenerToken());

        // Si hay biometría disponible y aún no hemos guardado credenciales,
        // ofrecer activar el acceso rápido antes de continuar
        if (this.biometriaDisponible && !this.mostrarBotonBiometria) {
          this.credencialesParaGuardar = { email: emailLimpio, password: passwordLimpia };
          this.mostrarModalActivarBiometria = true;
          this.cargando = false;
          this.cdr.detectChanges();
          return;
        }

        this.continuarTrasLogin(emailLimpio);
      },
      error: (error) => {
        this.cargando = false;
        console.error('✗ Error en login:', error);
        console.error('  Status:', error.status);
        console.error('  Mensaje:', error.error);

        // Backend no disponible / sin conexión: status 0 (error de red) o 5xx
        if (error.status === 0 || error.status >= 500) {
          this.flash.mostrar('⚠️ No se puede conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.', 'error');
          return;
        }

        const mensaje = error.error?.error || error.message || 'Error en el login';
        console.log('Mensaje procesado:', mensaje);

        // Si el email no está registrado, mostrar modal especial
        const esEmailNoRegistrado = mensaje &&
                                     (mensaje.includes('Este email no está registrado') ||
                                      mensaje.includes('email no está registrado'));

        // Si la contraseña es incorrecta
        const esContraseñaIncorrecta = mensaje &&
                                       (mensaje.includes('Contraseña incorrecta') ||
                                        mensaje.includes('contraseña incorrecta'));

        if (esEmailNoRegistrado) {
          this.emailNoExiste = this.email.trim();
          this.mostrarModalEmailNoExiste = true;
          this.cdr.detectChanges();
          this.flash.mostrar('📧 ' + mensaje, 'error');
        } else if (esContraseñaIncorrecta) {
          // Limpiar contraseña pero mantener email
          this.password = '';
          this.mostrarModalPasswordIncorrecto = true;
          this.cdr.detectChanges();
          this.flash.mostrar('🔐 Contraseña incorrecta', 'error');
        } else {
          this.flash.mostrar(mensaje, 'error');
        }
      }
    });
  }

  /** Continúa el flujo tras un login correcto: carga inicial de datos y navegación */
  private continuarTrasLogin(email: string): void {
    localStorage.setItem('ultimo_email', email);
    this.cargando = true;
    this.iniciarAnimacionCarga();

    // Cargar datos iniciales (alimentos, raciones, calendario).
    // timeout: si tarda demasiado, navegamos igualmente y cada pantalla
    // cargará sus propios datos (evita que el overlay se quede colgado).
    this.syncService.cargarDatosIniciales().pipe(timeout(15000)).subscribe({
      next: () => this.completarYNavegar(),
      error: () => this.completarYNavegar()
    });
  }

  /** Activar el acceso rápido: el usuario aceptó guardar sus credenciales tras el modal */
  async activarBiometria(): Promise<void> {
    if (!this.credencialesParaGuardar) return;
    const { email, password } = this.credencialesParaGuardar;
    await this.biometricAuthService.guardarCredenciales(email, password);
    this.mostrarBotonBiometria = true;
    this.mostrarModalActivarBiometria = false;
    this.credencialesParaGuardar = null;
    this.continuarTrasLogin(email);
  }

  /** El usuario rechazó activar el acceso rápido esta vez */
  rechazarBiometria(): void {
    const email = this.credencialesParaGuardar?.email || this.email.trim();
    this.mostrarModalActivarBiometria = false;
    this.credencialesParaGuardar = null;
    this.continuarTrasLogin(email);
  }

  /** Botón "Entrar con Face ID/Touch ID" en la pantalla de login */
  async entrarConBiometria(): Promise<void> {
    try {
      await this.biometricAuthService.confirmar('Confirma tu identidad para entrar en FoodGestor');
    } catch {
      // Usuario canceló o falló la verificación: se queda en la pantalla normal
      return;
    }

    const credenciales = await this.biometricAuthService.obtenerCredenciales();
    if (!credenciales) {
      this.mostrarBotonBiometria = false;
      this.cdr.detectChanges();
      return;
    }

    this.cargando = true;
    this.cdr.detectChanges();
    this.authService.login(credenciales.email, credenciales.password).subscribe({
      next: () => this.continuarTrasLogin(credenciales.email),
      error: () => {
        this.cargando = false;
        // Las credenciales guardadas ya no son válidas (p.ej. contraseña cambiada)
        this.biometricAuthService.borrarCredenciales();
        this.mostrarBotonBiometria = false;
        this.flash.mostrar('Tu acceso rápido guardado ya no es válido, inicia sesión de nuevo', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  cerrarModalEmailNoExiste(): void {
    this.mostrarModalEmailNoExiste = false;
    this.emailNoExiste = '';
  }

  cerrarModalPassword(): void {
    this.mostrarModalPasswordIncorrecto = false;
  }

  irARegistro(): void {
    this.cerrarModalEmailNoExiste();
    this.router.navigate(['/registro'], {
      queryParams: { email: this.email }
    });
  }

  intentarDeNuevo(): void {
    this.cerrarModalEmailNoExiste();
    this.email = '';
    this.password = '';
  }

  abrirOlvidePassword(): void {
    this.emailReset = this.email;
    this.resetEnviado = false;
    this.mostrarModalOlvidePassword = true;
  }

  cerrarOlvidePassword(): void {
    this.mostrarModalOlvidePassword = false;
    this.emailReset = '';
    this.resetEnviado = false;
  }

  enviarReset(): void {
    const emailLimpio = this.emailReset.trim();
    if (!emailLimpio) return;
    this.cargandoReset = true;
    this.authService.solicitarReset(emailLimpio).subscribe({
      next: () => {
        this.cargandoReset = false;
        this.resetEnviado = true;
      },
      error: () => {
        this.cargandoReset = false;
        this.resetEnviado = true; // Igual mostramos éxito por seguridad
      }
    });
  }

}
