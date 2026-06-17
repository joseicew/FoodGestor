import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CalendarioService } from '../../services/calendario';
import { RacionesService } from '../../services/raciones';
import { AlimentosService } from '../../services/alimentos';
import { AuthService } from '../../services/auth';
import { OptimisticUpdateService } from '../../services/optimistic-update';
import { CacheService } from '../../services/cache';
import { AllergensService } from '../../services/allergens';
import { BusquedaAlimentoComponent } from '../shared/busqueda-alimento/busqueda-alimento';

@Component({
  selector: 'app-calendario',
  imports: [CommonModule, FormsModule, BusquedaAlimentoComponent],
  templateUrl: './calendario.html',
  styleUrl: './calendario.css'
})
export class Calendario implements OnInit {

  // Estado de fecha
  fechaSeleccionada: Date = new Date();
  mostrarDatepicker = false;

  // Datos del día
  diaActual: any = null;
  comidas = ['desayuno', 'almuerzo', 'comida', 'merienda', 'cena'];
  seccionesAbiertas: { [key: string]: boolean } = {
    desayuno: true,
    almuerzo: false,
    comida: false,
    merienda: false,
    cena: false
  };

  // Totales diarios
  totalesDiarios: any = {
    calorias: 0,
    proteinas: 0,
    grasas: 0,
    azucares: 0
  };

  limitesBase: any = {
    calorias: 2500,
    proteinas: 100,
    grasas: 80,
    azucares: 62  // OMS: menos del 10% de calorías diarias (2500 * 0.10 / 4 = 62.5g)
  };

  porcentajes: any = {
    calorias: 0,
    proteinas: 0,
    grasas: 0,
    azucares: 0
  };

  // Listas para modales
  raciones: any[] = [];
  alimentos: any[] = [];
  racionesFiltradas: any[] = [];

  // Estado de UI
  cargando = false;
  panelActivo: { tipoComida: string; modo: 'racion' | 'alimento' } | null = null;
  terminoBusquedaRacion = '';
  mensaje = '';
  mensajeTipo: 'exito' | 'error' = 'exito';
  private mensajeTimer: any = null;
  // Alergias del usuario
  intoleranciaUsuario: string[] = [];

  constructor(
    private calendarioService: CalendarioService,
    private racionesService: RacionesService,
    private alimentosService: AlimentosService,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private router: Router,
    private optimisticUpdateService: OptimisticUpdateService,
    private cacheService: CacheService,
    private allergensService: AllergensService
  ) {}

  ngOnInit() {
    // Verificar autenticación
    console.log('🔍 [Calendario.ngOnInit] Verificando autenticación...');
    if (!this.authService.estaAutenticado()) {
      console.warn('⚠️ [Calendario.ngOnInit] No autenticado, redirigiendo a login');
      this.router.navigate(['/login']);
      return;
    }

    console.log('✓ [Calendario.ngOnInit] Autenticado, cargando datos...');

    // Cargar intolerancias del usuario
    const usuarioData = this.authService.obtenerUsuarioActual();
    if (usuarioData && usuarioData.intolerancias && Array.isArray(usuarioData.intolerancias)) {
      this.intoleranciaUsuario = usuarioData.intolerancias;
      console.log('✅ Intolerancias del usuario cargadas:', this.intoleranciaUsuario.length);
    } else {
      this.intoleranciaUsuario = [];
    }

    this.cargarDia(this.fechaSeleccionada);
    this.cargarRaciones();
    this.cargarAlimentos();
  }

  // ── Carga de datos ──

