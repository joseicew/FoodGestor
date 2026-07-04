import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IngredientesService } from '../../../services/ingredientes';

@Component({
  selector: 'app-admin-ingredientes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-ing">
      <h2>Ingredientes</h2>
      <p class="ayuda">Busca un ingrediente y haz click para editar si es aditivo, su categoría y su descripción.</p>

      @if (mensaje) {
        <div class="aviso" [class.error]="esError">{{ mensaje }}</div>
      }

      <input class="buscador" type="text" [(ngModel)]="termino" (ngModelChange)="filtrar()"
             placeholder="Buscar ingrediente..." autocomplete="off" />

      @if (cargando) {
        <p class="estado">Cargando ingredientes...</p>
      } @else {
        <p class="conteo">{{ filtrados.length }} resultado(s){{ filtrados.length > limite ? ' (mostrando ' + limite + ')' : '' }}</p>
        <div class="lista">
          @for (ing of filtrados.slice(0, limite); track ing.id) {
            <button class="ing-row" [class.sel]="seleccionado?.id === ing.id" (click)="seleccionar(ing)">
              <span class="ing-nombre">{{ ing.nombre }}</span>
              <span class="ing-badges">
                @if (ing.es_aditivo) { <span class="badge aditivo">aditivo</span> }
                @if (ing.categoria) { <span class="badge cat">{{ ing.categoria }}</span> }
                @else { <span class="badge sin">sin categoría</span> }
              </span>
            </button>
          }
        </div>
      }

      @if (seleccionado) {
        <div class="editor">
          <h3>{{ seleccionado.nombre }}</h3>

          <label class="check">
            <input type="checkbox" [(ngModel)]="edit.es_aditivo" />
            Es aditivo
          </label>

          <label class="campo">
            <span>Categoría</span>
            <input type="text" [(ngModel)]="edit.categoria" placeholder="Ej: Cereales y Derivados" list="cats-ing" />
          </label>

          <label class="campo">
            <span>Descripción</span>
            <textarea [(ngModel)]="edit.notas" rows="3" placeholder="Descripción o explicación del ingrediente"></textarea>
          </label>

          <div class="acciones">
            <button class="btn-cancel" (click)="cerrar()" [disabled]="guardando">Cancelar</button>
            <button class="btn-guardar" (click)="guardar()" [disabled]="guardando">
              {{ guardando ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </div>
      }

      <datalist id="cats-ing">
        @for (c of categoriasComunes; track c) { <option [value]="c"></option> }
      </datalist>
    </div>
  `,
  styles: [`
    .admin-ing h2 { font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 0 0 6px; }
    .ayuda { color: var(--text-secondary); font-size: 13px; margin: 0 0 14px; }
    .estado, .conteo { color: var(--text-secondary); font-size: 13px; }
    .aviso { padding: 10px 14px; border-radius: 8px; background: var(--success-light); color: var(--success); font-size: 14px; font-weight: 600; margin-bottom: 12px; }
    .aviso.error { background: var(--error-light); color: var(--error); }
    .buscador { width: 100%; box-sizing: border-box; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-primary); font-size: 14px; margin-bottom: 8px; }
    .lista { display: flex; flex-direction: column; gap: 4px; max-height: 420px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 12px; padding: 6px; }
    .ing-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border: none; background: var(--bg-surface); border-radius: 8px; cursor: pointer; text-align: left; }
    .ing-row:hover { background: var(--bg-secondary); }
    .ing-row.sel { outline: 2px solid var(--primary); }
    .ing-nombre { color: var(--text-primary); font-size: 14px; font-weight: 600; }
    .ing-badges { display: flex; gap: 6px; flex-shrink: 0; }
    .badge { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px; }
    .badge.aditivo { background: var(--warning-light); color: var(--warning); }
    .badge.cat { background: var(--bg-tertiary); color: var(--text-secondary); }
    .badge.sin { background: var(--error-light); color: var(--error); }
    .editor { margin-top: 16px; padding: 16px; border: 1px solid var(--border-color); border-radius: 12px; background: var(--bg-secondary); display: flex; flex-direction: column; gap: 12px; }
    .editor h3 { margin: 0; font-size: 16px; color: var(--text-primary); }
    .check { display: flex; align-items: center; gap: 8px; color: var(--text-primary); font-size: 14px; font-weight: 600; }
    .campo { display: flex; flex-direction: column; gap: 4px; }
    .campo span { font-size: 12px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; }
    .campo input, .campo textarea { padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-primary); font-size: 14px; font-family: inherit; }
    .acciones { display: flex; gap: 10px; justify-content: flex-end; }
    .btn-cancel, .btn-guardar { padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; }
    .btn-cancel { background: var(--bg-tertiary); color: var(--text-primary); }
    .btn-guardar { background: var(--primary); color: #fff; }
  `]
})
export class AdminIngredientesComponent implements OnInit {
  todos: any[] = [];
  filtrados: any[] = [];
  termino = '';
  limite = 100;
  cargando = true;

  seleccionado: any = null;
  edit: { es_aditivo: boolean; categoria: string; notas: string } = { es_aditivo: false, categoria: '', notas: '' };
  guardando = false;

  mensaje = '';
  esError = false;

  readonly categoriasComunes = [
    'Carnes y Aves', 'Pescados y Mariscos', 'Lácteos y Huevos', 'Frutas',
    'Verduras y Hortalizas', 'Cereales y Derivados', 'Legumbres', 'Grasas y Aceites',
    'Frutos Secos', 'Bebidas', 'Aditivos', 'Especias y Condimentos', 'Azúcares y Edulcorantes', 'Otros',
  ];

  constructor(private ingredientesService: IngredientesService) {}

  ngOnInit(): void {
    this.ingredientesService.listarIngredientes().subscribe({
      next: (data) => {
        this.todos = data.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        this.filtrar();
        this.cargando = false;
      },
      error: () => { this.cargando = false; this.mostrar('Error al cargar ingredientes', true); }
    });
  }

  private normalizar(s: string): string {
    return (s || '').toString().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  }

  filtrar(): void {
    const t = this.normalizar(this.termino.trim());
    if (!t) { this.filtrados = this.todos; return; }
    const palabras = t.split(/\s+/).filter(Boolean);
    this.filtrados = this.todos.filter((ing) => {
      const texto = this.normalizar(`${ing.nombre || ''} ${ing.categoria || ''}`);
      return palabras.every((p) => texto.includes(p));
    });
  }

  seleccionar(ing: any): void {
    this.seleccionado = ing;
    this.edit = {
      es_aditivo: !!ing.es_aditivo,
      categoria: ing.categoria || '',
      notas: ing.notas || ''
    };
  }

  cerrar(): void {
    this.seleccionado = null;
  }

  guardar(): void {
    if (!this.seleccionado) return;
    this.guardando = true;
    const id = this.seleccionado.id;
    const payload = {
      es_aditivo: this.edit.es_aditivo,
      categoria: this.edit.categoria.trim(),
      notas: this.edit.notas.trim(),
      verificado: true
    };
    this.ingredientesService.actualizarIngrediente(id, payload).subscribe({
      next: () => {
        // reflejar en la lista local
        Object.assign(this.seleccionado, payload);
        this.guardando = false;
        this.mostrar(`Ingrediente "${this.seleccionado.nombre}" actualizado`, false);
        this.cerrar();
      },
      error: (err) => {
        this.guardando = false;
        this.mostrar(err.error?.error || 'No se pudo guardar', true);
      }
    });
  }

  private mostrar(texto: string, error: boolean): void {
    this.mensaje = texto;
    this.esError = error;
    setTimeout(() => { this.mensaje = ''; }, 4000);
  }
}
