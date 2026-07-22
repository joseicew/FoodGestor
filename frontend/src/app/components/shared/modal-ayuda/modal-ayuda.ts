import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Modal de ayuda reutilizable: explica una funcionalidad con texto y,
 * opcionalmente, una captura de pantalla real de la app. Se abre desde
 * un botón "ℹ️" junto al título de cada pantalla.
 */
@Component({
  selector: 'app-modal-ayuda',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-overlay" (click)="cerrar.emit()">
      <div class="modal-box" (click)="$event.stopPropagation()">
        <div class="modal-head">
          <h3>ℹ️ {{ titulo }}</h3>
          <button class="btn-close" (click)="cerrar.emit()" aria-label="Cerrar">✕</button>
        </div>

        <div class="ayuda-texto">
          <ng-content></ng-content>
        </div>

        @if (imagen) {
          <img class="ayuda-captura" [src]="imagen" [alt]="'Captura de pantalla: ' + titulo" />
        }

        <button class="btn-entendido" (click)="cerrar.emit()">Entendido</button>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5);
      display: flex; align-items: center; justify-content: center;
      z-index: 2000; padding: 20px;
    }
    .modal-box {
      width: 100%; max-width: 420px; max-height: 88vh; overflow-y: auto;
      background: var(--bg-surface, #1B2514); border-radius: var(--radius-lg, 16px);
      padding: 20px; display: flex; flex-direction: column; gap: 14px;
      box-shadow: var(--shadow-lg, 0 16px 32px rgba(0,0,0,.6));
    }
    .modal-head { display: flex; align-items: center; justify-content: space-between; }
    .modal-head h3 { margin: 0; font-size: 17px; font-weight: 700; color: var(--text-primary, #fff); }
    .btn-close {
      background: none; border: none; font-size: 18px; color: var(--text-secondary, #B0B0B0);
      cursor: pointer; padding: 4px 8px; line-height: 1;
    }
    .ayuda-texto {
      font-size: 14px; line-height: 1.55; color: var(--text-primary, #fff);
    }
    .ayuda-texto ::ng-deep p { margin: 0 0 10px; }
    .ayuda-texto ::ng-deep p:last-child { margin-bottom: 0; }
    .ayuda-texto ::ng-deep strong { color: var(--primary, #A4C639); }
    .ayuda-texto ::ng-deep ul { margin: 0 0 10px; padding-left: 20px; }
    .ayuda-captura {
      width: 100%; border-radius: var(--radius-md, 12px); border: 1px solid var(--border-color, #4A5A38);
      display: block;
    }
    .btn-entendido {
      background: var(--primary, #A4C639); color: #1B2514; border: none;
      border-radius: var(--radius-md, 12px); padding: 12px; font-weight: 700;
      font-size: 15px; cursor: pointer;
    }
  `]
})
export class ModalAyudaComponent {
  @Input() titulo = '';
  @Input() imagen?: string;
  @Output() cerrar = new EventEmitter<void>();
}
