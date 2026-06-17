import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RacionesService } from '../../services/raciones';
import { AlimentosService } from '../../services/alimentos';
import { OptimisticUpdateService } from '../../services/optimistic-update';
import { SyncStatusService } from '../../services/sync-status';
import { CacheService } from '../../services/cache';
import { AllergensService } from '../../services/allergens';
import { AuthService } from '../../services/auth';
import { Chart, registerables } from 'chart.js';
import { ModalCantidadAlimentoComponent } from '../shared/modal-cantidad-alimento/modal-cantidad-alimento';
import { BusquedaAlimentoComponent } from '../shared/busqueda-alimento/busqueda-alimento';

Chart.register(...registerables);

@Component({
  selector: 'app-raciones',
  imports: [CommonModule, FormsModule, ModalCantidadAlimentoComponent, BusquedaAlimentoComponent],
  templateUrl: './raciones.html',
  styleUrl: './raciones.css',
})
export class Raciones implements OnInit, AfterViewInit {
  @ViewChild('macrosChart') macrosChartRef?: ElementRef;

  private macrosChart: Chart | null = null;
  private cantidadTimeout: any = null;
  private mensajeTimer: any = null;

  raciones: any[] = [];
  alimentos: any[] = [];

  activePanel: 'lista' | 'editar' = 'lista';
  racionSeleccionada: any = null;

  // Modal de crear ración
  mostrarModalCrear = false;
  nuevoRacionNombre = '';

  cargando = false;
  cargandoRaciones = true;
  cargandoOperacion = false;
  mensaje = '';
  mensajeTipo: 'exito' | 'error' = 'exito';

  // Modal para elegir cantidad al agregar alimento
  alimentoParaAgregar: any = null;

  // Alergias del usuario
  intoleranciaUsuario: string[] = [];


  constructor(
    private racionesService: RacionesService,
    private alimentosService: AlimentosService,
    private optimisticUpdateService: OptimisticUpdateService,
    private syncStatusService: SyncStatusService,
    private cacheService: CacheService,
    private cdr: ChangeDetectorRef,
    private allergensService: AllergensService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    // Cargar intolerancias del usuario
    const usuarioData = this.authService.obtenerUsuarioActual();
    if (usuarioData && usuarioData.intolerancias && Array.isArray(usuarioData.intolerancias)) {
      this.intoleranciaUsuario = usuarioData.intolerancias;
      console.log('✅ Intolerancias del usuario cargadas en raciones:', this.intoleranciaUsuario.length);
    } else {
      this.intoleranciaUsuario = [];
    }

    this.cargarRaciones();
    this.cargarAlimentos();
  }

  ngAfterViewInit() {
    if (this.racionSeleccionada && this.macrosChartRef) {
      setTimeout(() => this.crearGrafica(), 100);
    }
  }

  errorRed = false;

  cargarRaciones() {
    this.cargandoRaciones = true;
    this.errorRed = false;
    this.racionesService.obtenerRaciones().subscribe({
      next: (data) => {
        this.raciones = data || [];
        this.cargandoRaciones = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.cargandoRaciones = false;
        if (error.status === 0) {
          this.errorRed = true;
        }
        this.cdr.detectChanges();
      }
    });
  }

  cargarAlimentos() {
    this.alimentosService.obtenerAlimentos().subscribe({
      next: (data) => {
        this.alimentos = data || [];
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.log('Sin alimentos:', error.status);
        this.alimentos = [];
        this.cdr.detectChanges();
      }
    });
  }

  abrirModalCrear() {
    this.mostrarModalCrear = true;
    this.nuevoRacionNombre = '';
    this.cdr.detectChanges();
  }

  cerrarModalCrear() {
    this.mostrarModalCrear = false;
    this.nuevoRacionNombre = '';
  }


