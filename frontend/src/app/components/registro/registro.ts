import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { MensajeFlash } from '../shared/mensaje-flash/mensaje-flash';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MensajeFlash],
  templateUrl: './registro.html',
  styleUrl: './registro.css'
})
export class RegistroComponent implements OnInit {
  @ViewChild(MensajeFlash) flash!: MensajeFlash;

  email: string = '';
  password: string = '';
  confirmPassword: string = '';
  cargando: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Si ya está autenticado, redirigir al perfil
    if (this.authService.estaAutenticado()) {
      this.router.navigate(['/perfil']);
    }

    // Pre-llenar email si viene en query params (desde modal de login)
    this.activatedRoute.queryParams.subscribe(params => {
      if (params['email']) {
        this.email = params['email'];
      }
    });
  }

  registro(): void {
    const emailLimpio = this.email.trim();
    const passwordLimpia = this.password.trim();
    const confirmPasswordLimpia = this.confirmPassword.trim();

    // Validación: email
    if (!emailLimpio) {
      this.flash.mostrar('Por favor ingresa tu email', 'error');
      return;
    }

    // Validación: contraseña
    if (!passwordLimpia) {
      this.flash.mostrar('Por favor ingresa una contraseña', 'error');
      return;
    }

    // Validación: confirmación de contraseña
    if (!confirmPasswordLimpia) {
      this.flash.mostrar('Por favor confirma tu contraseña', 'error');
      return;
    }

    // Validación: email válido (formato)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailLimpio)) {
      this.flash.mostrar('Email inválido (debe contener @ y un dominio)', 'error');
      return;
    }

    // Validación: contraseñas coinciden
    if (passwordLimpia !== confirmPasswordLimpia) {
      this.flash.mostrar('Las contraseñas no coinciden', 'error');
      return;
    }

    // Validación: contraseña fuerte (mínimo 8 caracteres)
    if (passwordLimpia.length < 8) {
      this.flash.mostrar('La contraseña debe tener al menos 8 caracteres', 'error');
      return;
    }

    // Validación: contraseña contiene mayúscula, minúscula y número
    const tieneNumero = /[0-9]/.test(passwordLimpia);
    const tieneMayuscula = /[A-Z]/.test(passwordLimpia);
    const tieneMinuscula = /[a-z]/.test(passwordLimpia);

    if (!tieneNumero || !tieneMayuscula || !tieneMinuscula) {
      this.flash.mostrar(
        'La contraseña debe contener mayúscula, minúscula y número',
        'error'
      );
      return;
    }

    this.cargando = true;

    // Registro sin datos de onboarding (se rellena después)
    this.authService.registro(emailLimpio, passwordLimpia, {}).subscribe({
      next: (response) => {
        // Redirigir inmediatamente al onboarding
        this.router.navigate(['/onboarding']);
      },
      error: (error) => {
        this.cargando = false;
        const mensaje =
          error.error?.error || 'Error en el registro (email podría estar en uso)';
        this.flash.mostrar(mensaje, 'error');
      }
    });
  }

}
