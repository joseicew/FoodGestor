import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';

const PRESETS = [0.5, 1, 2, 3];

@Component({
  selector: 'app-modal-cantidad-racion',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './modal-cantidad-racion.html'
})
export class ModalCantidadRacionComponent implements OnChanges {
  @Input() racion: any = null;
  @Output() confirmar = new EventEmitter<number>();
  @Output() cancelar = new EventEmitter<void>();

  readonly presets = PRESETS;
  cantidad = 1;
  mostrarPersonalizado = false;
  valorPersonalizado = '';

  ngOnChanges(changes: SimpleChanges) {
    if (changes['racion']?.currentValue) {
      this.cantidad = 1;
      this.mostrarPersonalizado = false;
      this.valorPersonalizado = '';
    }
  }

  elegirPreset(valor: number) {
    this.cantidad = valor;
    this.mostrarPersonalizado = false;
  }

  abrirPersonalizado() {
    this.mostrarPersonalizado = true;
    this.valorPersonalizado = String(this.cantidad);
  }

  onConfirmar() {
    const valor = this.mostrarPersonalizado
      ? parseFloat(this.valorPersonalizado.replace(',', '.'))
      : this.cantidad;
    if (!valor || isNaN(valor) || valor <= 0) return;
    this.confirmar.emit(valor);
  }

  onCancelar() {
    this.cancelar.emit();
  }
}
