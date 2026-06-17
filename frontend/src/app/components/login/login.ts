import { Component, OnInit, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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
export class LoginComponent implements OnInit {
  @ViewChild(MensajeFlash) flash!: MensajeFlash;

  email: string = '';
  password: string = '';
  cargando: boolean = false;
  mostrarModalEmailNoExiste: boolean = false;
  emailNoExiste: string = '';
  mostrarModalPasswordIncorrecto: boolean = false;

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

        // Cargar datos iniciales (alimentos, raciones, calendario)
        this.syncService.cargarDatosIniciales().subscribe({
          next: () => {
            console.log('✓ Redirigiendo a /perfil...');
            this.router.navigate(['/perfil']);
          },
          error: (err) => {
            console.error('⚠️ Error cargando datos iniciales, pero continuando:', err);
            // Continuar a perfil incluso si hay error
            this.router.navigate(['/perfil']);
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

}
