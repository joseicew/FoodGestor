import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';

@Component({
  selector: 'app-ingredientes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="page-head">
      <h2>Ingredientes</h2>
      <p>Busca un ingrediente y edítalo: si es aditivo, su categoría y su descripción.</p>
    </header>

    @if (mensaje) { <div class="aviso" [class.error]="esError">{{ mensaje }}</div> }

    <input class="buscador" type="text" [(ngModel)]="termino" (ngModelChange)="filtrar()"
           placeholder="Buscar por nombre o categoría..." autocomplete="off" />

    @if (cargando) {
      <p class="estado">Cargando ingredientes...</p>
    } @else {
      <div class="grid">
        <div class="card lista-card">
          <p class="conteo">{{ filtrados.length }} resultado(s){{ filtrados.length > limite ? ' · mostrando ' + limite : '' }}</p>
          <div class="lista">
            @for (ing of filtrados.slice(0, limite); track ing.id) {
              <button class="row" [class.sel]="seleccionado?.id === ing.id" (click)="seleccionar(ing)">
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
            <h3>{{ seleccionado.nombre }}</h3>
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
            <div class="acciones">
              <button class="btn" (click)="cerrar()" [disabled]="guardando">Cancelar</button>
              <button class="btn btn-primary" (click)="guardar()" [disabled]="guardando">{{ guardando ? 'Guardando...' : 'Guardar' }}</button>
            </div>
          </div>
        } @else {
          <div class="card vacio">Selecciona un ingrediente para editarlo.</div>
        }
      </div>
    }
  `,
  styles: [`
    .page-head { margin-bottom: 16px; }
    .page-head h2 { font-size: 22px; font-weight: 700; }
    .page-head p { color: var(--text-muted); margin: 4px 0 0; }
    .estado, .conteo { color: var(--text-muted); font-size: 13px; }
    .aviso { margin-bottom: 14px; }
    .buscador { width: 100%; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; align-items: start; }
    .lista-card { padding: 12px; }
    .conteo { margin: 4px 6px 8px; }
    .lista { display: flex; flex-direction: column; gap: 3px; max-height: 520px; overflow-y: auto; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border: none; background: transparent; border-radius: 8px; cursor: pointer; text-align: left; }
    .row:hover { background: var(--surface-2); }
    .row.sel { background: var(--primary-soft); }
    .nombre { font-weight: 600; }
    .badges { display: flex; gap: 6px; flex-shrink: 0; }
    .editor { padding: 20px; display: flex; flex-direction: column; gap: 14px; position: sticky; top: 20px; }
    .editor h3 { font-size: 17px; font-weight: 700; }
    .check { display: flex; align-items: center; gap: 8px; font-weight: 600; }
    .campo { display: flex; flex-direction: column; gap: 5px; }
    .campo span { font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
    .acciones { display: flex; gap: 10px; justify-content: flex-end; margin-top: 4px; }
    .vacio { padding: 24px; color: var(--text-muted); text-align: center; }
    @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } }
  `]
})
export class IngredientesComponent implements OnInit {
  todos: any[] = [];
  filtrados: any[] = [];
  termino = '';
  limite = 150;
  cargando = true;

  seleccionado: any = null;
  edit = { es_aditivo: false, categoria: '', notas: '' };
  guardando = false;

  mensaje = '';
  esError = false;

  // Categorías oficiales (ALIMENTOS_CATEGORIAS del backend), las mismas que la app móvil
  categorias: string[] = [];

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.listarCategoriasIngredientes().subscribe({
      next: (cats) => (this.categorias = cats),
      error: () => {}
    });

    this.api.listarIngredientes().subscribe({
      next: (data) => {
        this.todos = data.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        this.filtrar();
        this.cargando = false;
      },
      error: () => { this.cargando = false; this.mostrar('Error al cargar ingredientes', true); }
    });
  }

  private norm(s: string): string {
    return (s || '').toString().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  }

  filtrar(): void {
    const t = this.norm(this.termino.trim());
    if (!t) { this.filtrados = this.todos; return; }
    const palabras = t.split(/\s+/).filter(Boolean);
    this.filtrados = this.todos.filter((ing) => {
      const texto = this.norm(`${ing.nombre || ''} ${ing.categoria || ''}`);
      return palabras.every((p) => texto.includes(p));
    });
  }

  seleccionar(ing: any): void {
    this.seleccionado = ing;
    this.edit = { es_aditivo: !!ing.es_aditivo, categoria: ing.categoria || '', notas: ing.notas || '' };
  }

  cerrar(): void { this.seleccionado = null; }

  guardar(): void {
    if (!this.seleccionado) return;
    this.guardando = true;
    const payload = {
      es_aditivo: this.edit.es_aditivo,
      categoria: this.edit.categoria.trim(),
      notas: this.edit.notas.trim(),
      verificado: true
    };
    this.api.actualizarIngrediente(this.seleccionado.id, payload).subscribe({
      next: () => {
        Object.assign(this.seleccionado, payload);
        this.mostrar(`"${this.seleccionado.nombre}" actualizado`, false);
        this.guardando = false;
        this.cerrar();
      },
      error: (err) => { this.guardando = false; this.mostrar(err.error?.error || 'No se pudo guardar', true); }
    });
  }

  private mostrar(t: string, e: boolean): void {
    this.mensaje = t; this.esError = e;
    setTimeout(() => (this.mensaje = ''), 4000);
  }
}
