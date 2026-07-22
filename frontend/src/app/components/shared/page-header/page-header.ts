import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Cabecera superior reutilizable: muestra el título de la pestaña actual
 * de forma compacta y consistente en todas las pantallas. Opcionalmente
 * muestra un botón "ℹ️" de ayuda que la pantalla puede usar para abrir
 * su propio <app-modal-ayuda>.
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    <header class="page-header">
      <div class="page-header-row">
        <h1 class="page-header-title">{{ titulo }}</h1>
        @if (mostrarAyuda) {
          <button class="page-header-info" (click)="ayudaClick.emit()" title="¿Qué es esto?" aria-label="Ayuda">ℹ️</button>
        }
      </div>
    </header>
  `,
  styles: [`
    .page-header {
      flex-shrink: 0;
      text-align: center;
      padding: 8px 16px 10px;
    }
    .page-header-row {
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .page-header-title {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.2;
    }
    .page-header-info {
      position: absolute;
      right: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      font-size: 28px;
      line-height: 1;
      cursor: pointer;
      padding: 0;
      opacity: 0.85;
    }
    .page-header-info:hover { opacity: 1; }
  `]
})
export class PageHeaderComponent {
  @Input() titulo = '';
  @Input() mostrarAyuda = false;
  @Output() ayudaClick = new EventEmitter<void>();
}
