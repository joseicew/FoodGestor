import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ChangeDetectorRef, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';
import { IngredienteModalComponent, IngredienteModalResultado } from '../ingrediente-modal/ingrediente-modal';
import { CATEGORIAS_ALIMENTO, UNIDADES_COMUNES, MACROS_ALIMENTO } from '../../constants/alimento-constants';

@Component({
  selector: 'app-alimento-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IngredienteModalComponent],
  template: `
    <div class="modal-overlay" (click)="onCerrar()">
      <div class="card modal-box" (click)="$event.stopPropagation()">
        @if (cargando) {
          <p class="estado">Cargando alimento...</p>
        } @else if (!alimento) {
          <p class="estado">No se encontró el alimento.</p>
          <button class="btn" (click)="onCerrar()">Cerrar</button>
        } @else {
          <div class="modal-head">
            <h3>Ficha del alimento</h3>
            <button class="btn-close" (click)="onCerrar()">✕</button>
          </div>

          @if (mensaje) { <div class="aviso" [class.error]="esError">{{ mensaje }}</div> }

          <section [class.resaltada]="esSeccionResaltada('datos')" data-seccion="datos">
            <h4>Datos</h4>
            <div class="campos">
              <label class="campo full"><span>Nombre</span><input [(ngModel)]="edit.nombre" /></label>
              <label class="campo"><span>Marca</span><input [(ngModel)]="edit.marca" /></label>
              <label class="campo">
                <span>Categoría</span>
                <select [(ngModel)]="edit.categoria">
                  <option value="">-- Seleccionar --</option>
                  @for (c of categorias; track c) { <option [value]="c">{{ c }}</option> }
                </select>
              </label>
              <label class="campo"><span>Código de barras</span><input [(ngModel)]="edit.codigo_barras" /></label>
              <label class="campo"><span>Peso unidad (g)</span><input type="number" [(ngModel)]="edit.peso_unidad" /></label>
              <label class="campo">
                <span>Nombre unidad</span>
                <select [(ngModel)]="edit.nombre_unidad">
                  <option value="">Seleccionar</option>
                  @for (u of unidadesComunes; track u) { <option [value]="u">{{ u }}</option> }
                </select>
              </label>
              <label class="campo full"><span>Descripción</span><input [(ngModel)]="edit.descripcion" /></label>
            </div>
          </section>

          <section [class.resaltada]="esSeccionResaltada('macros')" data-seccion="macros">
            <h4>Macronutrientes (por 100g)</h4>
            <div class="campos macros">
              @for (m of macros; track m.key) {
                <label class="campo"><span>{{ m.label }}</span><input type="number" [ngModel]="edit[m.key]" (ngModelChange)="edit[m.key] = $event" /></label>
              }
            </div>
          </section>

          <section [class.resaltada]="esSeccionResaltada('ingredientes')" data-seccion="ingredientes">
            <h4>Ingredientes ({{ edit.ingredientes.length }})</h4>
            <div class="chips">
              @for (ing of edit.ingredientes; track $index) {
                <span class="chip">
                  <button class="chip-nombre" type="button" (click)="abrirIngrediente(ing)" title="Editar este ingrediente">{{ ing }}</button>
                  <button class="chip-quitar" type="button" (click)="quitarIngrediente($index)" title="Quitar de este alimento">✕</button>
                </span>
              }
              @if (edit.ingredientes.length === 0) { <span class="sin">Sin ingredientes</span> }
            </div>
            <p class="chips-ayuda">Haz click en un ingrediente para editarlo directamente.</p>
            <div class="add-ing">
              <div class="add-ing-buscador">
                <input [(ngModel)]="nuevoIngrediente" (ngModelChange)="onBuscarIngrediente()"
                       (keyup.enter)="agregarIngrediente()" (blur)="ocultarSugerenciasConRetraso()"
                       placeholder="Buscar o añadir ingrediente..." autocomplete="off" />
                @if (sugerenciasIngrediente.length) {
                  <div class="sugerencias-ingrediente">
                    @for (s of sugerenciasIngrediente; track s) {
                      <button type="button" class="sugerencia-item" (mousedown)="seleccionarSugerencia(s)">{{ s }}</button>
                    }
                  </div>
                }
              </div>
              <button class="btn" (click)="agregarIngrediente()">Añadir</button>
            </div>
          </section>

          <div class="acciones">
            <button class="btn" (click)="onCerrar()" [disabled]="guardando">Cerrar</button>
            <button class="btn btn-primary" (click)="guardar()" [disabled]="guardando">{{ guardando ? 'Guardando...' : 'Guardar cambios' }}</button>
          </div>
        }
      </div>
    </div>

    @if (ingredienteModalId) {
      <app-ingrediente-modal
        [ingredienteId]="ingredienteModalId"
        (cerrar)="cerrarIngredienteModal()"
        (cambiado)="onIngredienteCambiado($event)">
      </app-ingrediente-modal>
    }
  `,
  styles: [`
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1200; padding: 20px; }
    .modal-box { width: 100%; max-width: 620px; max-height: 90vh; overflow-y: auto; padding: 22px; display: flex; flex-direction: column; gap: 6px; }
    .modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
    .modal-head h3 { font-size: 17px; font-weight: 700; }
    .btn-close { background: none; border: none; font-size: 18px; color: var(--text-muted); cursor: pointer; padding: 4px 8px; }
    .estado { color: var(--text-muted); font-size: 13px; }
    .aviso { padding: 10px 14px; border-radius: 8px; background: var(--primary-soft); color: var(--primary-dark); font-size: 13px; font-weight: 600; margin-bottom: 8px; }
    .aviso.error { background: var(--danger-soft); color: var(--danger); }
    section { padding: 12px 0; border-top: 1px solid var(--border); }
    section h4 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px; color: var(--text-muted); margin-bottom: 10px; }
    section.resaltada { background: var(--warning-soft); border: 1px solid var(--warning); border-radius: 8px; padding: 12px; margin: 4px 0; }
    section.resaltada h4 { color: var(--warning); }
    .campos { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .campos.macros { grid-template-columns: repeat(3, 1fr); }
    .campo { display: flex; flex-direction: column; gap: 4px; }
    .campo.full { grid-column: 1 / -1; }
    .campo span { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 4px; }
    .chip { display: inline-flex; align-items: center; gap: 2px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 16px; padding: 2px 4px; font-size: 13px; }
    .chip-nombre { border: none; background: none; color: var(--text); font-size: 13px; cursor: pointer; padding: 2px 4px; border-radius: 12px; }
    .chip-nombre:hover { background: var(--primary-soft); color: var(--primary-dark); text-decoration: underline; }
    .chip-quitar { border: none; background: none; color: var(--danger); font-size: 12px; cursor: pointer; padding: 2px 6px; }
    .chips-ayuda { margin: 0 0 8px; font-size: 12px; color: var(--text-muted); }
    .sin { color: var(--text-muted); font-size: 13px; }
    .add-ing { display: flex; gap: 8px; }
    .add-ing-buscador { position: relative; flex: 1; }
    .add-ing-buscador input { width: 100%; }
    .sugerencias-ingrediente {
      position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 10;
      background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
      box-shadow: var(--shadow); max-height: 220px; overflow-y: auto; padding: 4px;
    }
    .sugerencia-item {
      display: block; width: 100%; text-align: left; border: none; background: none;
      padding: 7px 10px; font-size: 13px; color: var(--text); cursor: pointer; border-radius: 6px;
    }
    .sugerencia-item:hover { background: var(--primary-soft); color: var(--primary-dark); }
    .acciones { display: flex; gap: 10px; justify-content: flex-end; padding-top: 14px; border-top: 1px solid var(--border); }
    @media (max-width: 600px) { .campos, .campos.macros { grid-template-columns: 1fr 1fr; } }
  `]
})
export class AlimentoModalComponent implements OnChanges {
  @Input() alimentoId!: number;
  // Secciones a resaltar/enfocar al abrir (p.ej. desde un reporte de error: 'macros', 'ingredientes', 'datos')
  @Input() seccionesResaltadas: string[] = [];
  @Output() cerrar = new EventEmitter<void>();
  @Output() guardado = new EventEmitter<any>();

