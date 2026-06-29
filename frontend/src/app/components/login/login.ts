import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { timeout } from 'rxjs/operators';
import { MensajeFlash } from '../shared/mensaje-flash/mensaje-flash';
import { AuthService } from '../../services/auth';
import { SyncService } from '../../services/sync';

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

  constructor(
    private authService: AuthService,
    private syncService: SyncService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Si ya está autenticado, redirigir al perfil
    if (this.authService.estaAutenticado()) {
      this.router.navigate(['/perfil']);
    }
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
      next: (response) => {
        console.log('✓ Login exitoso, respuesta:', response);
        console.log('✓ Token disponible:', !!this.authService.obtenerToken());
        console.log('🔄 Cargando datos iniciales...');

        // Mostrar overlay animado mientras se cargan los datos del backend
        this.iniciarAnimacionCarga();

        // Cargar datos iniciales (alimentos, raciones, calendario).
        // timeout: si tarda demasiado, navegamos igualmente y cada pantalla
        // cargará sus propios datos (evita que el overlay se quede colgado).
        this.syncService.cargarDatosIniciales().pipe(timeout(15000)).subscribe({
          next: () => {
            console.log('✓ Redirigiendo a /perfil...');
            this.completarYNavegar();
          },
          error: (err) => {
            console.error('⚠️ Error/timeout cargando datos iniciales, continuando:', err);
            // Continuar a perfil incluso si hay error o timeout (la barra se completa)
            this.completarYNavegar();
          }
        });
      },
      error: (error) => {
        this.cargando = false;
        console.error('✗ Error en login:', error);
        console.error('  Status:', error.status);
        console.error('  Mensaje:', error.error);

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