  crearRacion() {
    const nombre = this.nuevoRacionNombre.trim();
    if (!nombre) {
      this.mostrarMensaje('El nombre del ración es obligatorio', 'error');
      return;
    }

    this.mostrarModalCrear = false;

    // Crear ración temporal para mostrar inmediatamente
    const nuevoRacionTemp = {
      id: Date.now(),
      nombre: nombre,
      alimentos: [],
      descripcion: '',
      totales: { calorias: 0, proteinas: 0, hidratos_carbono: 0, grasas: 0, azucares: 0, fibra: 0, sal: 0 }
    };

    // Agregar localmente de inmediato
    this.raciones.push(nuevoRacionTemp);
    this.racionSeleccionada = { ...nuevoRacionTemp };
    this.cargando = false;

    // Sincronización optimista
    this.optimisticUpdateService.executar({
      updateLocal: () => {
        console.log(`📝 Ración "${nombre}" creada localmente`);
      },
      serverAction: () => this.racionesService.crearRacion({ nombre, descripcion: '' }),
      rollback: () => {
        // Revertir la ración local si falla
        const index = this.raciones.findIndex(r => r.id === nuevoRacionTemp.id);
        if (index !== -1) {
          this.raciones.splice(index, 1);
        }
        console.log('↩️ Ración removida (rollback)');
      },
      onSuccess: (res) => {
        // Reemplazar ID temporal con ID del servidor
        const index = this.raciones.findIndex(r => r.id === nuevoRacionTemp.id);
        if (index !== -1) {
          this.raciones[index] = res.racion;
          this.racionSeleccionada = { ...res.racion };
        }
      }
    }).subscribe({
      next: () => {
        this.nuevoRacionNombre = '';
        this.cargando = false;

        setTimeout(() => {
          this.activePanel = 'editar';
          this.mostrarMensaje(`✅ "${nombre}" creado`, 'exito');
          this.crearGrafica();
          this.cdr.detectChanges();
        }, 300);
      },
      error: (err) => {
        const msg = err.error?.error || 'Error al crear ración';
        this.mostrarMensaje(`❌ ${msg}. Reintentando...`, 'error');
        this.cargando = false;
      }
    });
  }

  seleccionarRacion(racion: any) {
    this.racionSeleccionada = { ...racion };
    this.activePanel = 'editar';
    this.cdr.detectChanges();

    // Crear gráfica después de que el DOM se renderice
    setTimeout(() => {
      this.crearGrafica();
    }, 300);
  }

  volverALista() {
    this.activePanel = 'lista';
    this.racionSeleccionada = null;
    this.cdr.detectChanges();
  }

  get alimentosEnRacionIds(): number[] {
    return this.racionSeleccionada?.alimentos?.map((a: any) => a.id) ?? [];
  }

  seleccionarAlimentoParaAgregar(alimento: any) {
    this.alimentoParaAgregar = alimento;
  }

  onConfirmarCantidad(gramos: number) {
    if (!this.racionSeleccionada || !this.alimentoParaAgregar) return;

    this.cargandoOperacion = true;
    this.cdr.detectChanges();

    const alimento = this.alimentoParaAgregar;

    this.racionesService.agregarAlimento(this.racionSeleccionada.id, alimento.id, gramos).subscribe({
      next: (res) => {
        this.racionSeleccionada = res.racion;

        const indexEnLista = this.raciones.findIndex(r => r.id === this.racionSeleccionada.id);
        if (indexEnLista >= 0) {
          this.raciones[indexEnLista] = { ...this.racionSeleccionada };
        }

        this.mostrarMensaje(`${alimento.nombre} agregado`, 'exito');
        this.cargandoOperacion = false;
        this.onCancelarCantidad();
        this.cdr.detectChanges();

        setTimeout(() => this.crearGrafica(), 100);
      },
      error: (err) => {
        const msg = err.status === 409
          ? '⚠️ Este alimento ya está en la ración'
          : (err.error?.error || 'Error al agregar alimento');
        this.mostrarMensaje(msg, 'error');
        if (err.status === 409) this.onCancelarCantidad();
        this.cargandoOperacion = false;
        this.cdr.detectChanges();
      }
    });
  }

  onCancelarCantidad() {
    this.alimentoParaAgregar = null;
  }

  removerAlimento(alimentoId: number) {
    if (!this.racionSeleccionada) return;

    this.cargandoOperacion = true;
    this.cdr.detectChanges();

    this.racionesService.removerAlimento(this.racionSeleccionada.id, alimentoId).subscribe({
      next: (res) => {
        this.racionSeleccionada = res.racion;

        const indexEnLista = this.raciones.findIndex(r => r.id === this.racionSeleccionada.id);
        if (indexEnLista >= 0) {
          this.raciones[indexEnLista] = { ...this.racionSeleccionada };
        }

        this.mostrarMensaje('Alimento removido', 'exito');
        this.cargandoOperacion = false;
        this.cdr.detectChanges();
        setTimeout(() => this.crearGrafica(), 100);
      },
      error: (err) => {
        if (err.status === 404) {
          // El alimento ya no estaba en la ración — limpiarlo del estado local
          this.racionSeleccionada.alimentos = this.racionSeleccionada.alimentos.filter(
            (a: any) => a.id !== alimentoId
          );
          const indexEnLista = this.raciones.findIndex((r: any) => r.id === this.racionSeleccionada.id);
          if (indexEnLista >= 0) {
            this.raciones[indexEnLista] = { ...this.racionSeleccionada };
          }
        } else {
          this.mostrarMensaje('Error al remover alimento', 'error');
        }
        this.cargandoOperacion = false;
        this.cdr.detectChanges();
      }
    });
  }