  cargando = true;
  alimento: any = null;
  edit: any = { ingredientes: [] };
  nuevoIngrediente = '';
  guardando = false;

  // Cache de nombres de ingredientes existentes, para sugerir en vez de
  // dejar que se escriba a mano y se acabe creando un duplicado por una
  // diferencia minima de texto. Compartida entre instancias del modal
  // (static) para no volver a pedir ~3000 ingredientes cada vez que se abre.
  private static ingredientesCache: string[] | null = null;
  todosIngredientes: string[] = [];
  sugerenciasIngrediente: string[] = [];

  ingredienteModalId: number | null = null;

  mensaje = '';
  esError = false;

  readonly macros = MACROS_ALIMENTO;
  readonly categorias = CATEGORIAS_ALIMENTO;
  readonly unidadesComunes = UNIDADES_COMUNES;

  constructor(private api: ApiService, private cdr: ChangeDetectorRef, private elRef: ElementRef<HTMLElement>) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['alimentoId'] && this.alimentoId) {
      this.cargar();
    }
  }

  private cargar(): void {
    this.cargando = true;
    this.alimento = null;
    this.api.obtenerAlimento(this.alimentoId).subscribe({
      next: (a) => {
        this.alimento = a;
        this.edit = { ...a, ingredientes: Array.isArray(a.ingredientes) ? [...a.ingredientes] : [] };
        this.cargando = false;
        this.cdr.markForCheck();
        setTimeout(() => this.enfocarSeccionResaltada(), 0);
      },
      error: () => { this.cargando = false; this.cdr.markForCheck(); }
    });
    this.cargarNombresIngredientes();
  }

  private cargarNombresIngredientes(): void {
    if (AlimentoModalComponent.ingredientesCache) {
      this.todosIngredientes = AlimentoModalComponent.ingredientesCache;
      return;
    }
    this.api.listarIngredientes().subscribe({
      next: (lista) => {
        const nombres = lista.map((i: any) => i.nombre);
        AlimentoModalComponent.ingredientesCache = nombres;
        this.todosIngredientes = nombres;
      },
      error: () => {}
    });
  }

  onBuscarIngrediente(): void {
    const termino = this.nuevoIngrediente.trim().toLowerCase();
    if (termino.length < 2) {
      this.sugerenciasIngrediente = [];
      return;
    }
    const yaAgregados = new Set(this.edit.ingredientes.map((n: string) => n.toLowerCase()));
    this.sugerenciasIngrediente = this.todosIngredientes
      .filter((n) => n.toLowerCase().includes(termino) && !yaAgregados.has(n.toLowerCase()))
      .slice(0, 8);
  }

  seleccionarSugerencia(nombre: string): void {
    if (!this.edit.ingredientes.includes(nombre)) this.edit.ingredientes.push(nombre);
    this.nuevoIngrediente = '';
    this.sugerenciasIngrediente = [];
  }

  ocultarSugerenciasConRetraso(): void {
    setTimeout(() => {
      this.sugerenciasIngrediente = [];
      this.cdr.markForCheck();
    }, 150);
  }

  esSeccionResaltada(seccion: string): boolean {
    return this.seccionesResaltadas.includes(seccion);
  }

  private enfocarSeccionResaltada(): void {
    const primera = this.seccionesResaltadas[0];
    if (!primera) return;
    this.elRef.nativeElement.querySelector(`[data-seccion="${primera}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  onCerrar(): void {
    this.cerrar.emit();
  }

  agregarIngrediente(): void {
    const n = this.nuevoIngrediente.trim();
    if (n && !this.edit.ingredientes.includes(n)) this.edit.ingredientes.push(n);
    this.nuevoIngrediente = '';
    this.sugerenciasIngrediente = [];
  }

  quitarIngrediente(i: number): void {
    this.edit.ingredientes.splice(i, 1);
  }

  // ── Editar un ingrediente directamente desde esta ficha ──
  abrirIngrediente(nombre: string): void {
    this.api.buscarIngredientePorNombre(nombre).subscribe({
      next: (ing) => {
        if (ing) {
          this.ingredienteModalId = ing.id;
          this.cdr.markForCheck();
        } else {
          this.mostrar(`No se encontró el ingrediente "${nombre}"`, true);
        }
      },
      error: () => this.mostrar('Error al buscar el ingrediente', true)
    });
  }

  cerrarIngredienteModal(): void {
    this.ingredienteModalId = null;
  }

  onIngredienteCambiado(evento: IngredienteModalResultado): void {
    const anterior = evento.nombreAnterior;
    if (!anterior) return;
    const idx = this.edit.ingredientes.indexOf(anterior);
    if (idx === -1) return;

    if (evento.tipo === 'eliminado') {
      this.edit.ingredientes.splice(idx, 1);
      this.mostrar(`"${anterior}" eliminado y quitado de este alimento`, false);
      return;
    }

    const nuevoNombre = evento.ingrediente?.nombre;
    if (!nuevoNombre || nuevoNombre === anterior) return;

    if (this.edit.ingredientes.includes(nuevoNombre)) {
      this.edit.ingredientes.splice(idx, 1);
    } else {
      this.edit.ingredientes[idx] = nuevoNombre;
    }
    this.mostrar(`"${anterior}" ahora es "${nuevoNombre}" en este alimento`, false);
  }

  guardar(): void {
    if (!this.alimento) return;
    this.guardando = true;
    const datos: Record<string, any> = {
      nombre: this.edit.nombre ?? '',
      marca: this.edit.marca ?? '',
      descripcion: this.edit.descripcion ?? '',
      categoria: this.edit.categoria ?? '',
      codigo_barras: this.edit.codigo_barras ?? '',
      peso_unidad: this.edit.peso_unidad ?? '',
      nombre_unidad: this.edit.nombre_unidad ?? '',
      ingredientes: JSON.stringify(this.edit.ingredientes || []),
    };
    for (const m of this.macros) {
      if (this.edit[m.key] !== null && this.edit[m.key] !== undefined && this.edit[m.key] !== '') {
        datos[m.key] = this.edit[m.key];
      }
    }
    this.api.actualizarAlimento(this.alimento.id, datos).subscribe({
      next: (res: any) => {
        const actualizado = res.alimento || this.edit;
        Object.assign(this.alimento, actualizado);
        this.guardando = false;
        this.mostrar('Alimento actualizado', false);
        this.guardado.emit(actualizado);
      },
      error: (err) => { this.guardando = false; this.mostrar(err.error?.error || 'No se pudo guardar', true); }
    });
  }

  private mostrar(t: string, e: boolean): void {
    this.mensaje = t; this.esError = e;
    this.cdr.markForCheck();
    setTimeout(() => { this.mensaje = ''; this.cdr.markForCheck(); }, 4000);
  }
}
