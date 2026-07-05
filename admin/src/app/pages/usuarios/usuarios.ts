import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, UsuarioAdmin } from '../../services/api';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="page-head">
      <h2>Usuarios</h2>
      <p>Gestiona los roles de los usuarios. Solo el superadministrador puede cambiar roles.</p>
    </header>

    @if (mensaje) { <div class="aviso" [class.error]="esError">{{ mensaje }}</div> }

    <div class="filtros">
      <input class="buscador" type="text" [(ngModel)]="termino" (ngModelChange)="filtrar()"
             placeholder="Buscar por email o nombre..." autocomplete="off" />
      <select [(ngModel)]="filtroRol" (ngModelChange)="filtrar()">
        <option value="">Todos los roles</option>
        <option value="superadmin">Superadmin</option>
        <option value="admin">Admin</option>
        <option value="usuario">Usuario</option>
        <option value="limitado">Limitado</option>
      </select>
    </div>

    @if (cargando) {
      <p class="estado">Cargando usuarios...</p>
    } @else {
      <p class="conteo">{{ filtrados.length }} resultado(s)</p>
      <div class="card tabla-card">
        <table class="tabla">
          <thead>
            <tr><th>Email</th><th>Nombre</th><th>Rol</th></tr>
          </thead>
          <tbody>
            @for (u of filtrados; track u.id) {
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
                    <span class="badge" [class.badge-primary]="u.rol === 'superadmin'">{{ u.rol }}</span>
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="3" class="vacio-fila">Sin resultados</td></tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: [`
    .page-head { margin-bottom: 20px; }
    .page-head h2 { font-size: 22px; font-weight: 700; }
    .page-head p { color: var(--text-muted); margin: 4px 0 0; }
    .estado, .conteo { color: var(--text-muted); font-size: 13px; }
    .aviso { margin-bottom: 16px; }
    .filtros { display: flex; gap: 10px; margin-bottom: 12px; }
    .buscador { flex: 1; }
    .filtros select { min-width: 160px; }
    .conteo { margin: 0 0 8px; }
    .tabla-card { overflow: hidden; }
    .tabla { width: 100%; border-collapse: collapse; }
    .tabla th, .tabla td { text-align: left; padding: 13px 18px; border-bottom: 1px solid var(--border); }
    .tabla th { background: var(--surface-2); font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px; color: var(--text-muted); }
    .tabla tr:last-child td { border-bottom: none; }
    .tabla select { min-width: 130px; }
    .vacio-fila { text-align: center; color: var(--text-muted); padding: 24px; }
  `]
})
export class UsuariosComponent implements OnInit {
  usuarios: UsuarioAdmin[] = [];
  filtrados: UsuarioAdmin[] = [];
  termino = '';
  filtroRol = '';
  cargando = true;
  guardandoId: number | null = null;
  mensaje = '';
  esError = false;

  constructor(private api: ApiService, private auth: AuthService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.api.listarUsuarios().subscribe({
      next: (res) => {
        this.usuarios = res.usuarios;
        this.filtrar();
        this.cargando = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.cargando = false;
        this.mostrar(err.error?.error || 'Error al cargar usuarios', true);
      }
    });
  }

  private norm(s: string): string {
    return (s || '').toString().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  }

  filtrar(): void {
    const t = this.norm(this.termino.trim());
    const palabras = t.split(/\s+/).filter(Boolean);
    this.filtrados = this.usuarios.filter((u) => {
      if (this.filtroRol && u.rol !== this.filtroRol) return false;
      if (palabras.length === 0) return true;
      const texto = this.norm(`${u.email || ''} ${u.nombre_completo || ''}`);
      return palabras.every((p) => texto.includes(p));
    });
  }

  puedeEditar(u: UsuarioAdmin): boolean {
    return this.auth.esSuperadmin() && u.id !== this.auth.perfil?.id && u.rol !== 'superadmin';
  }

  cambiarRol(u: UsuarioAdmin, nuevoRol: string): void {
    if (nuevoRol === u.rol) return;
    const anterior = u.rol;
    this.guardandoId = u.id;
    this.api.cambiarRol(u.id, nuevoRol).subscribe({
      next: () => { u.rol = nuevoRol; this.guardandoId = null; this.mostrar(`Rol de ${u.email} → ${nuevoRol}`, false); },
      error: (err) => { u.rol = anterior; this.guardandoId = null; this.mostrar(err.error?.error || 'No se pudo cambiar el rol', true); }
    });
  }

  private mostrar(t: string, e: boolean): void {
    this.mensaje = t; this.esError = e;
    this.cdr.markForCheck();
    setTimeout(() => { this.mensaje = ''; this.cdr.markForCheck(); }, 4000);
  }
}
