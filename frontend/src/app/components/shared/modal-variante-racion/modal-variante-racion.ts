import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BusquedaAlimentoComponent } from '../busqueda-alimento/busqueda-alimento';

export interface VarianteRacion {
  nombre: string;
  alimentos: { alimento_id: number; cantidad: number }[];
}

interface ItemVariante {
  id: number;
  nombre: string;
  marca?: string;
  cantidad: number;
}

/**
 * Editor de "ración alternativa": parte de una ración ya guardada y permite
 * cambiar cantidades, quitar alimentos o añadir otros, sin tocar la original.
 * Al confirmar emite la composición completa de la nueva ración.
 */
@Component({
  selector: 'app-modal-variante-racion',
  standalone: true,
  imports: [CommonModule, FormsModule, BusquedaAlimentoComponent],
  templateUrl: './modal-variante-racion.html',
  styleUrl: './modal-variante-racion.css'
})
export class ModalVarianteRacionComponent implements OnChanges {
  /** Ración de partida (la que ya está en el calendario) */
  @Input() racion: any = null;
  /** Catálogo completo, para buscar alimentos y calcular macros */
  @Input() catalogoAlimentos: any[] = [];

  @Output() confirmar = new EventEmitter<VarianteRacion>();
  @Output() cancelar = new EventEmitter<void>();

  nombre = '';
  items: ItemVariante[] = [];
  mostrarBuscador = false;
  error = '';

  ngOnChanges(changes: SimpleChanges) {
    if (changes['racion']?.currentValue) {
      const r = changes['racion'].currentValue;
      this.nombre = `${r.nombre} (variante)`;
      this.items = (r.alimentos || []).map((a: any) => ({
        id: a.id,
        nombre: a.nombre,
        marca: a.marca,
        cantidad: Number(a.cantidad) || 100
      }));
      this.mostrarBuscador = false;
      this.error = '';
    }
  }

  get idsEnUso(): number[] {
    return this.items.map(i => i.id);
  }

  /** Datos completos del alimento, para poder sumar macros y no solo kcal */
  private buscarEnCatalogo(id: number): any {
    return this.catalogoAlimentos.find(a => a.id === id) || null;
  }

  get totales() {
    const t = { calorias: 0, proteinas: 0, grasas: 0, hidratos_carbono: 0 };
    for (const item of this.items) {
      const alimento = this.buscarEnCatalogo(item.id);
      if (!alimento) continue;
      const factor = (Number(item.cantidad) || 0) / 100;
      t.calorias += (alimento.calorias || 0) * factor;
      t.proteinas += (alimento.proteinas || 0) * factor;
      t.grasas += (alimento.grasas || 0) * factor;
      t.hidratos_carbono += (alimento.hidratos_carbono || 0) * factor;
    }
    return t;
  }

  /** kcal de una línea, para que se vea el peso de cada alimento */
  kcalItem(item: ItemVariante): number {
    const alimento = this.buscarEnCatalogo(item.id);
    if (!alimento) return 0;
    return (alimento.calorias || 0) * (Number(item.cantidad) || 0) / 100;
  }

  cambiarCantidad(item: ItemVariante, valor: string) {
    const num = parseFloat((valor || '').replace(',', '.'));
    item.cantidad = isNaN(num) ? 0 : num;
  }

  quitarItem(id: number) {
    this.items = this.items.filter(i => i.id !== id);
  }

  onAnadirAlimento(alimento: any) {
    if (this.items.some(i => i.id === alimento.id)) return;
    this.items = [...this.items, {
      id: alimento.id,
      nombre: alimento.nombre,
      marca: alimento.marca,
      cantidad: 100
    }];
    this.mostrarBuscador = false;
  }

  /** ¿Ha cambiado algo respecto a la original? Si no, no tiene sentido duplicar */
  get hayCambios(): boolean {
    const originales = (this.racion?.alimentos || []) as any[];
    if (originales.length !== this.items.length) return true;
    return this.items.some(item => {
      const orig = originales.find(o => o.id === item.id);
      return !orig || Number(orig.cantidad) !== Number(item.cantidad);
    });
  }

  onConfirmar() {
    this.error = '';

    const nombre = this.nombre.trim();
    if (!nombre) {
      this.error = 'Ponle un nombre a la variante';
      return;
    }
    if (nombre === this.racion?.nombre) {
      this.error = 'El nombre debe ser distinto al de la ración original';
      return;
    }
    if (this.items.length === 0) {
      this.error = 'La variante necesita al menos un alimento';
      return;
    }
    if (this.items.some(i => !i.cantidad || i.cantidad <= 0)) {
      this.error = 'Las cantidades deben ser mayores que 0';
      return;
    }

    this.confirmar.emit({
      nombre,
      alimentos: this.items.map(i => ({ alimento_id: i.id, cantidad: i.cantidad }))
    });
  }

  onCancelar() {
    this.cancelar.emit();
  }
}
