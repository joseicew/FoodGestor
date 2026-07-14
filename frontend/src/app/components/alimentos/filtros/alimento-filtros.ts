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
  @Input() ocultarAlergicos = false;
  @Input() ocultarNoDeseados = false;

  @Output() terminoChange = new EventEmitter<string>();
  @Output() categoriaChange = new EventEmitter<string>();
  @Output() ocultarAlergicosChange = new EventEmitter<boolean>();
  @Output() ocultarNoDeseadosChange = new EventEmitter<boolean>();

  onTermino(valor: string) {
    this.termino = valor;
    this.terminoChange.emit(valor);
  }

  onCategoria(valor: string) {
    this.categoria = valor;
    this.categoriaChange.emit(valor);
  }

  toggleOcultarAlergicos() {
    this.ocultarAlergicos = !this.ocultarAlergicos;
    this.ocultarAlergicosChange.emit(this.ocultarAlergicos);
  }

  toggleOcultarNoDeseados() {
    this.ocultarNoDeseados = !this.ocultarNoDeseados;
    this.ocultarNoDeseadosChange.emit(this.ocultarNoDeseados);
  }
}