  cargarDia(fecha: Date) {
    const fechaStr = this.formatoFecha(fecha);
    this.cargando = true;

    this.calendarioService.obtenerDia(fechaStr).subscribe({
      next: (data) => {
        this.diaActual = data.comidas;
        this.totalesDiarios = data.totales_diarios;
        this.limitesBase = data.limites_base;
        this.porcentajes = data.porcentajes;
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        // Si es 404 (no hay datos para este día), cargar estado vacío sin error
        if (error.status === 404) {
          this.inicializarDiaVacio();
        } else {
          this.mostrarMensaje('Error al cargar el día', 'error');
        }
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  private inicializarDiaVacio() {
    /**Inicializa un día vacío con estructura base*/
    this.diaActual = {
      'desayuno': null,
      'almuerzo': null,
      'comida': null,
      'merienda': null,
      'cena': null
    };
    this.totalesDiarios = {
      calorias: 0,
      proteinas: 0,
      grasas: 0,
      azucares: 0
    };
    this.limitesBase = {};
    this.porcentajes = {};
  }

  cargarRaciones() {
    this.racionesService.obtenerRaciones().subscribe({
      next: (data) => {
        this.raciones = data || [];
        this.racionesFiltradas = data || [];
      },
      error: (error) => {
        // Si no hay raciones, simplemente cargar array vacío (no es un error)
        console.log('Sin raciones inicialmente:', error.status);
        this.raciones = [];
        this.racionesFiltradas = [];
      }
    });
  }

  cargarAlimentos() {
    this.alimentosService.obtenerAlimentos().subscribe({
      next: (data) => {
        this.alimentos = data || [];
      },
      error: (error) => {
        console.log('Sin alimentos inicialmente:', error.status);
        this.alimentos = [];
      }
    });
  }

  // ── Navegación de fechas ──

  formatoFecha(fecha: Date): string {
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
  }

  cambiarFecha(dias: number) {
    const nueva = new Date(this.fechaSeleccionada);
    nueva.setDate(nueva.getDate() + dias);
    this.fechaSeleccionada = nueva;
    this.cargarDia(nueva);
  }

  irHoy() {
    this.fechaSeleccionada = new Date();
    this.mostrarDatepicker = false;
    this.cargarDia(this.fechaSeleccionada);
  }

  onFechaChange(evento: any) {
    const fecha = new Date(evento.target.value);
    this.fechaSeleccionada = fecha;
    this.mostrarDatepicker = false;
    this.cargarDia(fecha);
  }

  toggleDatepicker() {
    this.mostrarDatepicker = !this.mostrarDatepicker;
  }

  // ── Secciones colapsables ──

  toggleSeccion(tipo: string) {
    this.seccionesAbiertas[tipo] = !this.seccionesAbiertas[tipo];
  }

  // ── Modales ──

  buscarRaciones() {
    const t = this.terminoBusquedaRacion.toLowerCase().trim();
    this.racionesFiltradas = t
      ? this.raciones.filter(r => r.nombre.toLowerCase().includes(t))
      : this.raciones;
  }

  // ── Panel inline ──

  togglePanel(tipoComida: string, modo: 'racion' | 'alimento') {
    const mismoPanel = this.panelActivo?.tipoComida === tipoComida && this.panelActivo?.modo === modo;
    if (mismoPanel) {
      this.panelActivo = null;
    } else {
      this.terminoBusquedaRacion = '';
      this.racionesFiltradas = this.raciones;
      this.panelActivo = { tipoComida, modo };
    }
  }

  // ── Agregar items a comida ──

  onSeleccionarRacionInline(tipoComida: string, racion: any) {
    this.panelActivo = null;
    const fechaStr = this.formatoFecha(this.fechaSeleccionada);
    this.optimisticUpdateService.agregarRacionOptimista(
      fechaStr, tipoComida, racion.id, 1, this.diaActual,
      () => this.calendarioService.agregarRacionAlComida(fechaStr, tipoComida, racion.id, 1)
    ).subscribe({
      next: () => {
        this.cargarDia(this.fechaSeleccionada);
        this.mostrarMensaje(`✅ ${racion.nombre} agregado`, 'exito');
      },
      error: (err) => {
        console.error('Error al agregar ración:', err);
        this.mostrarMensaje(`❌ Error al guardar ${racion.nombre}`, 'error');
      }
    });
  }

  onSeleccionarAlimentoInline(tipoComida: string, alimento: any) {
    this.panelActivo = null;
    const fechaStr = this.formatoFecha(this.fechaSeleccionada);
    this.optimisticUpdateService.agregarAlimentoOptimista(
      fechaStr, tipoComida, alimento.id, 100,
      () => this.calendarioService.agregarAlimentoAlComida(fechaStr, tipoComida, alimento.id, 100)
    ).subscribe({
      next: () => {
        this.cargarDia(this.fechaSeleccionada);
        this.mostrarMensaje(`✅ ${alimento.nombre} agregado`, 'exito');
      },
      error: (err) => {
        console.error('Error al agregar alimento:', err);
        this.mostrarMensaje(`❌ Error al guardar ${alimento.nombre}`, 'error');
      }
    });
  }

  // ── Remover items de comida ──

  removerRacion(tipoComida: string, racionId: number) {
    if (this.diaActual[tipoComida]) {
      this.diaActual[tipoComida].raciones = this.diaActual[tipoComida].raciones.filter(
        (r: any) => r.id !== racionId
      );
      this.cdr.detectChanges();
    }

    const fechaStr = this.formatoFecha(this.fechaSeleccionada);
    this.calendarioService.removerRacionDelComida(fechaStr, tipoComida, racionId).subscribe({
      next: () => {
        this.mostrarMensaje('Ración removida', 'exito');
        this.cargarDia(this.fechaSeleccionada);
      },
      error: () => {
        this.mostrarMensaje('Error al remover ración', 'error');
        this.cargarDia(this.fechaSeleccionada);
      }
    });
  }

  removerAlimento(tipoComida: string, alimentoId: number) {
    if (this.diaActual[tipoComida]) {
      this.diaActual[tipoComida].alimentos = this.diaActual[tipoComida].alimentos.filter(
        (a: any) => a.id !== alimentoId
      );
      this.cdr.detectChanges();
    }

    const fechaStr = this.formatoFecha(this.fechaSeleccionada);
    this.calendarioService.removerAlimentoDelComida(fechaStr, tipoComida, alimentoId).subscribe({
      next: () => {
        this.mostrarMensaje('Alimento removido', 'exito');
        this.cargarDia(this.fechaSeleccionada);
      },
      error: () => {
        this.mostrarMensaje('Error al remover alimento', 'error');
        this.cargarDia(this.fechaSeleccionada);
      }
    });
  }

  // ── Actualizar cantidades ──

  actualizarCantidadRacion(tipoComida: string, racionId: number, cantidad: string) {
    const cant = parseFloat(cantidad);
    if (isNaN(cant) || cant <= 0) return;

    const fechaStr = this.formatoFecha(this.fechaSeleccionada);

    // Sincronización optimista para actualizar cantidad
    this.optimisticUpdateService.actualizarCantidadRacionOptimista(
      fechaStr,
      tipoComida,
      racionId,
      cant,
      () => this.calendarioService.actualizarCantidadRacion(
        fechaStr,
        tipoComida,
        racionId,
        cant
      )
    ).subscribe({
      next: () => {
        this.cargarDia(this.fechaSeleccionada);
      },
      error: (err) => {
        console.error('Error al actualizar cantidad:', err);
        this.mostrarMensaje('❌ Error al actualizar cantidad. Reintentando...', 'error');
      }
    });
  }

  actualizarCantidadAlimento(tipoComida: string, alimentoId: number, cantidad: string) {
    const str = String(cantidad).trim();
    let cant: number;
    if (str.includes('/')) {
      const [num, den] = str.split('/').map(p => parseFloat(p.trim()));
      cant = (!isNaN(num) && !isNaN(den) && den !== 0) ? num / den : 1;
    } else {
      cant = parseFloat(str) || 1;
    }
    if (cant <= 0) return;

    const fechaStr = this.formatoFecha(this.fechaSeleccionada);

    // Sincronización optimista para actualizar cantidad
    this.optimisticUpdateService.actualizarCantidadAlimentoOptimista(
      fechaStr,
      tipoComida,
      alimentoId,
      cant,
      () => this.calendarioService.actualizarCantidadAlimento(
        fechaStr,
        tipoComida,
        alimentoId,
        cant
      )
    ).subscribe({
      next: () => {
        this.cargarDia(this.fechaSeleccionada);
      },
      error: (err) => {
        console.error('Error al actualizar cantidad:', err);
        this.mostrarMensaje('❌ Error al actualizar cantidad. Reintentando...', 'error');
      }
    });
  }

  // ── Utilidades ──

  getColorPorcentaje(porcentaje: number): string {
    if (porcentaje > 100) return '#d32f2f';
    if (porcentaje > 80) return '#f57c00';
    return '#2e7d32';
  }

  getColorBarra(porcentaje: number): string {
    if (porcentaje <= 80) return '#a5d6a7';
    if (porcentaje <= 100) return '#ffcc80';
    // Más del 100%: rojo que se intensifica progresivamente
    const exceso = Math.min(porcentaje - 100, 100); // 0–100 de exceso
    const lightness = Math.round(75 - (exceso / 100) * 30); // 75% → 45%
    return `hsl(0, 80%, ${lightness}%)`;
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
