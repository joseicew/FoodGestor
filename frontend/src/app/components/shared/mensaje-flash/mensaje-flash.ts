import { Component, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-mensaje-flash',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (texto) {
      <div class="mensaje" [class.error]="tipo === 'error'">{{ texto }}</div>
    }
  `
})
export class MensajeFlash {
  texto = '';
  tipo: 'exito' | 'error' = 'exito';
  private timer: any;

  constructor(private cdr: ChangeDetectorRef) {}

  mostrar(texto: string, tipo: 'exito' | 'error'): void {
    clearTimeout(this.timer);
    this.texto = texto;
    this.tipo = tipo;
    this.cdr.markForCheck();
    this.timer = setTimeout(() => {
      this.texto = '';
      this.cdr.markForCheck();
    }, 3000);
  }
}
