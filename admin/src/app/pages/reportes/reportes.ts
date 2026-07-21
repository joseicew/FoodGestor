import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, ReporteAlimento } from '../../services/api';
import { AlimentoModalComponent } from '../../components/alimento-modal/alimento-modal';

const ETIQUETAS_CAMPO: Record<string, string> = {
  macros: 'Macros',
  ingredientes: 'Ingredientes',
  marca: 'Marca',
  otro: 'Otro',
};

// A qué sección del editor de alimento corresponde cada "campo" reportado
const SECCION_POR_CAMPO: Record<string, string> = {
  macros: 'macros',
  ingredientes: 'ingredientes',
  marca: 'datos',
};

const ETIQUETAS_MACRO: Record<string, string> = {
  calorias: 'Calorías',
  proteinas: 'Proteínas',
  grasas: 'Grasas',
  grasas_saturadas: 'Grasas saturadas',
  hidratos_carbono: 'Hidratos de carbono',
  azucares: 'Azúcares',
  fibra: 'Fibra',
  sal: 'Sal',
  sodio: 'Sodio',
  potasio: 'Potasio',
  calcio: 'Calcio',
  hierro: 'Hierro',
};

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule, AlimentoModalComponent],
  template: `
    <header class="page-head">
      <h2>Reportes de alimentos</h2>
      <p>Errores reportados por usuarios sobre macros, ingredientes o marca de un alimento.</p>
    </header>

    @if (mensaje) { <div class="aviso" [class.error]="esError">{{ mensaje }}</div> }

    <div class="filtros">
      <select [(ngModel)]="filtroEstado" (ngModelChange)="cargar()">
        <option value="pendiente">Pendientes</option>
        <option value="resuelto">Resueltos</option>
        <option value="descartado">Descartados</option>
        <option value="">Todos</option>
      </select>
    </div>

    @if (cargando) {
      <p class="estado">Cargando reportes...</p>
    } @else if (reportes.length === 0) {
      <div class="card vacio">No hay reportes en este estado.</div>
    } @else {
      <div class="lista">
        @for (r of reportes; track r.id) {
          <div class="card fila">
            <div class="fila-info">
              <div class="fila-cabecera">
                <span class="nombre">{{ r.alimento?.nombre || 'Alimento eliminado' }}</span>
                @if (r.alimento?.marca) { <span class="marca">{{ r.alimento?.marca }}</span> }
                <span class="badge" [class.badge-warning]="r.estado === 'pendiente'"
                      [class.badge-success]="r.estado === 'resuelto'">{{ r.estado }}</span>
              </div>
              <div class="campos">
                @for (c of r.campos; track c) { <span class="badge badge-campo">{{ etiqueta(c) }}</span> }
              </div>
              @if (r.detalle_macros.length) {
                <div class="subdetalle-lista">
                  <strong>Macros:</strong>
                  @for (m of r.detalle_macros; track m.campo) {
                    <span class="corregir-item">
                      {{ etiquetaMacro(m.campo) }}: {{ valorActualMacro(r, m.campo) }} → {{ m.valor || '(sin especificar)' }}
                    </span>
                  }
                </div>
              }
              @if (r.detalle_ingredientes.length) {
                <div class="subdetalle-lista">
                  <strong>Ingredientes:</strong>
                  @for (i of r.detalle_ingredientes; track i.nombre) {
                    <span class="corregir-item">{{ i.nombre }} → {{ i.correccion || '(sin especificar)' }}</span>
                  }
                </div>
              }
              @if (r.marca_correcta) {
                <p class="subdetalle"><strong>Marca correcta:</strong> {{ r.marca_correcta }}</p>
              }
              @if (r.comentario) { <p class="comentario">"{{ r.comentario }}"</p> }
              <p class="meta">{{ r.usuario_email }} · {{ r.created_at | date:'d MMM yyyy, HH:mm' }}</p>
            </div>
            @if (r.estado === 'pendiente') {
              <div class="fila-acciones">
                @if (r.alimento) {
                  <button class="btn" (click)="editarAlimento(r)" [disabled]="actualizandoId === r.id">✏️ Editar alimento</button>
                }
                <button class="btn" (click)="cambiarEstado(r, 'descartado')" [disabled]="actualizandoId === r.id">Descartar</button>
                <button class="btn btn-primary" (click)="cambiarEstado(r, 'resuelto')" [disabled]="actualizandoId === r.id">Marcar resuelto</button>
              </div>
            }
          </div>
        }
      </div>
    }

    @if (alimentoModalId) {
      <app-alimento-modal
        [alimentoId]="alimentoModalId"
        [seccionesResaltadas]="seccionesResaltadas"
        (cerrar)="cerrarAlimentoModal()"
        (guardado)="onAlimentoGuardado($event)">
      </app-alimento-modal>
    }
  `,
  styles: [`
    .page-head { margin-bottom: 16px; }
    .page-head h2 { font-size: 22px; font-weight: 700; }
    .page-head p { color: var(--text-muted); margin: 4px 0 0; }
    .estado { color: var(--text-muted); font-size: 13px; }
    .aviso { margin-bottom: 14px; }
    .filtros { margin-bottom: 16px; }
    .filtros select { min-width: 180px; }
    .lista { display: flex; flex-direction: column; gap: 10px; }
    .fila { padding: 14px 16px; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    .fila-info { display: flex; flex-direction: column; gap: 6px; flex: 1; }
    .fila-cabecera { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .nombre { font-weight: 700; }
    .marca { font-size: 13px; color: var(--text-muted); }
    .campos { display: flex; gap: 6px; flex-wrap: wrap; }
    .badge-campo { background: var(--surface-2); color: var(--text-muted); }
    .badge-warning { background: var(--warning-soft); color: var(--warning); }
    .badge-success { background: var(--primary-soft); color: var(--primary-dark); }
    .subdetalle { margin: 0; font-size: 13px; color: var(--text); }
    .subdetalle-lista { display: flex; flex-direction: column; gap: 2px; font-size: 13px; color: var(--text); }
    .corregir-item { padding-left: 12px; }
    .comentario { margin: 0; font-size: 13px; color: var(--text); font-style: italic; }
    .meta { margin: 0; font-size: 12px; color: var(--text-muted); }
    .fila-acciones { display: flex; gap: 8px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }
    .vacio { padding: 24px; color: var(--text-muted); text-align: center; }
  `]
})
export class ReportesComponent implements OnInit {
  reportes: ReporteAlimento[] = [];
  cargando = true;
  filtroEstado = 'pendiente';
  actualizandoId: number | null = null;
  mensaje = '';
  esError = false;

