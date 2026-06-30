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

  /** minúsculas + sin tildes, para comparar ignorando acentos */
  private normalizar(s: string): string {
    return (s || '').toString().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  }

  filtrar() {
    let lista = this.excluirIds.length > 0
      ? this.alimentos.filter(a => !this.excluirIds.includes(a.id))
      : this.alimentos;

    const t = this.normalizar(this.termino.trim());

    if (!t) {
      this.filtrados = this.mostrarTodos ? this.sortFavoritos(lista) : [];
      return;
    }

    // Cada palabra debe aparecer (tipo %like% AND) en nombre, marca o código de barras
    const palabras = t.split(/\s+/).filter(Boolean);
    this.filtrados = this.sortFavoritos(
      lista.filter(a => {
        const texto = this.normalizar(`${a.nombre || ''} ${a.marca || ''} ${a.codigo_barras || ''}`);
        return palabras.every(p => texto.includes(p));
      })
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
