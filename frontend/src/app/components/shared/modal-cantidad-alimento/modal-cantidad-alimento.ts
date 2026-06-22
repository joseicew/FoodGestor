import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-modal-cantidad-alimento',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './modal-cantidad-alimento.html'
})
export class ModalCantidadAlimentoComponent implements OnChanges {
  @Input() alimento: any = null;
  @Output() confirmar = new EventEmitter<number>();
  @Output() cancelar = new EventEmitter<void>();

  cantidad: string | number = 100;
  modo: 'gramos' | 'unidades' = 'gramos';

  ngOnChanges(changes: SimpleChanges) {
    if (changes['alimento']?.currentValue) {
      this.cantidad = 100;
      this.modo = 'gramos';
    }
  }

  private convertirFraccionANumero(valor: string | number): number {
    const str = String(valor).trim();
    if (str.includes('/')) {
      const partes = str.split('/');
      if (partes.length === 2) {
        const n = parseFloat(partes[0].trim());
        const d = parseFloat(partes[1].trim());
        if (!isNaN(n) && !isNaN(d) && d !== 0) return n / d;
      }
    }
    const num = parseFloat(str);
    return !isNaN(num) ? num : 1;
  }

  onConfirmar() {
    const cantidadNum = this.convertirFraccionANumero(this.cantidad);
    const gramos = this.modo === 'unidades'
      ? cantidadNum * (this.alimento.peso_unidad || 100)
      : cantidadNum;
    this.confirmar.emit(gramos);
  }

  onCancelar() {
    this.cancelar.emit();
  }
}