  alimentoModalId: number | null = null;
  seccionesResaltadas: string[] = [];

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.api.listarReportes(this.filtroEstado || undefined).subscribe({
      next: (reportes) => {
        this.reportes = reportes;
        this.cargando = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.cargando = false;
        this.mostrar('Error al cargar reportes', true);
      }
    });
  }

  etiqueta(campo: string): string {
    return ETIQUETAS_CAMPO[campo] || campo;
  }

  etiquetaMacro(campo: string): string {
    return ETIQUETAS_MACRO[campo] || campo;
  }

  valorActualMacro(reporte: ReporteAlimento, campo: string): string {
    const valor = reporte.alimento?.[campo];
    return valor === null || valor === undefined ? '?' : String(valor);
  }

  // Abre la ficha de edición del alimento reportado, resaltando la(s) sección(es)
  // a la(s) que corresponde el error (macros, ingredientes, datos/marca).
  editarAlimento(reporte: ReporteAlimento): void {
    if (!reporte.alimento) return;
    const secciones = new Set<string>();
    for (const campo of reporte.campos) {
      const seccion = SECCION_POR_CAMPO[campo];
      if (seccion) secciones.add(seccion);
    }
    this.seccionesResaltadas = Array.from(secciones);
    this.alimentoModalId = reporte.alimento.id;
  }

  cerrarAlimentoModal(): void {
    this.alimentoModalId = null;
    this.seccionesResaltadas = [];
  }

  onAlimentoGuardado(actualizado: any): void {
    // Reflejar los nuevos valores en la fila del reporte (para que el diff
    // "valor actual → corrección" se actualice sin recargar toda la lista).
    for (const r of this.reportes) {
      const alimento = r.alimento;
      if (alimento && alimento.id === actualizado?.id) {
        Object.assign(alimento, actualizado);
      }
    }
    this.mostrar('Alimento actualizado. Ya puedes marcar el reporte como resuelto.', false);
    this.cdr.markForCheck();
  }

  cambiarEstado(reporte: ReporteAlimento, estado: string): void {
    this.actualizandoId = reporte.id;
    this.api.actualizarReporte(reporte.id, estado).subscribe({
      next: () => {
        this.actualizandoId = null;
        this.reportes = this.reportes.filter((r) => r.id !== reporte.id);
        this.mostrar(`Reporte marcado como ${estado}`, false);
      },
      error: (err) => {
        this.actualizandoId = null;
        this.mostrar(err.error?.error || 'No se pudo actualizar', true);
      }
    });
  }

  private mostrar(t: string, e: boolean): void {
    this.mensaje = t; this.esError = e;
    this.cdr.markForCheck();
    setTimeout(() => { this.mensaje = ''; this.cdr.markForCheck(); }, 4000);
  }
}
