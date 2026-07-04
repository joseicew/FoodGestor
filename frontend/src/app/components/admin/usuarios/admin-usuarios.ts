import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, UsuarioAdmin } from '../../../services/admin';
import { SessionService } from '../../../services/session';

@Component({
  selector: 'app-admin-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="usuarios-page">
      <h2>Usuarios</h2>

      @if (mensaje) {
        <div class="aviso" [class.error]="esError">{{ mensaje }}</div>
      }

      @if (cargando) {
        <p class="estado">Cargando usuarios...</p>
      } @else if (usuarios.length === 0) {
        <p class="estado">No hay usuarios.</p>
      } @else {
        <div class="tabla-wrap">
          <table class="tabla">
            <thead>
              <tr>
                <th>Email</th>
                <th>Nombre</th>
                <th>Rol</th>
              </tr>
            </thead>
            <tbody>
              @for (u of usuarios; track u.id) {
                <tr>
                  <td>{{ u.email }}</td>
                  <td>{{ u.nombre_completo }}</td>
                  <td>
                    @if (puedeEditar(u)) {
                      <select [ngModel]="u.rol" (ngModelChange)="cambiarRol(u, $event)" [disabled]="guardandoId === u.id">
                        <option value="admin">admin</option>
                        <option value="usuario">usuario</option>
                        <option value="limitado">limitado</option>
                      </select>
                    } @else {
                      <span class="rol-badge" [attr.data-rol]="u.rol">{{ u.rol }}</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (!esSuperadmin) {
          <p class="nota">Solo el superadministrador puede cambiar roles.</p>
        }
      }
    </div>
  `,
  styles: [`
    .usuarios-page h2 { font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 0 0 16px; }
    .estado { color: var(--text-secondary); }
    .aviso { padding: 10px 14px; border-radius: 8px; background: var(--success-light); color: var(--success); font-size: 14px; font-weight: 600; margin-bottom: 12px; }
    .aviso.error { background: var(--error-light); color: var(--error); }
    .tabla-wrap { overflow-x: auto; border: 1px solid var(--border-color); border-radius: 12px; }
    .tabla { width: 100%; border-collapse: collapse; font-size: 14px; }
    .tabla th, .tabla td { text-align: left; padding: 12px 14px; border-bottom: 1px solid var(--border-color); color: var(--text-primary); }
    .tabla th { background: var(--bg-secondary); font-weight: 700; color: var(--text-secondary); text-transform: uppercase; font-size: 12px; letter-spacing: 0.3px; }
    .tabla tr:last-child td { border-bottom: none; }
    .tabla select { padding: 6px 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-primary); font-size: 13px; }
    .rol-badge { font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 10px; background: var(--bg-tertiary); color: var(--text-secondary); text-transform: capitalize; }
    .rol-badge[data-rol="superadmin"] { background: var(--primary); color: #fff; }
    .nota { margin-top: 12px; font-size: 13px; color: var(--text-tertiary); }
  `]
})
export class AdminUsuariosComponent implements OnInit {
  usuarios: UsuarioAdmin[] = [];
  cargando = true;
  guardandoId: number | null = null;
  mensaje = '';
  esError = false;

  esSuperadmin = false;
  private miId: number | null = null;

  constructor(private adminService: AdminService, private session: SessionService) {}

  ngOnInit(): void {
    const perfil = this.session.obtenerPerfil();
    this.esSuperadmin = perfil?.rol === 'superadmin';
    this.miId = perfil?.id ?? null;
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.adminService.listarUsuarios().subscribe({
      next: (res) => { this.usuarios = res.usuarios; this.cargando = false; },
      error: (err) => {
        this.cargando = false;
        this.mostrar(err.error?.error || 'Error al cargar usuarios', true);
      }
    });
  }

  /** Solo el superadmin puede editar, y no su propio rol ni el de otro superadmin */
  puedeEditar(u: UsuarioAdmin): boolean {
    return this.esSuperadmin && u.id !== this.miId && u.rol !== 'superadmin';
  }

  cambiarRol(u: UsuarioAdmin, nuevoRol: string): void {
    if (nuevoRol === u.rol) return;
    const rolAnterior = u.rol;
    this.guardandoId = u.id;
    this.adminService.cambiarRol(u.id, nuevoRol).subscribe({
      next: () => {
        u.rol = nuevoRol;
        this.guardandoId = null;
        this.mostrar(`Rol de ${u.email} cambiado a ${nuevoRol}`, false);
      },
      error: (err) => {
        u.rol = rolAnterior; // revertir
        this.guardandoId = null;
        this.mostrar(err.error?.error || 'No se pudo cambiar el rol', true);
      }
    });
  }

  private mostrar(texto: string, error: boolean): void {
    this.mensaje = texto;
    this.esError = error;
    setTimeout(() => { this.mensaje = ''; }, 4000);
  }
}
