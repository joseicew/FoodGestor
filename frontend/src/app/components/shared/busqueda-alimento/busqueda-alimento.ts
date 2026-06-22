import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-busqueda-alimento',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './busqueda-alimento.html',
  styleUrl: './busqueda-alimento.css'
})
export class BusquedaAlimentoComponent implements OnChanges {
  @Input() alimentos: any[] = [];
  @Input() excluirIds: number[] = [];
  /** false = solo muestra resultados al escribir; true = muestra todos al abrir */
  @Input() mostrarTodos = false;
  @Output() seleccionar = new EventEmitter<any>();

  termino = '';
  filtrados: any[] = [];

  ngOnChanges(changes: SimpleChanges) {
    if (changes['alimentos'] || changes['excluirIds']) {
      this.filtrar();
    }
  }

  filtrar() {
    let lista = this.excluirIds.length > 0
      ? this.alimentos.filter(a => !this.excluirIds.includes(a.id))
      : this.alimentos;

    if (!this.termino.trim()) {
      this.filtrados = this.mostrarTodos ? this.sortFavoritos(lista) : [];
      return;
    }

    const t = this.termino.toLowerCase();
    this.filtrados = this.sortFavoritos(
      lista.filter(a =>
        a.nombre?.toLowerCase().includes(t) ||
        a.marca?.toLowerCase().includes(t)
      )
    );
  }

  private sortFavoritos(lista: any[]): any[] {
    return [...lista].sort((a, b) => {
      if (a.favorito && !b.favorito) return -1;
      if (!a.favorito && b.favorito) return 1;
      return 0;
    });
  }
}