  actualizarCantidad(alimentoId: number, cantidadStr: string) {
    if (!this.racionSeleccionada) return;

    const cantidad = parseFloat(cantidadStr);
    if (isNaN(cantidad) || cantidad <= 0) {
      return;
    }

    // Limpiar timeout anterior si existe
    if (this.cantidadTimeout) {
      clearTimeout(this.cantidadTimeout);
    }

    // Guardar automáticamente después de 500ms sin más cambios
    this.cantidadTimeout = setTimeout(() => {
      this.racionesService.actualizarCantidad(this.racionSeleccionada.id, alimentoId, cantidad).subscribe({
        next: (res) => {
          this.racionSeleccionada = res.racion;

          // Actualizar el ración en la lista local también
          const indexEnLista = this.raciones.findIndex(r => r.id === this.racionSeleccionada.id);
          if (indexEnLista >= 0) {
            this.raciones[indexEnLista] = { ...this.racionSeleccionada };
          }

          this.cdr.detectChanges();
          setTimeout(() => this.crearGrafica(), 50);
        },
        error: () => {
          this.mostrarMensaje('Error al actualizar cantidad', 'error');
          this.cdr.detectChanges();
        }
      });
    }, 500);
  }

  eliminarRacion(racionId: number) {
    if (!confirm('¿Eliminar este ración?')) return;

    this.cargando = true;
    this.racionesService.eliminarRacion(racionId).subscribe({
      next: () => {
        this.raciones = this.raciones.filter(r => r.id !== racionId);
        this.mostrarMensaje('Ración eliminado', 'exito');
        this.racionSeleccionada = null;
        this.activePanel = 'lista';
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.mostrarMensaje('Error al eliminar ración', 'error');
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  private crearGrafica() {
    // Asegurar que el canvas existe y está disponible
    if (!this.macrosChartRef || !this.racionSeleccionada) {
      return;
    }

    try {
      const canvas = this.macrosChartRef.nativeElement;
      if (!canvas) {
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }

      // Destruir gráfica anterior si existe
      if (this.macrosChart) {
        this.macrosChart.destroy();
      }

      const totales = this.racionSeleccionada.totales;
      const caloriaProteinas = parseFloat(totales.proteinas) * 4;
      const caloriaHidratos = parseFloat(totales.hidratos_carbono) * 4;
      const caloriaGrasas = parseFloat(totales.grasas) * 9;
      const azucares = parseFloat(totales.azucares) || 0;
      const fibra = parseFloat(totales.fibra) || 0;
      const totalCalorias = caloriaProteinas + caloriaHidratos + caloriaGrasas;

      // Si no hay datos, no crear la gráfica
      if (totalCalorias === 0) {
        return;
      }

      // Calcular porcentajes
      const porcentajeProt = ((caloriaProteinas / totalCalorias) * 100).toFixed(1);
      const porcentajeHid = ((caloriaHidratos / totalCalorias) * 100).toFixed(1);
      const porcentajeGras = ((caloriaGrasas / totalCalorias) * 100).toFixed(1);

      this.macrosChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Proteínas', 'Hidratos', 'Grasas', 'Azúcares', 'Fibra'],
          datasets: [
            {
              label: 'Calorías / Gramos',
              data: [caloriaProteinas, caloriaHidratos, caloriaGrasas, azucares, fibra],
              backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#FF9F40', '#90EE90'],
              borderColor: ['#FF4573', '#2B8FD9', '#FFB82E', '#FF8C00', '#7CB342'],
              borderWidth: 1,
              borderRadius: 4,
              barPercentage: 0.5,
              categoryPercentage: 0.7
            }
          ]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                label: (context: any) => {
                  const value = context.parsed.x || 0;
                  const idx = context.dataIndex;
                  if (idx < 3) {
                    const percentages = [porcentajeProt, porcentajeHid, porcentajeGras];
                    const percentage = percentages[idx];
                    return `${value.toFixed(1)} kcal (${percentage}%)`;
                  } else {
                    return `${value.toFixed(1)}g`;
                  }
                }
              }
            }
          },
          scales: {
            x: {
              beginAtZero: true,
              ticks: {
                font: { size: 10 }
              }
            },
            y: {
              ticks: {
                font: { size: 11 }
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('Error creando gráfica:', error);
    }
  }

  private mostrarMensaje(texto: string, tipo: 'exito' | 'error') {
    clearTimeout(this.mensajeTimer);
    this.mensaje = texto;
    this.mensajeTipo = tipo;
    this.mensajeTimer = setTimeout(() => {
      this.mensaje = '';
      this.cdr.detectChanges();
    }, 3000);
  }

  tieneAlergeno(alimento: any): boolean {
    return this.allergensService.tieneAlergeno(alimento, this.intoleranciaUsuario);
  }
}
