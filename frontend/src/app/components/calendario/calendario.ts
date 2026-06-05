import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CalendarioService } from '../../services/calendario';
import { RacionesService } from '../../services/raciones';
import { AlimentosService } from '../../services/alimentos';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-calendario',
  imports: [CommonModule, FormsModule],
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
  alimentosFiltrados: any[] = [];

  // Estado de UI
  cargando = false;
  mostrarModalRacion = false;
  mostrarModalAlimento = false;
  tipoComidaActual: string | null = null;
  terminoBusquedaRacion = '';
  terminoBusquedaAlimento = '';
  mensaje = '';
  mensajeTipo: 'exito' | 'error' = 'exito';
  alimentoSeleccionadoParaAgregar: any = null;
  cantidadAlimento: string | number = 1;
  modoAgregarAlimento: 'unidades' | 'gramos' = 'unidades';

  constructor(
    private calendarioService: CalendarioService,
    private racionesService: RacionesService,
    private alimentosService: AlimentosService,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private router: Router
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
        this.alimentosFiltrados = data || [];
      },
      error: (error) => {
        // Si no hay alimentos, simplemente cargar array vacío (no es un error)
        console.log('Sin alimentos inicialmente:', error.status);
        this.alimentos = [];
        this.alimentosFiltrados = [];
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

  abrirModalRacion(tipoComida: string) {
    this.tipoComidaActual = tipoComida;
    this.terminoBusquedaRacion = '';
    this.racionesFiltradas = this.raciones;
    this.mostrarModalRacion = true;
  }

  cerrarModalRacion() {
    this.mostrarModalRacion = false;
    this.tipoComidaActual = null;
  }

  abrirModalAlimento(tipoComida: string) {
    this.tipoComidaActual = tipoComida;
    this.terminoBusquedaAlimento = '';
    this.alimentosFiltrados = this.alimentos;
    this.mostrarModalAlimento = true;
  }

  cerrarModalAlimento() {
    this.mostrarModalAlimento = false;
    this.tipoComidaActual = null;
    this.alimentoSeleccionadoParaAgregar = null;
    this.cantidadAlimento = 1;
    this.modoAgregarAlimento = 'unidades';
  }

  buscarRaciones() {
    if (!this.terminoBusquedaRacion.trim()) {
      this.racionesFiltradas = this.raciones;
      return;
    }

    const t = this.terminoBusquedaRacion.toLowerCase();
    this.racionesFiltradas = this.raciones.filter(r =>
      r.nombre.toLowerCase().includes(t)
    );
  }

  buscarAlimentos() {
    if (!this.terminoBusquedaAlimento.trim()) {
      // Ordenar favoritos primero
      this.alimentosFiltrados = [...this.alimentos].sort((a, b) => {
        if (a.favorito && !b.favorito) return -1;
        if (!a.favorito && b.favorito) return 1;
        return 0;
      });
      return;
    }

    const t = this.terminoBusquedaAlimento.toLowerCase();
    const filtrados = this.alimentos.filter(a =>
      a.nombre.toLowerCase().includes(t) ||
      a.marca.toLowerCase().includes(t)
    );

    // Ordenar favoritos primero en los resultados
    this.alimentosFiltrados = filtrados.sort((a, b) => {
      if (a.favorito && !b.favorito) return -1;
      if (!a.favorito && b.favorito) return 1;
      return 0;
    });
  }

  // ── Agregar items a comida ──

  agregarRacionAlComida(racion: any) {
    if (!this.tipoComidaActual) return;

    const fechaStr = this.formatoFecha(this.fechaSeleccionada);
    this.calendarioService.agregarRacionAlComida(
      fechaStr,
      this.tipoComidaActual,
      racion.id,
      1
    ).subscribe({
      next: () => {
        this.mostrarMensaje(`✓ ${racion.nombre} agregado`, 'exito');
        this.cargarDia(this.fechaSeleccionada);
        this.cerrarModalRacion();
      },
      error: () => this.mostrarMensaje('Error al agregar ración', 'error')
    });
  }

  seleccionarAlimentoParaAgregar(alimento: any) {
    this.alimentoSeleccionadoParaAgregar = alimento;
    this.cantidadAlimento = 1; // Por defecto, 1 ración/unidad
    this.modoAgregarAlimento = 'unidades'; // Por defecto, agregar por unidades
  }

  // Convertir fracciones a número decimal
  private convertirFraccionANumero(valor: string | number): number {
    const str = String(valor).trim();

    // Si contiene "/", es una fracción (ej: 1/2)
    if (str.includes('/')) {
      const partes = str.split('/');
      if (partes.length === 2) {
        const numerador = parseFloat(partes[0].trim());
        const denominador = parseFloat(partes[1].trim());
        if (!isNaN(numerador) && !isNaN(denominador) && denominador !== 0) {
          return numerador / denominador;
        }
      }
    }

    // Si es un número decimal normal
    const num = parseFloat(str);
    return !isNaN(num) ? num : 1;
  }

  agregarAlimentoAlComida() {
    if (!this.tipoComidaActual || !this.alimentoSeleccionadoParaAgregar) return;

    const fechaStr = this.formatoFecha(this.fechaSeleccionada);
    const alimento = this.alimentoSeleccionadoParaAgregar;

    let gramosAgregar = 0;

    if (this.modoAgregarAlimento === 'unidades') {
      // Modo: cantidad en unidades/raciones
      const cantidadNumerico = this.convertirFraccionANumero(this.cantidadAlimento);
      gramosAgregar = cantidadNumerico * 100; // Por defecto, 100g por ración
      if (alimento.peso_unidad) {
        // Si el alimento tiene unidad, usar ese peso
        gramosAgregar = cantidadNumerico * alimento.peso_unidad;
      }
    } else {
      // Modo: cantidad en gramos directamente
      gramosAgregar = this.convertirFraccionANumero(this.cantidadAlimento);
    }

    this.calendarioService.agregarAlimentoAlComida(
      fechaStr,
      this.tipoComidaActual,
      alimento.id,
      gramosAgregar
    ).subscribe({
      next: () => {
        this.mostrarMensaje(`✓ ${alimento.nombre} agregado`, 'exito');
        this.cargarDia(this.fechaSeleccionada);
        this.cerrarModalAlimento();
      },
      error: () => this.mostrarMensaje('Error al agregar alimento', 'error')
    });
  }

  // ── Remover items de comida ──

  removerRacion(tipoComida: string, racionId: number) {
    const fechaStr = this.formatoFecha(this.fechaSeleccionada);
    this.calendarioService.removerRacionDelComida(
      fechaStr,
      tipoComida,
      racionId
    ).subscribe({
      next: () => {
        this.mostrarMensaje('Ración removida', 'exito');
        this.cargarDia(this.fechaSeleccionada);
      },
      error: () => this.mostrarMensaje('Error al remover ración', 'error')
    });
  }

  removerAlimento(tipoComida: string, alimentoId: number) {
    const fechaStr = this.formatoFecha(this.fechaSeleccionada);
    this.calendarioService.removerAlimentoDelComida(
      fechaStr,
      tipoComida,
      alimentoId
    ).subscribe({
      next: () => {
        this.mostrarMensaje('Alimento removido', 'exito');
        this.cargarDia(this.fechaSeleccionada);
      },
      error: () => this.mostrarMensaje('Error al remover alimento', 'error')
    });
  }

  // ── Actualizar cantidades ──

  actualizarCantidadRacion(tipoComida: string, racionId: number, cantidad: string) {
    const cant = parseFloat(cantidad);
    if (isNaN(cant) || cant <= 0) return;

    const fechaStr = this.formatoFecha(this.fechaSeleccionada);
    this.calendarioService.actualizarCantidadRacion(
      fechaStr,
      tipoComida,
      racionId,
      cant
    ).subscribe({
      next: () => {
        this.cargarDia(this.fechaSeleccionada);
      },
      error: () => this.mostrarMensaje('Error al actualizar cantidad', 'error')
    });
  }

  actualizarCantidadAlimento(tipoComida: string, alimentoId: number, cantidad: string) {
    const cant = this.convertirFraccionANumero(cantidad);
    if (cant <= 0) return;

    const fechaStr = this.formatoFecha(this.fechaSeleccionada);
    this.calendarioService.actualizarCantidadAlimento(
      fechaStr,
      tipoComida,
      alimentoId,
      cant
    ).subscribe({
      next: () => {
        this.cargarDia(this.fechaSeleccionada);
      },
      error: () => this.mostrarMensaje('Error al actualizar cantidad', 'error')
    });
  }

  // ── Utilidades ──

  getColorPorcentaje(porcentaje: number): string {
    if (porcentaje > 100) return '#d32f2f'; // Rojo
    if (porcentaje > 80) return '#f57c00'; // Naranja
    return '#2e7d32'; // Verde
  }

  private mostrarMensaje(texto: string, tipo: 'exito' | 'error') {
    this.mensaje = texto;
    this.mensajeTipo = tipo;
    setTimeout(() => this.mensaje = '', 4000);
  }
}
