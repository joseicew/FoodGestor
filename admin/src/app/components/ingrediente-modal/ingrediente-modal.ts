import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';

export interface IngredienteModalResultado {
  tipo: 'actualizado' | 'eliminado' | 'fusionado';
  ingrediente?: any;
  nombreAnterior?: string;
}

@Component({
  selector: 'app-ingrediente-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="onCerrar()">
      <div class="card modal-box" (click)="$event.stopPropagation()">
        @if (cargando) {
          <p class="estado">Cargando ingrediente...</p>
        } @else if (!ingrediente) {
          <p class="estado">No se encontró el ingrediente.</p>
          <button class="btn" (click)="onCerrar()">Cerrar</button>
        } @else {
          <div class="modal-head">
            <h3>Editar ingrediente</h3>
            <button class="btn-close" (click)="onCerrar()">✕</button>
          </div>

          @if (mensaje) { <div class="aviso" [class.error]="esError">{{ mensaje }}</div> }

          <label class="campo">
            <span>Nombre</span>
            <input type="text" [(ngModel)]="edit.nombre" />
          </label>

          <label class="check">
            <input type="checkbox" [(ngModel)]="edit.es_aditivo" /> Es aditivo
          </label>

          <label class="campo">
            <span>Categoría</span>
            <select [(ngModel)]="edit.categoria">
              <option value="">-- Seleccionar --</option>
              @for (c of categorias; track c) { <option [value]="c">{{ c }}</option> }
            </select>
          </label>

          <label class="campo">
            <span>Descripción</span>
            <textarea rows="3" [(ngModel)]="edit.notas" placeholder="Descripción o explicación"></textarea>
          </label>

          <div class="campo">
            <span>Alimentos que lo usan ({{ cargandoAlimentos ? '...' : alimentosAsociados.length }})</span>
            @if (cargandoAlimentos) {
              <p class="estado">Cargando...</p>
            } @else if (alimentosAsociados.length === 0) {
              <p class="sin-uso">Ningún alimento usa este ingrediente ahora mismo.</p>
            } @else {
              <ul class="alimentos-usan">
                @for (a of alimentosAsociados; track a.id) {
                  <li>
                    <button type="button" class="alimento-link" (click)="verAlimento.emit(a.id)" title="Ver ficha del alimento">
                      {{ a.nombre }} <small>{{ a.marca }}</small>
                    </button>
                  </li>
                }
              </ul>
              <p class="alimentos-ayuda">Haz click en un alimento para ver su ficha.</p>
            }
          </div>

          <div class="acciones">
            <button class="btn btn-danger" (click)="confirmarEliminar = true" [disabled]="guardando || eliminando || fusionando">Eliminar</button>
            <div class="acciones-derecha">
              <button class="btn" (click)="onCerrar()" [disabled]="guardando || eliminando">Cancelar</button>
              <button class="btn btn-primary" (click)="guardar()" [disabled]="guardando || eliminando || !edit.nombre.trim()">
                {{ guardando ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </div>

          @if (confirmarEliminar) {
            <div class="confirm-box">
              <p>
                ¿Eliminar <strong>{{ ingrediente.nombre }}</strong>?
                @if (alimentosAsociados.length > 0) {
                  Se quitará de los {{ alimentosAsociados.length }} alimento(s) que lo usan.
                }
                Esta acción no se puede deshacer.
              </p>
              <div class="confirm-acciones">
                <button class="btn" (click)="confirmarEliminar = false" [disabled]="eliminando">No, cancelar</button>
                <button class="btn btn-danger" (click)="eliminar()" [disabled]="eliminando">{{ eliminando ? 'Eliminando...' : 'Sí, eliminar' }}</button>
              </div>
            </div>
          }

          <div class="fusion-bloque">
            @if (!mostrarFusion) {
              <button class="btn" (click)="abrirFusion()" [disabled]="guardando || eliminando">🔁 Es un duplicado de otro ingrediente...</button>
            } @else {
              <div class="fusion-box">
                <p class="fusion-titulo">Reemplazar <strong>{{ ingrediente.nombre }}</strong> por:</p>

                @if (!fusionDestino) {
                  <input class="fusion-buscador" type="text" [(ngModel)]="fusionTermino" (ngModelChange)="buscarFusion()"
                         placeholder="Buscar el ingrediente correcto..." autocomplete="off" />
                  @if (fusionSugerencias.length > 0) {
                    <ul class="fusion-sugerencias">
                      @for (s of fusionSugerencias; track s.id) {
                        <li (click)="elegirFusionDestino(s)">
                          {{ s.nombre }}
                          @if (s.categoria) { <small>{{ s.categoria }}</small> }
                        </li>
                      }
                    </ul>
                  } @else if (fusionTermino.trim().length > 0) {
                    <p class="fusion-sin-resultados">Sin coincidencias</p>
                  }
                } @else {
                  <div class="fusion-elegido">
                    <span>→ <strong>{{ fusionDestino.nombre }}</strong></span>
                    <button class="btn" (click)="fusionDestino = null">Cambiar</button>
                  </div>
                  <p class="fusion-aviso">
                    Se transferirán los {{ alimentosAsociados.length }} alimento(s) a "{{ fusionDestino.nombre }}",
                    y "{{ ingrediente.nombre }}" se eliminará. No se puede deshacer.
                  </p>
                }

                <div class="confirm-acciones">
                  <button class="btn" (click)="cancelarFusion()" [disabled]="fusionando">Cancelar</button>
                  <button class="btn btn-primary" (click)="confirmarFusion()" [disabled]="!fusionDestino || fusionando">
                    {{ fusionando ? 'Fusionando...' : 'Confirmar fusión' }}
                  </button>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1200; padding: 20px; }
    .modal-box { width: 100%; max-width: 460px; max-height: 90vh; overflow-y: auto; padding: 22px; display: flex; flex-direction: column; gap: 14px; }
    .modal-head { display: flex; align-items: center; justify-content: space-between; }
    .modal-head h3 { font-size: 17px; font-weight: 700; }
    .btn-close { background: none; border: none; font-size: 18px; color: var(--text-muted); cursor: pointer; padding: 4px 8px; }
    .estado { color: var(--text-muted); font-size: 13px; }
    .aviso { padding: 10px 14px; border-radius: 8px; background: var(--primary-soft); color: var(--primary-dark); font-size: 13px; font-weight: 600; }
    .aviso.error { background: var(--danger-soft); color: var(--danger); }
    .check { display: flex; align-items: center; gap: 8px; font-weight: 600; }
    .campo { display: flex; flex-direction: column; gap: 5px; }
    .campo span { font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
    .alimentos-usan { list-style: none; margin: 0; padding: 0; max-height: 140px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
    .alimento-link { display: block; width: 100%; text-align: left; border: none; background: none; padding: 5px 6px; border-radius: 6px; font-size: 13px; color: var(--text); cursor: pointer; }
    .alimento-link:hover { background: var(--primary-soft); color: var(--primary-dark); text-decoration: underline; }
    .alimento-link small { color: var(--text-muted); margin-left: 4px; }
    .alimentos-ayuda { margin: 4px 0 0; font-size: 12px; color: var(--text-muted); }
    .sin-uso { font-size: 13px; color: var(--text-muted); margin: 0; }
    .acciones { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .acciones-derecha { display: flex; gap: 10px; }
    .btn-danger { background: var(--danger-soft); border-color: var(--danger-soft); color: var(--danger); }
    .btn-danger:hover { background: var(--danger); color: #fff; }
    .confirm-box { border: 1px solid var(--danger); background: var(--danger-soft); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
    .confirm-box p { margin: 0; font-size: 13px; color: var(--danger); }
    .confirm-acciones { display: flex; gap: 10px; justify-content: flex-end; }
    .fusion-bloque { border-top: 1px solid var(--border); padding-top: 14px; }
    .fusion-box { display: flex; flex-direction: column; gap: 10px; padding: 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); }
    .fusion-titulo { margin: 0; font-size: 13px; color: var(--text-muted); }
    .fusion-buscador { width: 100%; }
    .fusion-sugerencias { list-style: none; margin: 0; padding: 0; max-height: 160px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
    .fusion-sugerencias li { padding: 8px 12px; cursor: pointer; font-size: 13px; display: flex; justify-content: space-between; gap: 8px; }
    .fusion-sugerencias li:hover { background: var(--primary-soft); }
    .fusion-sugerencias li small { color: var(--text-muted); }
    .fusion-sin-resultados { margin: 0; font-size: 13px; color: var(--text-muted); }
    .fusion-elegido { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 14px; }
    .fusion-aviso { margin: 0; font-size: 12px; color: var(--warning); }
  `]
})
export class IngredienteModalComponent implements OnChanges {
  @Input() ingredienteId!: number;
  @Output() cerrar = new EventEmitter<void>();
  @Output() cambiado = new EventEmitter<IngredienteModalResultado>();
  @Output() verAlimento = new EventEmitter<number>();

  cargando = true;
  ingrediente: any = null;
  edit = { nombre: '', es_aditivo: false, categoria: '', notas: '' };
  guardando = false;
  eliminando = false;
  confirmarEliminar = false;

  alimentosAsociados: { id: number; nombre: string; marca: string }[] = [];
  cargandoAlimentos = false;

  categorias: string[] = [];
  todosIngredientes: any[] = [];

  mostrarFusion = false;
  fusionTermino = '';
  fusionSugerencias: any[] = [];
  fusionDestino: any = null;
  fusionando = false;

  mensaje = '';
  esError = false;

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['ingredienteId'] && this.ingredienteId) {
      this.cargar();
    }
  }

  private cargar(): void {
    this.cargando = true;
    this.ingrediente = null;

    this.api.listarCategoriasIngredientes().subscribe({
      next: (cats) => { this.categorias = cats; this.cdr.markForCheck(); },
      error: () => {}
    });

    this.api.listarIngredientes().subscribe({
      next: (data) => { this.todosIngredientes = data; this.cdr.markForCheck(); },
      error: () => {}
    });

    this.api.obtenerIngrediente(this.ingredienteId).subscribe({
      next: (ing) => {
        this.ingrediente = ing;
        this.edit = {
          nombre: ing.nombre || '',
          es_aditivo: !!ing.es_aditivo,
          categoria: ing.categoria || '',
          notas: ing.notas || ''
        };
        this.cargando = false;
        this.cdr.markForCheck();

        this.cargandoAlimentos = true;
        this.api.alimentosDeIngrediente(this.ingredienteId).subscribe({
          next: (alimentos) => { this.alimentosAsociados = alimentos; this.cargandoAlimentos = false; this.cdr.markForCheck(); },
          error: () => { this.cargandoAlimentos = false; this.cdr.markForCheck(); }
        });
      },
      error: () => { this.cargando = false; this.cdr.markForCheck(); }
    });
  }

  private norm(s: string): string {
    return (s || '').toString().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  }

  onCerrar(): void {
    this.cerrar.emit();
  }

  guardar(): void {
    if (!this.ingrediente) return;
    const nombre = this.edit.nombre.trim();
    if (!nombre) return;

    this.guardando = true;
    const nombreAnterior = this.ingrediente.nombre;
    const payload = {
      nombre,
      es_aditivo: this.edit.es_aditivo,
      categoria: this.edit.categoria.trim(),
      notas: this.edit.notas.trim(),
      verificado: true
    };
    this.api.actualizarIngrediente(this.ingrediente.id, payload).subscribe({
      next: (res: any) => {
        this.guardando = false;
        if (res?.fusionado) {
          this.cambiado.emit({ tipo: 'fusionado', ingrediente: res.ingrediente, nombreAnterior });
        } else {
          this.cambiado.emit({ tipo: 'actualizado', ingrediente: res.ingrediente, nombreAnterior });
        }
        this.cerrar.emit();
      },
      error: (err) => { this.guardando = false; this.mostrar(err.error?.error || 'No se pudo guardar', true); }
    });
  }

  eliminar(): void {
    if (!this.ingrediente) return;
    this.eliminando = true;
    const nombreAnterior = this.ingrediente.nombre;
    this.api.eliminarIngrediente(this.ingrediente.id).subscribe({
      next: () => {
        this.eliminando = false;
        this.cambiado.emit({ tipo: 'eliminado', nombreAnterior });
        this.cerrar.emit();
      },
      error: (err) => { this.eliminando = false; this.mostrar(err.error?.error || 'No se pudo eliminar', true); }
    });
  }

  // ── Fusión ──
  abrirFusion(): void {
    this.mostrarFusion = true;
    this.fusionTermino = '';
    this.fusionSugerencias = [];
    this.fusionDestino = null;
  }

  cancelarFusion(): void {
    this.mostrarFusion = false;
    this.fusionTermino = '';
    this.fusionSugerencias = [];
    this.fusionDestino = null;
  }

  buscarFusion(): void {
    const t = this.norm(this.fusionTermino.trim());
    if (!t) { this.fusionSugerencias = []; return; }
    const palabras = t.split(/\s+/).filter(Boolean);
    this.fusionSugerencias = this.todosIngredientes
      .filter((i) => i.id !== this.ingrediente?.id)
      .filter((i) => {
        const texto = this.norm(`${i.nombre || ''} ${i.categoria || ''}`);
        return palabras.every((p) => texto.includes(p));
      })
      .slice(0, 8);
  }

  elegirFusionDestino(ing: any): void {
    this.fusionDestino = ing;
    this.fusionSugerencias = [];
  }

  confirmarFusion(): void {
    if (!this.ingrediente || !this.fusionDestino) return;
    this.fusionando = true;
    const nombreAnterior = this.ingrediente.nombre;
    const destino = this.fusionDestino;
    this.api.reemplazarIngrediente(this.ingrediente.id, destino.id).subscribe({
      next: (res: any) => {
        this.fusionando = false;
        this.cambiado.emit({ tipo: 'fusionado', ingrediente: res.ingrediente, nombreAnterior });
        this.cerrar.emit();
      },
      error: (err) => { this.fusionando = false; this.mostrar(err.error?.error || 'No se pudo fusionar', true); }
    });
  }

  private mostrar(t: string, e: boolean): void {
    this.mensaje = t; this.esError = e;
    this.cdr.markForCheck();
    setTimeout(() => { this.mensaje = ''; this.cdr.markForCheck(); }, 4000);
  }
}
