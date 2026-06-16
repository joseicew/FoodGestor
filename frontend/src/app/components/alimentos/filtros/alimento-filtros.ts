import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-alimento-filtros',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './alimento-filtros.html',
  styleUrl: './alimento-filtros.css',
})
export class AlimentoFiltros {
  @Input() categorias: string[] = [];
  @Input() termino = '';
  @Input() categoria = '';
  @Input() mostrarCategoria = true;
  @Input() placeholder = '🔍 Buscar por nombre, marca...';

  @Output() terminoChange = new EventEmitter<string>();
  @Output() categoriaChange = new EventEmitter<string>();

  onTermino(valor: string) {
    this.termino = valor;
    this.terminoChange.emit(valor);
  }

  onCategoria(valor: string) {
    this.categoria = valor;
    this.categoriaChange.emit(valor);
  }
}
