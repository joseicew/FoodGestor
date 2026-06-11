import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent implements OnInit {
  email: string = '';
  password: string = '';
  cargando: boolean = false;
  mensaje: string = '';
  mensajeTipo: 'error' | 'exito' = 'error';
  mostrarModalEmailNoExiste: boolean = false;
  emailNoExiste: string = '';
  mostrarModalContraseñaIncorrecta: boolean = false;

  constructor(
    private authService: AuthService,
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
      this.mostrarMensaje('Por favor ingresa tu email', 'error');
      return;
    }

    // Validación de contraseña
    if (!passwordLimpia) {
      this.mostrarMensaje('Por favor ingresa tu contraseña', 'error');
      return;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailLimpio)) {
      this.mostrarMensaje('Email inválido (debe contener @ y un dominio)', 'error');
      return;
    }

    console.log('Intentando login con:', emailLimpio);
    this.cargando = true;
    this.authService.login(emailLimpio, passwordLimpia).subscribe({
      next: (response) => {
        console.log('✓ Login exitoso, respuesta:', response);
        console.log('✓ Token disponible:', !!this.authService.obtenerToken());
        console.log('✓ Redirigiendo a /perfil...');
        // Redirigir inmediatamente al perfil
        this.router.navigate(['/perfil']);
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
          this.mostrarMensaje('📧 ' + mensaje, 'error');
        } else if (esContraseñaIncorrecta) {
          // Limpiar contraseña pero mantener email
          this.password = '';
          this.mostrarModalContraseñaIncorrecta = true;
          this.cdr.detectChanges();
          this.mostrarMensaje('🔐 Contraseña incorrecta', 'error');
        } else {
          this.mostrarMensaje(mensaje, 'error');
        }
      }
    });
  }

  cerrarModalEmailNoExiste(): void {
    this.mostrarModalEmailNoExiste = false;
    this.emailNoExiste = '';
  }

  cerrarModalContraseñaIncorrecta(): void {
    this.mostrarModalContraseñaIncorrecta = false;
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

  private mostrarMensaje(texto: string, tipo: 'error' | 'exito'): void {
    this.mensaje = texto;
    this.mensajeTipo = tipo;
    setTimeout(() => {
      this.mensaje = '';
    }, 4000);
  }
}
