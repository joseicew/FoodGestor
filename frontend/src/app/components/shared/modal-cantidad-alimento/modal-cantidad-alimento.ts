import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlimentosService } from '../../../services/alimentos';

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
  actualizandoFavorito = false;

  constructor(private alimentosService: AlimentosService) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['alimento']?.currentValue) {
      const tienePorciones = !!(this.alimento?.peso_unidad && this.alimento?.nombre_unidad);
      this.modo = tienePorciones ? 'unidades' : 'gramos';
      this.cantidad = tienePorciones ? 1 : 100;
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

  toggleFavorito() {
    if (!this.alimento || this.actualizandoFavorito) return;
    this.actualizandoFavorito = true;
    this.alimentosService.toggleFavorito(this.alimento.id).subscribe({
      next: (res) => {
        this.alimento.favorito = res.alimento.favorito;
        this.actualizandoFavorito = false;
      },
      error: () => { this.actualizandoFavorito = false; }
    });
  }
}
