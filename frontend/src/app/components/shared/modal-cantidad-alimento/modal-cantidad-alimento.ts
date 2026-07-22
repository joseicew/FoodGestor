import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlimentosService } from '../../../services/alimentos';
import { ModalAyudaComponent } from '../modal-ayuda/modal-ayuda';

@Component({
  selector: 'app-modal-cantidad-alimento',
  standalone: true,
  imports: [FormsModule, ModalAyudaComponent],
  templateUrl: './modal-cantidad-alimento.html'
})
export class ModalCantidadAlimentoComponent implements OnChanges {
  @Input() alimento: any = null;
  @Output() confirmar = new EventEmitter<number>();
  @Output() cancelar = new EventEmitter<void>();

  cantidad: string | number = 100;
  modo: 'gramos' | 'unidades' = 'gramos';
  actualizandoFavorito = false;
  mostrarAyuda = false;

  /** Porción (g/ml) que el usuario ya tiene guardada para este alimento, si existe */
  porcionHabitual: number | null = null;
  /** Pregunta "¿es tu porción habitual?" pendiente de responder tras pulsar Agregar */
  mostrarSugerenciaGuardar = false;
  guardandoPorcion = false;
  private cantidadPendiente: number | null = null;

  constructor(private alimentosService: AlimentosService, private cdr: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['alimento']?.currentValue) {
      const tienePorciones = !!(this.alimento?.peso_unidad && this.alimento?.nombre_unidad);
      this.modo = tienePorciones ? 'unidades' : 'gramos';
      this.cantidad = tienePorciones ? 1 : 100;
      this.porcionHabitual = null;
      this.mostrarSugerenciaGuardar = false;
      this.cantidadPendiente = null;

      const alimentoId = this.alimento.id;
      this.alimentosService.obtenerPorcionHabitual(alimentoId).subscribe({
        next: (res) => {
          // El usuario pudo cerrar el modal o abrir otro alimento antes de que llegue la respuesta
          if (this.alimento?.id !== alimentoId) return;
          const cantidadGuardada = res?.porcion?.cantidad;
          if (cantidadGuardada) {
            this.porcionHabitual = cantidadGuardada;
            this.modo = 'gramos';
            this.cantidad = cantidadGuardada;
            this.cdr.detectChanges();
          }
        },
        error: () => {}
      });
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

    // Primera vez que se añade en gr/ml (sin porción habitual guardada): preguntar
    // antes de confirmar si esta es la cantidad que suele consumir, para que la
    // próxima vez ya salga sugerida.
    if (this.modo === 'gramos' && !this.porcionHabitual) {
      this.cantidadPendiente = gramos;
      this.mostrarSugerenciaGuardar = true;
      return;
    }

    this.confirmar.emit(gramos);
  }

  confirmarSinGuardarPorcion() {
    const gramos = this.cantidadPendiente;
    this.mostrarSugerenciaGuardar = false;
    this.cantidadPendiente = null;
    if (gramos != null) this.confirmar.emit(gramos);
  }

  confirmarYGuardarPorcion() {
    if (this.guardandoPorcion || this.cantidadPendiente == null) return;
    const gramos = this.cantidadPendiente;
    this.guardandoPorcion = true;
    this.alimentosService.guardarPorcionHabitual(this.alimento.id, gramos).subscribe({
      next: () => this.finalizarConfirmacionConPorcion(gramos),
      error: () => this.finalizarConfirmacionConPorcion(gramos)
    });
  }

  private finalizarConfirmacionConPorcion(gramos: number) {
    this.guardandoPorcion = false;
    this.mostrarSugerenciaGuardar = false;
    this.cantidadPendiente = null;
    this.confirmar.emit(gramos);
    this.cdr.detectChanges();
  }

  onCancelar() {
    this.cancelar.emit();
  }

  toggleFavorito() {
    if (!this.alimento || this.actualizandoFavorito) return;
    const favoritoPrevio = this.alimento.favorito;
    this.alimento.favorito = true;
    this.actualizandoFavorito = true;
    this.alimentosService.toggleFavorito(this.alimento.id).subscribe({
      next: (res) => {
        this.alimento.favorito = res.alimento.favorito;
        this.actualizandoFavorito = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.alimento.favorito = favoritoPrevio;
        this.actualizandoFavorito = false;
        this.cdr.detectChanges();
      }
    });
  }
}
