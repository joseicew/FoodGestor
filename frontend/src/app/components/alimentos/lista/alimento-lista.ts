import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-alimento-lista',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alimento-lista.html',
  styleUrl: './alimento-lista.css',
})
export class AlimentoLista {
  @Input() alimentos: any[] = [];
  /** Resalta en rojo las tarjetas con alérgenos del usuario (pestaña Buscar). */
  @Input() resaltarAlergias = false;
  /** Mensaje cuando no hay resultados. */
  @Input() textoVacio = 'Sin resultados';
  /** Determina si la estrella aparece siempre marcada (Favoritos). */
  @Input() favoritosFijos = false;
  /** Función externa que decide si un alimento tiene alérgenos del usuario. */
  @Input() tieneAlergia: (alimento: any) => boolean = () => false;
  /** Función externa que decide si un alimento tiene ingredientes no deseados por el usuario. */
  @Input() tieneIngNoDeseado: (alimento: any) => boolean = () => false;

  @Output() seleccionar = new EventEmitter<any>();
  @Output() toggleFavorito = new EventEmitter<{ alimento: any; event: Event }>();

  onSeleccionar(alimento: any) {
    this.seleccionar.emit(alimento);
  }

  onToggleFavorito(alimento: any, event: Event) {
    event.stopPropagation();
    this.toggleFavorito.emit({ alimento, event });
  }
}
