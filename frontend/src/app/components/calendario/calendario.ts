import { Component, OnInit, ChangeDetectorRef, ViewChild } from '@angular/core';
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
import { MensajeFlash } from '../shared/mensaje-flash/mensaje-flash';

@Component({
  selector: 'app-calendario',
  imports: [CommonModule, FormsModule, BusquedaAlimentoComponent, MensajeFlash],
  templateUrl: './calendario.html',
  styleUrl: './calendario.css'
})
export class Calendario implements OnInit {
  @ViewChild(MensajeFlash) flash!: MensajeFlash;

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

    // Mostrar caché inmediatamente si no hay datos en pantalla (carga inicial o cambio de fecha)
    if (!this.diaActual) {
      const cached = this.cacheService.obtenerDia(fechaStr);
      if (cached) {
        this.diaActual = cached.comidas;
        this.totalesDiarios = cached.totales_diarios;
        this.limitesBase = cached.limites_base;
        this.porcentajes = cached.porcentajes;
        this.cargando = false;
        this.cdr.detectChanges();
      } else {
        this.cargando = true;
      }
    }
    // Si diaActual ya está puesto (post-mutación optimista), no sobreescribir con caché antigua

    // Refrescar desde servidor en background — merge in-place para no causar re-render visible
    this.calendarioService.obtenerDia(fechaStr).subscribe({
      next: (data) => {
        if (!this.diaActual || this.cacheService.haCambiadoDia(fechaStr, data)) {
          this.mergeCalendario(data);
          this.cacheService.guardarDia(fechaStr, data);
          this.cdr.detectChanges();
        }
        this.cargando = false;
      },
      error: (error) => {
        if (error.status === 404) {
          this.inicializarDiaVacio();
        } else if (!this.diaActual) {
          this.flash.mostrar('Error al cargar el día', 'error');
        }
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  /** Merge in-place: preserva referencias de objetos/arrays para evitar re-renders visibles */
  private mergeCalendario(data: any): void {
    // Totales, límites, porcentajes: actualizar propiedades sin cambiar referencia
    if (this.totalesDiarios) {
      Object.assign(this.totalesDiarios, data.totales_diarios);
    } else {
      this.totalesDiarios = data.totales_diarios;
    }
    if (this.limitesBase) {
      Object.assign(this.limitesBase, data.limites_base);
    } else {
      this.limitesBase = data.limites_base;
    }
    if (this.porcentajes) {
      Object.assign(this.porcentajes, data.porcentajes);
    } else {
      this.porcentajes = data.porcentajes;
    }

    const nuevasComidas = data.comidas;

    if (!this.diaActual) {
      this.diaActual = nuevasComidas;
      return;
    }

    // Merge por tipo de comida
    for (const tipo of this.comidas) {
      const nueva = nuevasComidas[tipo];
      if (!nueva) {
        this.diaActual[tipo] = null;
        continue;
      }
      if (!this.diaActual[tipo]) {
        this.diaActual[tipo] = nueva;
        continue;
      }
      // Merge arrays de raciones y alimentos in-place
      this.mergeArray(this.diaActual[tipo].raciones, nueva.raciones);
      this.mergeArray(this.diaActual[tipo].alimentos, nueva.alimentos);
      // Merge totales de la comida
      if (this.diaActual[tipo].totales) {
        Object.assign(this.diaActual[tipo].totales, nueva.totales);
      } else {
        this.diaActual[tipo].totales = { ...nueva.totales };
      }
    }
  }

  /** Actualiza un array in-place por id: añade nuevos, actualiza existentes, elimina obsoletos */
  private mergeArray(actual: any[], nueva: any[]): void {
    const nuevaIds = new Set(nueva.map((n: any) => n.id));
    // Eliminar los que ya no están (de atrás hacia delante para no saltar índices)
    for (let i = actual.length - 1; i >= 0; i--) {
      if (!nuevaIds.has(actual[i].id)) actual.splice(i, 1);
    }
    // Actualizar existentes o insertar nuevos
    for (const item of nueva) {
      const idx = actual.findIndex((a: any) => a.id === item.id);
      if (idx >= 0) {
        Object.assign(actual[idx], item);
      } else {
        actual.push(item);
      }
    }
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
    const cachedRaciones = this.cacheService.obtenerRaciones();
    if (cachedRaciones.length > 0) {
      this.raciones = cachedRaciones;
      this.racionesFiltradas = cachedRaciones;
    }
    this.racionesService.obtenerRaciones().subscribe({
      next: (data) => {
        if (this.cacheService.hanCambiadoRaciones(data || [])) {
          this.raciones = data || [];
          this.racionesFiltradas = data || [];
          this.cacheService.guardarRaciones(data || []);
        }
      },
      error: () => {
        if (this.raciones.length === 0) {
          this.raciones = [];
          this.racionesFiltradas = [];
        }
      }
    });
  }

  cargarAlimentos() {
    const cachedAlimentos = this.cacheService.obtenerAlimentos();
    if (cachedAlimentos.length > 0) {
      this.alimentos = cachedAlimentos;
    }
    this.alimentosService.obtenerAlimentos().subscribe({
      next: (data) => {
        if (this.cacheService.hanCambiadoAlimentos(data || [])) {
          this.alimentos = data || [];
          this.cacheService.guardarAlimentos(data || []);
        }
      },
      error: () => {
        if (this.alimentos.length === 0) this.alimentos = [];
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
    this.diaActual = null; // Permitir que cargarDia muestre caché de la nueva fecha
    this.cargarDia(nueva);
  }

  irHoy() {
    this.fechaSeleccionada = new Date();
    this.mostrarDatepicker = false;
    this.diaActual = null;
    this.cargarDia(this.fechaSeleccionada);
  }

  onFechaChange(evento: any) {
    const fecha = new Date(evento.target.value);
    this.fechaSeleccionada = fecha;
    this.mostrarDatepicker = false;
    this.diaActual = null;
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

    // Actualización visual instantánea
    if (this.diaActual?.[tipoComida]) {
      const yaExiste = this.diaActual[tipoComida].raciones.some((r: any) => r.id === racion.id);
      if (!yaExiste) {
        this.diaActual[tipoComida].raciones.push({ ...racion, cantidad: 1 });
        this.cdr.detectChanges();
      }
    }

    const fechaStr = this.formatoFecha(this.fechaSeleccionada);
    this.optimisticUpdateService.encolar({
      accion: () => this.calendarioService.agregarRacionAlComida(fechaStr, tipoComida, racion.id, 1),
      enExito: () => {
        this.flash.mostrar(`${racion.nombre} agregado`, 'exito');
        this.cargarDia(this.fechaSeleccionada);
      },
      enError: () => {
        this.flash.mostrar(`Error al guardar ${racion.nombre}`, 'error');
        this.cargarDia(this.fechaSeleccionada);
      }
    });
  }

  onSeleccionarAlimentoInline(tipoComida: string, alimento: any) {
    this.panelActivo = null;

    // Actualización visual instantánea
    if (this.diaActual?.[tipoComida]) {
      const yaExiste = this.diaActual[tipoComida].alimentos.some((a: any) => a.id === alimento.id);
      if (!yaExiste) {
        this.diaActual[tipoComida].alimentos.push({ ...alimento, cantidad: 100 });
        this.cdr.detectChanges();
      }
    }

    const fechaStr = this.formatoFecha(this.fechaSeleccionada);
    this.optimisticUpdateService.encolar({
      accion: () => this.calendarioService.agregarAlimentoAlComida(fechaStr, tipoComida, alimento.id, 100),
      enExito: () => {
        this.flash.mostrar(`${alimento.nombre} agregado`, 'exito');
        this.cargarDia(this.fechaSeleccionada);
      },
      enError: () => {
        this.flash.mostrar(`Error al guardar ${alimento.nombre}`, 'error');
        this.cargarDia(this.fechaSeleccionada);
      }
    });
  }

  // ── Remover items de comida ──

  removerRacion(tipoComida: string, racionId: number) {
    // Actualización visual instantánea
    if (this.diaActual?.[tipoComida]) {
      this.diaActual[tipoComida].raciones = this.diaActual[tipoComida].raciones.filter(
        (r: any) => r.id !== racionId
      );
      this.cdr.detectChanges();
    }

    const fechaStr = this.formatoFecha(this.fechaSeleccionada);
    this.optimisticUpdateService.encolar({
      accion: () => this.calendarioService.removerRacionDelComida(fechaStr, tipoComida, racionId),
      enExito: () => {
        this.flash.mostrar('Ración removida', 'exito');
        this.cargarDia(this.fechaSeleccionada);
      },
      enError: () => {
        this.flash.mostrar('Error al remover ración', 'error');
        this.cargarDia(this.fechaSeleccionada);
      }
    });
  }

  removerAlimento(tipoComida: string, alimentoId: number) {
    // Actualización visual instantánea
    if (this.diaActual?.[tipoComida]) {
      this.diaActual[tipoComida].alimentos = this.diaActual[tipoComida].alimentos.filter(
        (a: any) => a.id !== alimentoId
      );
      this.cdr.detectChanges();
    }

    const fechaStr = this.formatoFecha(this.fechaSeleccionada);
    this.optimisticUpdateService.encolar({
      accion: () => this.calendarioService.removerAlimentoDelComida(fechaStr, tipoComida, alimentoId),
      enExito: () => {
        this.flash.mostrar('Alimento removido', 'exito');
        this.cargarDia(this.fechaSeleccionada);
      },
      enError: () => {
        this.flash.mostrar('Error al remover alimento', 'error');
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
        this.flash.mostrar('❌ Error al actualizar cantidad. Reintentando...', 'error');
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
        this.flash.mostrar('❌ Error al actualizar cantidad. Reintentando...', 'error');
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

  tieneAlergeno(alimento: any): boolean {
    return this.allergensService.tieneAlergeno(alimento, this.intoleranciaUsuario);
  }
}
