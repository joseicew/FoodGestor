import { Component, Input } from '@angular/core';

/**
 * Cabecera superior reutilizable: muestra el título de la pestaña actual
 * de forma compacta y consistente en todas las pantallas.
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    <header class="page-header">
      <h1 class="page-header-title">{{ titulo }}</h1>
    </header>
  `,
  styles: [`
    .page-header {
      flex-shrink: 0;
      text-align: center;
      padding: 8px 16px 10px;
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
  `]
})
export class PageHeaderComponent {
  @Input() titulo = '';
}
