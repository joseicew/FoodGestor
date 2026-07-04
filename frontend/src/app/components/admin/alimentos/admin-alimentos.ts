import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlimentosService } from '../../../services/alimentos';
import { BusquedaAlimentoComponent } from '../../shared/busqueda-alimento/busqueda-alimento';
import { AlimentoDetalle } from '../../alimentos/detalle/alimento-detalle';

@Component({
  selector: 'app-admin-alimentos',
  standalone: true,
  imports: [CommonModule, BusquedaAlimentoComponent, AlimentoDetalle],
  template: `
    <div class="admin-alimentos">
      <h2>Alimentos</h2>
      <p class="ayuda">Busca por nombre, marca o código de barras. Haz click en un alimento para ver y editar todos sus datos e ingredientes.</p>

      @if (mensaje) {
        <div class="aviso" [class.error]="esError">{{ mensaje }}</div>
      }

      @if (cargando) {
        <p class="estado">Cargando alimentos...</p>
      } @else {
        <app-busqueda-alimento
          [alimentos]="alimentos"
          [mostrarTodos]="true"
          (seleccionar)="seleccionar($event)">
        </app-busqueda-alimento>
      }

      @if (seleccionado) {
        <app-alimento-detalle
          [alimento]="seleccionado"
          [editable]="true"
          (cerrar)="cerrar()"
          (guardado)="onGuardado()"
          (eliminado)="onEliminado()"
          (mensaje)="onMensaje($event)">
        </app-alimento-detalle>
      }
    </div>
  `,
  styles: [`
    .admin-alimentos h2 { font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 0 0 6px; }
    .ayuda { color: var(--text-secondary); font-size: 13px; margin: 0 0 16px; }
    .estado { color: var(--text-secondary); }
    .aviso { padding: 10px 14px; border-radius: 8px; background: var(--success-light); color: var(--success); font-size: 14px; font-weight: 600; margin-bottom: 12px; }
    .aviso.error { background: var(--error-light); color: var(--error); }
  `]
})
export class AdminAlimentosComponent implements OnInit {
  alimentos: any[] = [];
  seleccionado: any = null;
  cargando = true;
  mensaje = '';
  esError = false;

  constructor(private alimentosService: AlimentosService) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.alimentosService.obtenerAlimentos().subscribe({
      next: (data) => { this.alimentos = data; this.cargando = false; },
      error: () => { this.cargando = false; this.mostrar('Error al cargar alimentos', true); }
    });
  }

  seleccionar(alimento: any): void {
    this.seleccionado = alimento;
  }

  cerrar(): void {
    this.seleccionado = null;
  }

  onGuardado(): void {
    this.cerrar();
    this.cargar();
    this.mostrar('Alimento actualizado', false);
  }

  onEliminado(): void {
    this.cerrar();
    this.cargar();
    this.mostrar('Alimento eliminado', false);
  }

  onMensaje(e: { texto: string; tipo: 'exito' | 'error' }): void {
    this.mostrar(e.texto, e.tipo === 'error');
  }

  private mostrar(texto: string, error: boolean): void {
    this.mensaje = texto;
    this.esError = error;
    setTimeout(() => { this.mensaje = ''; }, 4000);
  }
}
