import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MensajeFlash } from '../shared/mensaje-flash/mensaje-flash';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MensajeFlash],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css'
})
export class ResetPasswordComponent implements OnInit {
  @ViewChild(MensajeFlash) flash!: MensajeFlash;

  token: string = '';
  nuevaPassword: string = '';
  confirmarPassword: string = '';
  cargando: boolean = false;
  exito: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    if (!this.token) {
      this.router.navigate(['/login']);
    }
  }

  resetear(): void {
    if (this.nuevaPassword !== this.confirmarPassword) {
      this.flash.mostrar('Las contraseñas no coinciden', 'error');
      return;
    }
    if (this.nuevaPassword.length < 6) {
      this.flash.mostrar('La contraseña debe tener al menos 6 caracteres', 'error');
      return;
    }

    this.cargando = true;
    this.authService.resetearPassword(this.token, this.nuevaPassword).subscribe({
      next: () => {
        this.exito = true;
        this.cargando = false;
        setTimeout(() => this.router.navigate(['/login']), 2500);
      },
      error: (err) => {
        this.cargando = false;
        this.flash.mostrar(err.error?.error || 'Error al restablecer la contraseña', 'error');
      }
    });
  }
}
