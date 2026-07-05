import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from '../../services/api';

@Component({
  selector: 'app-ingredientes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="page-head">
      <h2>Ingredientes</h2>
      <p>Busca un ingrediente y edítalo: nombre, si es aditivo, su categoría y su descripción. También puedes seleccionar varios para eliminarlos a la vez.</p>
    </header>

    @if (mensaje) { <div class="aviso" [class.error]="esError">{{ mensaje }}</div> }

    <div class="filtros">
      <input class="buscador" type="text" [(ngModel)]="termino" (ngModelChange)="filtrar()"
             placeholder="Buscar por nombre o categoría..." autocomplete="off" />
      <select [(ngModel)]="filtroCategoria" (ngModelChange)="filtrar()">
        <option value="">Todas las categorías</option>
        <option value="__sin__">Sin categoría</option>
        @for (c of categorias; track c) { <option [value]="c">{{ c }}</option> }
      </select>
      <select [(ngModel)]="filtroAditivo" (ngModelChange)="filtrar()">
        <option value="">Aditivo: todos</option>
        <option value="si">Solo aditivos</option>
        <option value="no">Sin aditivos</option>
      </select>
    </div>

    @if (cargando) {
      <p class="estado">Cargando ingredientes...</p>
    } @else {
      <div class="grid">
        <div class="card lista-card">
          <div class="lista-cabecera">
            <label class="check-modo">
              <input type="checkbox" [ngModel]="modoSeleccion" (ngModelChange)="toggleModoSeleccion($event)" />
              Selección múltiple
            </label>
            <p class="conteo">{{ filtrados.length }} resultado(s){{ filtrados.length > limite ? ' · mostrando ' + limite : '' }}</p>
          </div>

          @if (modoSeleccion) {
            <div class="barra-seleccion">
              <label class="check-todos">
                <input type="checkbox" [checked]="todosVisiblesSeleccionados()" (change)="toggleSeleccionarTodos()" />
                Seleccionar todos los visibles
              </label>
              <span class="sel-count">{{ seleccionIds.size }} seleccionado(s)</span>
              <button class="btn btn-danger" (click)="confirmarEliminarMasivo = true" [disabled]="seleccionIds.size === 0 || eliminandoMasivo">
                Eliminar seleccionados
              </button>
            </div>
          }

          <div class="lista">
            @for (ing of filtrados.slice(0, limite); track ing.id) {
              <button class="row" [class.sel]="seleccionado?.id === ing.id" (click)="onClickFila(ing)">
                @if (modoSeleccion) {
                  <input type="checkbox" class="row-check" [checked]="seleccionIds.has(ing.id)"
                         (click)="$event.stopPropagation()" (change)="toggleSeleccion(ing.id)" />
                }
                <span class="nombre">{{ ing.nombre }}</span>
                <span class="badges">
                  @if (ing.es_aditivo) { <span class="badge badge-warning">aditivo</span> }
                  @if (ing.categoria) { <span class="badge">{{ ing.categoria }}</span> }
                  @else { <span class="badge badge-danger">sin categoría</span> }
                </span>
              </button>
            }
          </div>
        </div>

        @if (seleccionado) {
          <div class="card editor">
            <h3>Editar ingrediente</h3>

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
              <textarea rows="4" [(ngModel)]="edit.notas" placeholder="Descripción o explicación"></textarea>
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
                    <li>{{ a.nombre }} <small>{{ a.marca }}</small></li>
                  }
                </ul>
              }
            </div>

            <div class="acciones">
              <button class="btn btn-danger" (click)="confirmarEliminar = true" [disabled]="guardando || eliminando">Eliminar</button>
              <div class="acciones-derecha">
                <button class="btn" (click)="cerrar()" [disabled]="guardando || eliminando">Cancelar</button>
                <button class="btn btn-primary" (click)="guardar()" [disabled]="guardando || eliminando || !edit.nombre.trim()">
                  {{ guardando ? 'Guardando...' : 'Guardar' }}
                </button>
              </div>
            </div>

            @if (confirmarEliminar) {
              <div class="confirm-box">
                <p>
                  ¿Eliminar <strong>{{ seleccionado.nombre }}</strong>?
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
          </div>
        } @else {
          <div class="card vacio">Selecciona un ingrediente para editarlo.</div>
        }
      </div>
    }

    @if (confirmarEliminarMasivo) {
      <div class="modal-overlay" (click)="confirmarEliminarMasivo = false">
        <div class="card modal-box" (click)="$event.stopPropagation()">
          <h3>¿Eliminar {{ seleccionIds.size }} ingrediente(s)?</h3>
          <p>Esta acción no se puede deshacer. Úsala solo si estás seguro de que son 100% erróneos (duplicados, texto de etiqueta, lotes, etc.).</p>
          <div class="confirm-acciones">
            <button class="btn" (click)="confirmarEliminarMasivo = false" [disabled]="eliminandoMasivo">Cancelar</button>
            <button class="btn btn-danger" (click)="eliminarMasivo()" [disabled]="eliminandoMasivo">
              {{ eliminandoMasivo ? 'Eliminando...' : 'Sí, eliminar todos' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .page-head { margin-bottom: 16px; }
    .page-head h2 { font-size: 22px; font-weight: 700; }
    .page-head p { color: var(--text-muted); margin: 4px 0 0; }
    .estado, .conteo { color: var(--text-muted); font-size: 13px; }
    .aviso { margin-bottom: 14px; }
    .filtros { display: flex; gap: 10px; margin-bottom: 16px; }
    .buscador { flex: 1; }
    .filtros select { min-width: 180px; }
    .grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; align-items: start; }
    .lista-card { padding: 12px; }
    .lista-cabecera { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 0 6px; }
    .check-modo { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--text-muted); }
    .conteo { margin: 4px 6px 8px; }
    .barra-seleccion { display: flex; align-items: center; gap: 12px; padding: 8px 6px; margin-bottom: 6px; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
    .check-todos { display: flex; align-items: center; gap: 6px; font-size: 13px; }
    .sel-count { font-size: 13px; color: var(--text-muted); font-weight: 600; }
    .lista { display: flex; flex-direction: column; gap: 3px; max-height: 480px; overflow-y: auto; }
    .row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: none; background: transparent; border-radius: 8px; cursor: pointer; text-align: left; width: 100%; }
    .row:hover { background: var(--surface-2); }
    .row.sel { background: var(--primary-soft); }
    .row-check { flex-shrink: 0; }
    .nombre { font-weight: 600; flex: 1; }
    .badges { display: flex; gap: 6px; flex-shrink: 0; }
    .editor { padding: 20px; display: flex; flex-direction: column; gap: 14px; position: sticky; top: 20px; }
    .editor h3 { font-size: 17px; font-weight: 700; }
    .check { display: flex; align-items: center; gap: 8px; font-weight: 600; }
    .campo { display: flex; flex-direction: column; gap: 5px; }
    .campo span { font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
    .alimentos-usan { margin: 0; padding-left: 18px; max-height: 160px; overflow-y: auto; display: flex; flex-direction: column; gap: 3px; }
    .alimentos-usan li { font-size: 13px; }
    .alimentos-usan small { color: var(--text-muted); margin-left: 4px; }
    .sin-uso { font-size: 13px; color: var(--text-muted); margin: 0; }
    .acciones { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 4px; }
    .acciones-derecha { display: flex; gap: 10px; }
    .btn-danger { background: var(--danger-soft); border-color: var(--danger-soft); color: var(--danger); }
    .btn-danger:hover { background: var(--danger); color: #fff; }
    .confirm-box { border: 1px solid var(--danger); background: var(--danger-soft); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
    .confirm-box p { margin: 0; font-size: 13px; color: var(--danger); }
    .confirm-acciones { display: flex; gap: 10px; justify-content: flex-end; }
    .vacio { padding: 24px; color: var(--text-muted); text-align: center; }
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
    .modal-box { max-width: 420px; width: 100%; padding: 22px; display: flex; flex-direction: column; gap: 12px; }
    .modal-box h3 { font-size: 17px; font-weight: 700; color: var(--danger); }
    .modal-box p { margin: 0; font-size: 14px; color: var(--text-muted); }
    @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } .filtros { flex-wrap: wrap; } }
  `]
})
export class IngredientesComponent implements OnInit {
  todos: any[] = [];
  filtrados: any[] = [];
  termino = '';
  filtroCategoria = '';
  filtroAditivo = '';
  limite = 150;
  cargando = true;

  seleccionado: any = null;
  edit = { nombre: '', es_aditivo: false, categoria: '', notas: '' };
  guardando = false;
  eliminando = false;
  confirmarEliminar = false;

  modoSeleccion = false;
  seleccionIds = new Set<number>();
  confirmarEliminarMasivo = false;
  eliminandoMasivo = false;

  alimentosAsociados: { id: number; nombre: string; marca: string }[] = [];
  cargandoAlimentos = false;

  mensaje = '';
  esError = false;

  // Categorías oficiales (ALIMENTOS_CATEGORIAS del backend), las mismas que la app móvil
  categorias: string[] = [];

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.api.listarCategoriasIngredientes().subscribe({
      next: (cats) => { this.categorias = cats; this.cdr.markForCheck(); },
      error: () => {}
    });

    this.api.listarIngredientes().subscribe({
      next: (data) => {
        this.todos = data.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        this.filtrar();
        this.cargando = false;
        this.cdr.markForCheck();
      },
      error: () => { this.cargando = false; this.mostrar('Error al cargar ingredientes', true); }
    });
  }

  private norm(s: string): string {
    return (s || '').toString().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  }

  filtrar(): void {
    const t = this.norm(this.termino.trim());
    const palabras = t.split(/\s+/).filter(Boolean);
    this.filtrados = this.todos.filter((ing) => {
      if (this.filtroCategoria === '__sin__' && ing.categoria) return false;
      if (this.filtroCategoria && this.filtroCategoria !== '__sin__' && ing.categoria !== this.filtroCategoria) return false;
      if (this.filtroAditivo === 'si' && !ing.es_aditivo) return false;
      if (this.filtroAditivo === 'no' && ing.es_aditivo) return false;
      if (palabras.length === 0) return true;
      const texto = this.norm(`${ing.nombre || ''} ${ing.categoria || ''}`);
      return palabras.every((p) => texto.includes(p));
    });
  }

  // ── Selección múltiple ──
  toggleModoSeleccion(activo: boolean): void {
    this.modoSeleccion = activo;
    if (!activo) this.seleccionIds.clear();
  }

  onClickFila(ing: any): void {
    if (this.modoSeleccion) {
      this.toggleSeleccion(ing.id);
    } else {
      this.seleccionar(ing);
    }
  }

  toggleSeleccion(id: number): void {
    if (this.seleccionIds.has(id)) this.seleccionIds.delete(id);
    else this.seleccionIds.add(id);
  }

  todosVisiblesSeleccionados(): boolean {
    const visibles = this.filtrados.slice(0, this.limite);
    return visibles.length > 0 && visibles.every((i) => this.seleccionIds.has(i.id));
  }

  toggleSeleccionarTodos(): void {
    const visibles = this.filtrados.slice(0, this.limite);
    if (this.todosVisiblesSeleccionados()) {
      visibles.forEach((i) => this.seleccionIds.delete(i.id));
    } else {
      visibles.forEach((i) => this.seleccionIds.add(i.id));
    }
  }

  eliminarMasivo(): void {
    if (this.seleccionIds.size === 0) return;
    this.eliminandoMasivo = true;
    const ids = Array.from(this.seleccionIds);
    forkJoin(
      ids.map((id) =>
        this.api.eliminarIngrediente(id).pipe(
          map(() => ({ id, ok: true })),
          catchError(() => of({ id, ok: false }))
        )
      )
    ).subscribe((resultados) => {
      const okIds = resultados.filter((r) => r.ok).map((r) => r.id);
      const fallidos = resultados.filter((r) => !r.ok).length;
      this.todos = this.todos.filter((i) => !okIds.includes(i.id));
      this.seleccionIds.clear();
      this.filtrar();
      this.eliminandoMasivo = false;
      this.confirmarEliminarMasivo = false;
      const msg = fallidos > 0
        ? `${okIds.length} eliminado(s), ${fallidos} con error`
        : `${okIds.length} ingrediente(s) eliminado(s)`;
      this.mostrar(msg, fallidos > 0);
    });
  }

  seleccionar(ing: any): void {
    this.seleccionado = ing;
    this.confirmarEliminar = false;
    this.edit = {
      nombre: ing.nombre || '',
      es_aditivo: !!ing.es_aditivo,
      categoria: ing.categoria || '',
      notas: ing.notas || ''
    };

    this.alimentosAsociados = [];
    this.cargandoAlimentos = true;
    this.api.alimentosDeIngrediente(ing.id).subscribe({
      next: (alimentos) => { this.alimentosAsociados = alimentos; this.cargandoAlimentos = false; this.cdr.markForCheck(); },
      error: () => { this.cargandoAlimentos = false; this.cdr.markForCheck(); }
    });
  }

  cerrar(): void {
    this.seleccionado = null;
    this.confirmarEliminar = false;
  }

  guardar(): void {
    if (!this.seleccionado) return;
    const nombre = this.edit.nombre.trim();
    if (!nombre) return;

    this.guardando = true;
    const payload = {
      nombre,
      es_aditivo: this.edit.es_aditivo,
      categoria: this.edit.categoria.trim(),
      notas: this.edit.notas.trim(),
      verificado: true
    };
    this.api.actualizarIngrediente(this.seleccionado.id, payload).subscribe({
      next: (res: any) => {
        this.guardando = false;
        if (res?.fusionado) {
          // El nombre coincidía con otro ingrediente ya existente: se han fusionado
          this.todos = this.todos.filter((i) => i.id !== this.seleccionado.id);
          const yaEstaba = this.todos.some((i) => i.id === res.ingrediente.id);
          if (!yaEstaba) this.todos.push(res.ingrediente);
          this.mostrar(`Fusionado con el ingrediente existente "${res.ingrediente.nombre}"`, false);
        } else {
          Object.assign(this.seleccionado, payload);
          this.mostrar(`"${nombre}" actualizado`, false);
        }
        this.todos.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        this.filtrar();
        this.cerrar();
      },
      error: (err) => { this.guardando = false; this.mostrar(err.error?.error || 'No se pudo guardar', true); }
    });
  }

  eliminar(): void {
    if (!this.seleccionado) return;
    this.eliminando = true;
    const id = this.seleccionado.id;
    this.api.eliminarIngrediente(id).subscribe({
      next: () => {
        this.todos = this.todos.filter((i) => i.id !== id);
        this.filtrar();
        this.mostrar('Ingrediente eliminado', false);
        this.eliminando = false;
        this.cerrar();
      },
      error: (err) => { this.eliminando = false; this.mostrar(err.error?.error || 'No se pudo eliminar', true); }
    });
  }

  private mostrar(t: string, e: boolean): void {
    this.mensaje = t; this.esError = e;
    this.cdr.markForCheck();
    setTimeout(() => { this.mensaje = ''; this.cdr.markForCheck(); }, 4000);
  }
}
