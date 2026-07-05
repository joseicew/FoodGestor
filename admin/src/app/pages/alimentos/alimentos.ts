import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api';

@Component({
  selector: 'app-alimentos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="page-head">
      <h2>Alimentos</h2>
      <p>Busca por nombre, marca o código de barras. Haz click para editar todos los datos y sus ingredientes.</p>
    </header>

    @if (mensaje) { <div class="aviso" [class.error]="esError">{{ mensaje }}</div> }

    <div class="filtros">
      <input class="buscador" type="text" [(ngModel)]="termino" (ngModelChange)="filtrar()"
             placeholder="Buscar alimento..." autocomplete="off" />
      <select [(ngModel)]="filtroCategoria" (ngModelChange)="filtrar()">
        <option value="">Todas las categorías</option>
        <option value="__sin__">Sin categoría</option>
        @for (c of categorias; track c) { <option [value]="c">{{ c }}</option> }
      </select>
    </div>

    @if (cargando) {
      <p class="estado">Cargando alimentos...</p>
    } @else {
      <div class="paginacion-cabecera">
        <p class="conteo">{{ filtrados.length }} resultado(s)</p>
        @if (totalPaginas > 1) {
          <p class="conteo">Página {{ pagina }} de {{ totalPaginas }}</p>
        }
      </div>
      <div class="card lista-card">
        @for (a of paginaActual(); track a.id) {
          <button class="row" [class.sel]="seleccionado?.id === a.id" (click)="seleccionar(a)">
            <span class="nombre">{{ a.nombre }}<small>{{ a.marca }}</small></span>
            <span class="meta">
              @if (a.categoria) { <span class="badge">{{ a.categoria }}</span> }
              @if (a.codigo_barras) { <span class="cod">{{ a.codigo_barras }}</span> }
            </span>
          </button>
        } @empty {
          <p class="vacio-lista">Sin resultados</p>
        }
      </div>
      @if (totalPaginas > 1) {
        <div class="paginador">
          <button class="btn" (click)="irAPagina(1)" [disabled]="pagina === 1">« Primera</button>
          <button class="btn" (click)="irAPagina(pagina - 1)" [disabled]="pagina === 1">‹ Anterior</button>
          <span class="pagina-info">{{ pagina }} / {{ totalPaginas }}</span>
          <button class="btn" (click)="irAPagina(pagina + 1)" [disabled]="pagina === totalPaginas">Siguiente ›</button>
          <button class="btn" (click)="irAPagina(totalPaginas)" [disabled]="pagina === totalPaginas">Última »</button>
        </div>
      }
    }

    @if (seleccionado) {
      <div class="card editor">
        <div class="editor-head">
          <h3>Editar alimento</h3>
          <button class="btn" (click)="cerrar()">✕ Cerrar</button>
        </div>

        <section>
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

        <section>
          <h4>Macronutrientes (por 100g)</h4>
          <div class="campos macros">
            @for (m of macros; track m.key) {
              <label class="campo"><span>{{ m.label }}</span><input type="number" [ngModel]="edit[m.key]" (ngModelChange)="edit[m.key] = $event" /></label>
            }
          </div>
        </section>

        <section>
          <h4>Ingredientes ({{ edit.ingredientes.length }})</h4>
          <div class="chips">
            @for (ing of edit.ingredientes; track $index) {
              <span class="chip">{{ ing }} <button (click)="quitarIngrediente($index)">✕</button></span>
            }
            @if (edit.ingredientes.length === 0) { <span class="sin">Sin ingredientes</span> }
          </div>
          <div class="add-ing">
            <input [(ngModel)]="nuevoIngrediente" (keyup.enter)="agregarIngrediente()" placeholder="Añadir ingrediente y Enter" />
            <button class="btn" (click)="agregarIngrediente()">Añadir</button>
          </div>
        </section>

        <div class="acciones">
          <button class="btn" (click)="cerrar()" [disabled]="guardando">Cancelar</button>
          <button class="btn btn-primary" (click)="guardar()" [disabled]="guardando">{{ guardando ? 'Guardando...' : 'Guardar cambios' }}</button>
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
    .filtros { display: flex; gap: 10px; margin-bottom: 12px; }
    .buscador { flex: 1; }
    .filtros select { min-width: 190px; }
    .paginacion-cabecera { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .lista-card { padding: 8px; max-height: 340px; overflow-y: auto; }
    .vacio-lista { text-align: center; color: var(--text-muted); padding: 24px; margin: 0; }
    .paginador { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 12px; }
    .pagina-info { font-size: 13px; color: var(--text-muted); font-weight: 600; padding: 0 6px; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border: none; background: transparent; border-radius: 8px; cursor: pointer; text-align: left; width: 100%; }
    .row:hover { background: var(--surface-2); }
    .row.sel { background: var(--primary-soft); }
    .nombre { display: flex; flex-direction: column; font-weight: 600; }
    .nombre small { font-weight: 500; color: var(--text-muted); }
    .meta { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .cod { font-family: 'Consolas', monospace; font-size: 12px; color: var(--text-muted); }
    .editor { margin-top: 16px; padding: 22px; }
    .editor-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .editor-head h3 { font-size: 18px; font-weight: 700; }
    section { padding: 14px 0; border-top: 1px solid var(--border); }
    section h4 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.3px; color: var(--text-muted); margin-bottom: 12px; }
    .campos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .campos.macros { grid-template-columns: repeat(4, 1fr); }
    .campo { display: flex; flex-direction: column; gap: 4px; }
    .campo.full { grid-column: 1 / -1; }
    .campo span { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
    .chip { display: inline-flex; align-items: center; gap: 6px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 16px; padding: 4px 10px; font-size: 13px; }
    .chip button { border: none; background: none; color: var(--danger); font-size: 12px; cursor: pointer; }
    .sin { color: var(--text-muted); font-size: 13px; }
    .add-ing { display: flex; gap: 8px; }
    .add-ing input { flex: 1; }
    .acciones { display: flex; gap: 10px; justify-content: flex-end; padding-top: 16px; border-top: 1px solid var(--border); }
    @media (max-width: 720px) { .campos, .campos.macros { grid-template-columns: 1fr 1fr; } }
  `]
})
export class AlimentosComponent implements OnInit {
  todos: any[] = [];
  filtrados: any[] = [];
  termino = '';
  filtroCategoria = '';
  porPagina = 100;
  pagina = 1;
  cargando = true;

  seleccionado: any = null;
  edit: any = { ingredientes: [] };
  nuevoIngrediente = '';
  guardando = false;

  mensaje = '';
  esError = false;

  readonly macros = [
    { key: 'calorias', label: 'Calorías (kcal)' },
    { key: 'proteinas', label: 'Proteínas (g)' },
    { key: 'hidratos_carbono', label: 'Carbohidratos (g)' },
    { key: 'grasas', label: 'Grasas (g)' },
    { key: 'grasas_saturadas', label: 'Grasas sat. (g)' },
    { key: 'azucares', label: 'Azúcares (g)' },
    { key: 'fibra', label: 'Fibra (g)' },
    { key: 'sal', label: 'Sal (g)' },
    { key: 'sodio', label: 'Sodio (mg)' },
    { key: 'potasio', label: 'Potasio (mg)' },
    { key: 'calcio', label: 'Calcio (mg)' },
    { key: 'hierro', label: 'Hierro (mg)' },
  ];

  // Mismas listas exactas que la app móvil (frontend/.../alimento-detalle.ts)
  readonly categorias = [
    'Carnes y Aves', 'Pescados y Mariscos', 'Lácteos y Huevos', 'Frutas',
    'Verduras y Hortalizas', 'Cereales y Derivados', 'Legumbres', 'Grasas y Aceites',
    'Frutos Secos', 'Bebidas', 'Snacks y Aperitivos', 'Dulces y Repostería',
    'Condimentos y Salsas', 'Platos Preparados', 'Suplementos', 'Otros',
  ];

  readonly unidadesComunes = [
    'Bolsa', 'Pieza', 'Rebanada', 'Loncha', 'Lata', 'Bote', 'Botella', 'Barrita', 'Galleta',
  ];

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.api.listarAlimentos().subscribe({
      next: (data) => {
        this.todos = data.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        this.filtrar();
        this.cargando = false;
        this.cdr.markForCheck();
      },
      error: () => { this.cargando = false; this.mostrar('Error al cargar alimentos', true); }
    });
  }

  private norm(s: string): string {
    return (s || '').toString().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  }

  filtrar(): void {
    const t = this.norm(this.termino.trim());
    const palabras = t.split(/\s+/).filter(Boolean);
    this.filtrados = this.todos.filter((a) => {
      if (this.filtroCategoria === '__sin__' && a.categoria) return false;
      if (this.filtroCategoria && this.filtroCategoria !== '__sin__' && a.categoria !== this.filtroCategoria) return false;
      if (palabras.length === 0) return true;
      const texto = this.norm(`${a.nombre || ''} ${a.marca || ''} ${a.codigo_barras || ''}`);
      return palabras.every((p) => texto.includes(p));
    });
    this.pagina = 1;
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.filtrados.length / this.porPagina));
  }

  paginaActual(): any[] {
    const inicio = (this.pagina - 1) * this.porPagina;
    return this.filtrados.slice(inicio, inicio + this.porPagina);
  }

  irAPagina(n: number): void {
    this.pagina = Math.min(Math.max(1, n), this.totalPaginas);
  }

  seleccionar(a: any): void {
    this.seleccionado = a;
    this.edit = { ...a, ingredientes: Array.isArray(a.ingredientes) ? [...a.ingredientes] : [] };
  }

  cerrar(): void { this.seleccionado = null; }

  agregarIngrediente(): void {
    const n = this.nuevoIngrediente.trim();
    if (n && !this.edit.ingredientes.includes(n)) this.edit.ingredientes.push(n);
    this.nuevoIngrediente = '';
  }

  quitarIngrediente(i: number): void {
    this.edit.ingredientes.splice(i, 1);
  }

  guardar(): void {
    if (!this.seleccionado) return;
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
    this.api.actualizarAlimento(this.seleccionado.id, datos).subscribe({
      next: (res: any) => {
        // reflejar en la lista local
        Object.assign(this.seleccionado, res.alimento || this.edit);
        this.mostrar('Alimento actualizado', false);
        this.guardando = false;
        this.cerrar();
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
