import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { StatsService } from '../../services/stats';
import { AuthService } from '../../services/auth';
import { PageHeaderComponent } from '../shared/page-header/page-header';

interface SeccionResumen {
  key: string;
  label: string;
  icono: string;
  color: string;
  gramos: number;
  porcentaje: number;
}

// Debe seguir el mismo orden y las mismas claves que SECCIONES_ORDEN del
// backend (app/routes/calendario.py). Las secciones sin gramos no se pintan,
// asi que tener varias no recarga la pantalla.
const SECCIONES_CONFIG: Omit<SeccionResumen, 'gramos' | 'porcentaje'>[] = [
  { key: 'carbohidratos', label: 'Carbohidratos', icono: '🌾', color: '#FFB74D' },
  { key: 'proteinas', label: 'Proteínas', icono: '🍗', color: '#EF5350' },
  { key: 'grasas', label: 'Grasas', icono: '🥑', color: '#8D6E63' },
  { key: 'frutas_verduras', label: 'Frutas y verduras', icono: '🥕', color: '#66BB6A' },
  { key: 'snacks', label: 'Snacks', icono: '🍪', color: '#BA68C8' },
  { key: 'bebidas', label: 'Bebidas', icono: '🥤', color: '#42A5F5' },
  { key: 'platos_preparados', label: 'Platos preparados', icono: '🍲', color: '#FF8A65' },
  { key: 'condimentos', label: 'Condimentos y salsas', icono: '🧂', color: '#9575CD' },
  { key: 'otros', label: 'Otros', icono: '🍽️', color: '#78909C' },
];

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent],
  templateUrl: './stats.html',
  styleUrl: './stats.css'
})
export class StatsComponent implements OnInit {
  nuevoPeso: number | null = null;
  guardandoPeso = false;
  pesoActual: number | null = null;

  cargandoResumen = true;
  totalGramosHoy = 0;
  secciones: SeccionResumen[] = [];

  constructor(
    private statsService: StatsService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    if (!this.authService.estaAutenticado()) {
      this.router.navigate(['/login']);
      return;
    }
    this.authService.obtenerPerfil().subscribe({
      next: p => { this.pesoActual = p.peso; this.nuevoPeso = p.peso; }
    });
    this.cargarResumen();
  }

  cargarResumen() {
    this.cargandoResumen = true;
    this.statsService.obtenerResumenCategorias().subscribe({
      next: res => {
        const gramosPorSeccion = res.secciones || {};
        this.totalGramosHoy = Object.values(gramosPorSeccion).reduce((acc: number, g: any) => acc + (g || 0), 0);
        this.secciones = SECCIONES_CONFIG.map(s => {
          const gramos = gramosPorSeccion[s.key] || 0;
          return {
            ...s,
            gramos,
            porcentaje: this.totalGramosHoy > 0 ? Math.round((gramos / this.totalGramosHoy) * 100) : 0
          };
        });
        this.cargandoResumen = false;
      },
      error: () => { this.cargandoResumen = false; }
    });
  }

  guardarPeso() {
    if (!this.nuevoPeso || this.nuevoPeso <= 0) return;
    this.guardandoPeso = true;
    this.statsService.registrarPeso(this.nuevoPeso).subscribe({
      next: () => {
        this.guardandoPeso = false;
        this.pesoActual = this.nuevoPeso;
      },
      error: () => { this.guardandoPeso = false; }
    });
  }
}
