import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import { StatsService } from '../../services/stats';
import { AuthService } from '../../services/auth';

Chart.register(...registerables);

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stats.html',
  styleUrl: './stats.css'
})
export class StatsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('graficaCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  dias = 30;
  nuevoPeso: number | null = null;
  cargando = true;
  guardandoPeso = false;
  objetivoKcal = 0;
  pesoActual: number | null = null;

  private chart: Chart | null = null;
  private statsKcal: any[] = [];
  private pesoHistorico: any[] = [];

  constructor(
    private statsService: StatsService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    if (!this.authService.estaAutenticado()) {
      this.router.navigate(['/login']);
      return;
    }
    this.authService.obtenerPerfil().subscribe({
      next: p => { this.pesoActual = p.peso; this.nuevoPeso = p.peso; }
    });
  }

  ngAfterViewInit() {
    this.cargarDatos();
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }

  cargarDatos() {
    this.cargando = true;
    let kcalListo = false;
    let pesoListo = false;

    const intentarRenderizar = () => {
      if (kcalListo && pesoListo) {
        this.cargando = false;
        this.cdr.detectChanges();
        this.renderizarGrafica();
      }
    };

    this.statsService.obtenerStatsKcal(this.dias).subscribe({
      next: res => {
        this.statsKcal = res.dias;
        this.objetivoKcal = res.objetivo_kcal;
        kcalListo = true;
        intentarRenderizar();
      },
      error: () => { kcalListo = true; intentarRenderizar(); }
    });

    this.statsService.obtenerPesoHistorico(this.dias).subscribe({
      next: registros => {
        this.pesoHistorico = registros;
        if (registros.length > 0) {
          this.pesoActual = registros[registros.length - 1].peso;
        }
        pesoListo = true;
        intentarRenderizar();
      },
      error: () => { pesoListo = true; intentarRenderizar(); }
    });
  }

  private renderizarGrafica() {
    if (!this.canvasRef?.nativeElement) return;
    this.chart?.destroy();

    const labels = this.statsKcal.map(d => {
      const [, mes, dia] = d.fecha.split('-');
      return `${dia}/${mes}`;
    });

    // Mapa de peso por fecha para alinear con el eje X de kcal
    const pesoMap = new Map(this.pesoHistorico.map(r => [r.fecha, r.peso]));
    const pesoData = this.statsKcal.map(d => pesoMap.get(d.fecha) ?? null);

    this.chart = new Chart(this.canvasRef.nativeElement, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Kcal',
            data: this.statsKcal.map(d => d.calorias),
            backgroundColor: 'rgba(76, 175, 80, 0.6)',
            borderColor: '#388E3C',
            borderWidth: 1,
            yAxisID: 'y',
          },
          {
            type: 'line',
            label: 'Objetivo',
            data: this.statsKcal.map(() => this.objetivoKcal),
            borderColor: '#FF9800',
            borderWidth: 2,
            borderDash: [6, 4],
            pointRadius: 0,
            fill: false,
            yAxisID: 'y',
          },
          {
            type: 'line',
            label: 'Peso (kg)',
            data: pesoData,
            borderColor: '#2196F3',
            backgroundColor: 'rgba(33, 150, 243, 0.15)',
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: '#2196F3',
            fill: false,
            spanGaps: true,
            yAxisID: 'y2',
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { color: '#ccc', boxWidth: 12 } },
          tooltip: {
            callbacks: {
              label: ctx => {
                if (ctx.dataset.label === 'Peso (kg)') return ctx.parsed.y ? `Peso: ${ctx.parsed.y} kg` : '';
                if (ctx.dataset.label === 'Objetivo') return `Objetivo: ${ctx.parsed.y} kcal`;
                return `Kcal: ${ctx.parsed.y}`;
              }
            }
          }
        },
        scales: {
          x: { ticks: { color: '#aaa', maxRotation: 45 }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: {
            position: 'left',
            title: { display: true, text: 'Kcal', color: '#aaa' },
            ticks: { color: '#aaa' },
            grid: { color: 'rgba(255,255,255,0.08)' }
          },
          y2: {
            position: 'right',
            title: { display: true, text: 'Peso kg', color: '#2196F3' },
            ticks: { color: '#2196F3' },
            grid: { drawOnChartArea: false }
          }
        }
      }
    });
  }

  cambiarDias(d: number) {
    this.dias = d;
    this.cargarDatos();
  }

  guardarPeso() {
    if (!this.nuevoPeso || this.nuevoPeso <= 0) return;
    this.guardandoPeso = true;
    this.statsService.registrarPeso(this.nuevoPeso).subscribe({
      next: () => {
        this.guardandoPeso = false;
        this.pesoActual = this.nuevoPeso;
        this.cargarDatos();
      },
      error: () => { this.guardandoPeso = false; }
    });
  }
}
