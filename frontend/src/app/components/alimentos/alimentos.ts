import { Component, OnInit, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MensajeFlash } from '../shared/mensaje-flash/mensaje-flash';
import { PageHeaderComponent } from '../shared/page-header/page-header';
import { AlimentosService } from '../../services/alimentos';
import { IngredientesService } from '../../services/ingredientes';
import { AuthService } from '../../services/auth';
import { AllergensService } from '../../services/allergens';
import { CacheService } from '../../services/cache';
import { CalendarioService } from '../../services/calendario';
import { AlimentoFiltros } from './filtros/alimento-filtros';
import { AlimentoLista } from './lista/alimento-lista';
import { AlimentoDetalle, CATEGORIAS } from './detalle/alimento-detalle';

@Component({
  selector: 'app-alimentos',
  standalone: true,
  imports: [CommonModule, FormsModule, AlimentoFiltros, AlimentoLista, AlimentoDetalle, MensajeFlash, PageHeaderComponent],
  templateUrl: './alimentos.html',
  styleUrl: './alimentos.css',
})
export class Alimentos implements OnInit {
  @ViewChild(MensajeFlash) flash!: MensajeFlash;

  activePanel: 'buscar' | 'favoritos' | 'actualizar' | 'sugerir' = 'buscar';
  esAdmin = false;

  readonly categorias = CATEGORIAS;

  alimentos: any[] = [];
  alimentosFiltrados: any[] = [];

  terminoBusqueda = '';
  categoriaFiltro = '';
  ocultarAlergicos = false;
  ocultarNoDeseados = false;

  alergenosDelUsuario: string[] = [];
  ingredientesNoDeseadosUsuario: number[] = [];
  perfilCargado = false;

  // Detalle
  alimentoDetalle: any = null;
  detalleEditable = false;

  cargando = false;

  // ── Sugerir ──
  readonly macrosSugerir: { key: 'proteinas' | 'grasas' | 'azucares' | 'calorias'; label: string; icono: string }[] = [
    { key: 'proteinas', label: 'Proteínas', icono: '💪' },
    { key: 'grasas', label: 'Grasas', icono: '🧈' },
    { key: 'azucares', label: 'Azúcares', icono: '🍬' },
    { key: 'calorias', label: 'Calorías', icono: '🔥' },
  ];
  macroPrioridad: 'proteinas' | 'grasas' | 'azucares' | 'calorias' = 'proteinas';
  limitesSugerir: Record<string, number> = {};
  restantesSugerir: Record<string, number> = {};
  sugerencias: any[] = [];
  sugerirCargando = false;
  private sugerirCalculadoUnaVez = false;

  // Verificación de ingredientes
  ingredientesAVerificar: any[] = [];
  totalIngredientesVerificar = 0;
  mostrarModalVerificarIngredientes = false;
  ingredienteActualVerificacion: any = null;
  alergenoDelIngrediente = '';
  alimentoSeleccionadoAlergenos: any = null;

  constructor(
    private alimentosService: AlimentosService,
    private ingredientesService: IngredientesService,
    private authService: AuthService,
    private allergensService: AllergensService,
    private cacheService: CacheService,
    private calendarioService: CalendarioService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    if (!this.authService.estaAutenticado()) {
      this.router.navigate(['/login']);
      return;
    }
    // Asegurar caché de ingredientes para colores
    if (!this.ingredientesService.estaCargado()) {
      this.ingredientesService.cargarTodosLosIngredientes().subscribe();
    }
    this.cargarAlimentos();
    this.actualizarIngredientesPendientes();
    this.cargarAlergenosUsuario();
  }

  // ── Datos ──
  cargarAlimentos() {
    // Caché solo si no hay datos aún (carga inicial), no en llamadas post-mutación
    if (this.alimentos.length === 0) {
      const cached = this.cacheService.obtenerAlimentos();
      if (cached.length > 0) {
        this.alimentos = cached;
        this.buscarAlimento();
        this.cdr.detectChanges();
      } else {
        this.cargando = true;
      }
    }

    // Refrescar desde servidor en background — silencioso si no hubo cambios
    this.alimentosService.obtenerAlimentos().subscribe({
      next: (data) => {
        this.cargando = false;
        if (this.cacheService.hanCambiadoAlimentos(data)) {
          this.alimentos = data;
          this.cacheService.guardarAlimentos(data);
          this.buscarAlimento();
          if (this.activePanel === 'sugerir') this.calcularSugerencias();
          this.cdr.detectChanges();
        }
      },
      error: () => {
        this.cargando = false;
        if (this.alimentos.length === 0) {
          this.flash.mostrar('Error al conectar con el servidor', 'error');
        }
      }
    });
  }

  buscarAlimento() {
    let resultado = this.alimentos;
    if (this.terminoBusqueda.trim()) {
      const t = this.terminoBusqueda.toLowerCase();
      resultado = resultado.filter(a =>
        a.nombre.toLowerCase().includes(t) ||
        a.marca.toLowerCase().includes(t) ||
        (a.categoria && a.categoria.toLowerCase().includes(t))
      );
    }
    if (this.categoriaFiltro) {
      resultado = resultado.filter(a => a.categoria === this.categoriaFiltro);
    }
    if (this.ocultarAlergicos) {
      resultado = resultado.filter(a => !this.tieneAlergiaUsuario(a));
    }
    if (this.ocultarNoDeseados) {
      resultado = resultado.filter(a => !this.tieneIngNoDeseadoUsuario(a));
    }
    this.alimentosFiltrados = [...resultado].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
    );
  }

  onTermino(valor: string) { this.terminoBusqueda = valor; this.buscarAlimento(); }
  onCategoria(valor: string) { this.categoriaFiltro = valor; this.buscarAlimento(); }
  onOcultarAlergicos(valor: boolean) { this.ocultarAlergicos = valor; this.buscarAlimento(); }
  onOcultarNoDeseados(valor: boolean) { this.ocultarNoDeseados = valor; this.buscarAlimento(); }

  // ── Pestañas ──
  cambiarPanel(panel: 'buscar' | 'favoritos' | 'actualizar' | 'sugerir') {
    this.activePanel = panel;
    this.terminoBusqueda = '';
    this.categoriaFiltro = '';
    this.cargarAlimentos();
    if (panel === 'sugerir' && !this.sugerirCalculadoUnaVez) {
      this.sugerirCalculadoUnaVez = true;
      this.cargarSugerencias();
    }
  }

  // ── Sugerir ──
  private formatoFechaHoy(): string {
    const hoy = new Date();
    const año = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
  }

  cargarSugerencias() {
    this.sugerirCargando = true;
    this.calendarioService.obtenerDia(this.formatoFechaHoy()).subscribe({
      next: (data) => {
        this.limitesSugerir = data.limites_base || {};
        const totales = data.totales_diarios || {};
        this.restantesSugerir = {};
        for (const key of Object.keys(this.limitesSugerir)) {
          this.restantesSugerir[key] = this.limitesSugerir[key] - (totales[key] || 0);
        }
        this.elegirMacroPorDefecto();
        this.sugerirCargando = false;
        this.calcularSugerencias();
        this.cdr.detectChanges();
      },
      error: () => {
        this.sugerirCargando = false;
        this.calcularSugerencias();
        this.cdr.detectChanges();
      }
    });
  }

  /** Preselecciona el macro del que el usuario tiene más margen disponible hoy */
  private elegirMacroPorDefecto() {
    let mejor: typeof this.macroPrioridad = 'proteinas';
    let mejorPct = -Infinity;
    for (const m of this.macrosSugerir) {
      const limite = this.limitesSugerir[m.key];
      if (!limite) continue;
      const pct = (this.restantesSugerir[m.key] ?? 0) / limite;
      if (pct > mejorPct) {
        mejorPct = pct;
        mejor = m.key;
      }
    }
    this.macroPrioridad = mejor;
  }

  seleccionarMacroPrioridad(macro: 'proteinas' | 'grasas' | 'azucares' | 'calorias') {
    this.macroPrioridad = macro;
    this.calcularSugerencias();
  }

  /**
   * Puntúa cada alimento: premia el aporte al macro elegido (relativo a lo que falta hoy)
   * y penaliza el aporte a los macros donde ya queda poco margen (o se ha superado el límite).
   */
  calcularSugerencias() {
    if (this.alimentos.length === 0) {
      this.sugerencias = [];
      return;
    }

    const macro = this.macroPrioridad;
    const otrosMacros = this.macrosSugerir.map(m => m.key).filter(m => m !== macro);
    const restante = this.restantesSugerir[macro] ?? 0;

    const puntuados = this.alimentos
      .filter(a => (a[macro] || 0) > 0) // sin aporte del macro buscado, no interesa
      .map(a => {
        const aporte = a[macro] || 0;
        const aportePct = restante > 0 ? (aporte / restante) * 100 : 0;

        let riesgo = 0;
        for (const m of otrosMacros) {
          const valor = a[m] || 0;
          const restanteM = this.restantesSugerir[m];
          const limiteM = this.limitesSugerir[m];
          if (restanteM == null || limiteM == null) continue;
          riesgo += restanteM > 0
            ? (valor / restanteM) * 100
            : (valor / limiteM) * 200; // ya se pasó del límite: penaliza el doble
        }

        return { alimento: a, score: aportePct - riesgo, aporte };
      });

    puntuados.sort((a, b) => b.score - a.score);

    // Gramos necesarios de ese alimento para cubrir lo que falta del macro elegido hoy.
    // Si hacen falta más de 500g, probablemente sea un aditivo o algo con aporte residual: se descarta.
    this.sugerencias = puntuados
      .map(p => {
        const gramosNecesarios = restante > 0
          ? Math.max(1, Math.round((restante / p.aporte) * 100))
          : 100;
        return { ...p, gramosNecesarios };
      })
      .filter(p => p.gramosNecesarios <= 500)
      .slice(0, 30)
      .map(p => {
      return {
        ...p.alimento,
        _gramosNecesarios: p.gramosNecesarios,
        _cantidad: p.gramosNecesarios
      };
    });
  }

  etiquetaSugerencia = (alimento: any): string | null => {
    const macro = this.macrosSugerir.find(m => m.key === this.macroPrioridad);
    const valor = alimento?.[this.macroPrioridad];
    if (!macro || valor == null) return null;
    const unidad = this.macroPrioridad === 'calorias' ? 'kcal' : 'g';
    return `${macro.icono} ${valor}${unidad} / 100g`;
  };

  ajustarCantidad(alimento: any, delta: number) {
    alimento._cantidad = Math.max(1, (alimento._cantidad || 0) + delta);
  }

  onCantidadInput(alimento: any, valor: string) {
    const num = parseFloat(valor);
    alimento._cantidad = !isNaN(num) && num > 0 ? num : 1;
  }

  /** Aporte real del macro elegido a la cantidad actualmente seleccionada */
  aporteEnCantidad(alimento: any): number {
    const valor100g = alimento[this.macroPrioridad] || 0;
    return Math.round((valor100g / 100) * (alimento._cantidad || 0) * 10) / 10;
  }

  /** Macros (distintos del elegido) que se superarían si se comiera la cantidad actual */
  macrosExcedidos(alimento: any): string[] {
    const otros = this.macrosSugerir.filter(m => m.key !== this.macroPrioridad);
    const excedidos: string[] = [];
    for (const m of otros) {
      const restanteM = this.restantesSugerir[m.key];
      if (restanteM == null) continue;
      const valor100g = alimento[m.key] || 0;
      const aporte = (valor100g / 100) * (alimento._cantidad || 0);
      if (aporte > restanteM) excedidos.push(m.label);
    }
    return excedidos;
  }

  navegarAnadir() {
    this.router.navigate(['/alimentos/nuevo']);
  }

  obtenerFavoritos() {
    return this.alimentos
      .filter(a => a.favorito)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
  }

  toggleFavorito(alimento: any) {
    this.alimentosService.toggleFavorito(alimento.id).subscribe({
      next: (res) => {
        alimento.favorito = res.alimento.favorito;
        this.flash.mostrar(alimento.favorito ? '⭐ Agregado a favoritos' : '☆ Removido de favoritos', 'exito');
        this.cdr.detectChanges();
      },
      error: () => this.flash.mostrar('Error al actualizar favorito', 'error')
    });
  }

  // ── Detalle ──
  abrirDetalle(alimento: any, editable: boolean) {
    this.alimentoDetalle = { ...alimento };
    this.detalleEditable = editable;
    this.cdr.detectChanges();
  }

  onDetalleCerrar() {
    this.alimentoDetalle = null;
    this.cdr.detectChanges();
  }

  onDetalleGuardado() {
    this.alimentoDetalle = null;
    this.cargarAlimentos();
    this.cdr.detectChanges();
  }

  onDetalleEliminado() {
    this.alimentoDetalle = null;
    this.cargarAlimentos();
    this.cdr.detectChanges();
  }

  // ── Alérgenos del usuario ──
  cargarAlergenosUsuario(): void {
    this.authService.obtenerPerfil().subscribe({
      next: (perfil) => {
        this.alergenosDelUsuario = perfil.alergenos_seleccionados || [];
        this.ingredientesNoDeseadosUsuario = perfil.ingredientes_no_deseados || [];
        this.esAdmin = perfil.rol === 'admin' || perfil.rol === 'superadmin';
        this.perfilCargado = true;
        this.cdr.detectChanges();
      },
      error: () => { this.perfilCargado = true; this.cdr.detectChanges(); }
    });
  }

  private resolverIngredientes(alimento: any): any[] {
    return (alimento.ingredientes || []).map((ing: any) => {
      if (typeof ing === 'object') return ing;
      return this.ingredientesService.obtenerIngredientePorNombre(ing) || { nombre: ing, alergenos_categorias: [] };
    });
  }

  tieneAlergiaUsuario = (alimento: any): boolean => {
    if (!alimento?.ingredientes || this.alergenosDelUsuario.length === 0) return false;
    return this.allergensService.tieneAlergeno(
      { ...alimento, ingredientes: this.resolverIngredientes(alimento) },
      this.alergenosDelUsuario
    );
  };

  tieneIngNoDeseadoUsuario = (alimento: any): boolean => {
    if (!alimento?.ingredientes || this.ingredientesNoDeseadosUsuario.length === 0) return false;
    return this.resolverIngredientes(alimento).some((ing: any) => {
      const id = ing?.id != null ? Number(ing.id) : null;
      return id != null && this.ingredientesNoDeseadosUsuario.includes(id);
    });
  };

  // ── Verificación de ingredientes ──
  actualizarIngredientesPendientes() {
    this.alimentosService.obtenerIngredientesSinVerificar().subscribe({
      next: (ingredientes) => {
        this.ingredientesAVerificar = ingredientes || [];
        this.totalIngredientesVerificar = this.ingredientesAVerificar.length;
        this.cdr.detectChanges();
      },
      error: () => {
        this.ingredientesAVerificar = [];
        this.totalIngredientesVerificar = 0;
        this.cdr.detectChanges();
      }
    });
  }

  abrirModalVerificarIngredientes() {
    this.alimentosService.obtenerIngredientesSinVerificar().subscribe({
      next: (ingredientes) => {
        this.ingredientesAVerificar = ingredientes || [];
        this.totalIngredientesVerificar = this.ingredientesAVerificar.length;

        if (this.ingredientesAVerificar.length > 0) {
          this.prepararIngredienteVerificacion(this.ingredientesAVerificar[0]);
          this.mostrarModalVerificarIngredientes = true;
          this.cdr.markForCheck();
        } else {
          this.flash.mostrar('No hay ingredientes para verificar', 'exito');
        }
      },
      error: () => this.flash.mostrar('Error al cargar ingredientes pendientes', 'error')
    });
  }

  private prepararIngredienteVerificacion(base: any) {
    const ingrediente = { ...base };
    if (typeof ingrediente.alergenos_categorias === 'string') {
      try { ingrediente.alergenos_categorias = JSON.parse(ingrediente.alergenos_categorias); }
      catch { ingrediente.alergenos_categorias = []; }
    }
    this.ingredienteActualVerificacion = ingrediente;
    this.alergenoDelIngrediente = ingrediente.alergenos_categorias && ingrediente.alergenos_categorias.length > 0
      ? ingrediente.alergenos_categorias[0] : '';

    const alergenosEnCache = this.allergensService.obtenerAlergenosSync();
    this.alimentoSeleccionadoAlergenos = {
      ...ingrediente,
      categorias_alergenos: alergenosEnCache.length > 0 ? alergenosEnCache : []
    };
    if (alergenosEnCache.length === 0) {
      this.cargarCategoriasAlergenos();
    }
  }

  cerrarModalVerificarIngredientes() {
    this.mostrarModalVerificarIngredientes = false;
    this.ingredienteActualVerificacion = null;
    this.ingredientesAVerificar = [];
    this.actualizarIngredientesPendientes();
    this.cargarAlimentos();
  }

  cargarCategoriasAlergenos() {
    this.alimentosService.obtenerCategoriasAlergenos().subscribe({
      next: (data: any) => {
        if (this.alimentoSeleccionadoAlergenos) {
          this.alimentoSeleccionadoAlergenos.categorias_alergenos = data.categorias || [];
        }
      },
      error: () => {}
    });
  }

  asignarAlergeno() {
    if (!this.ingredienteActualVerificacion) return;
    this.ingredienteActualVerificacion.alergenos_categorias = this.alergenoDelIngrediente
      ? [this.alergenoDelIngrediente] : [];
  }

  guardarIngredienteVerificado(ingrediente: any) {
    if (!ingrediente || !ingrediente.id) {
      this.flash.mostrar('Error: Ingrediente inválido', 'error');
      return;
    }
    this.alimentosService.actualizarIngrediente(ingrediente.id, {
      nombre: ingrediente.nombre,
      categoria: ingrediente.categoria,
      es_aditivo: ingrediente.es_aditivo,
      notas: ingrediente.notas,
      verificado: true,
      alergenos_categorias: ingrediente.alergenos_categorias || []
    }).subscribe({
      next: () => {
        this.flash.mostrar('Ingrediente verificado correctamente', 'exito');
        this.pasarAlSiguienteIngrediente(ingrediente.id);
      },
      error: () => this.flash.mostrar('Error al guardar el ingrediente', 'error')
    });
  }

  eliminarIngredienteIncorrecto(ingrediente: any) {
    if (!ingrediente || !ingrediente.id) {
      this.flash.mostrar('Error: Ingrediente inválido', 'error');
      return;
    }
    this.alimentosService.eliminarIngrediente(ingrediente.id).subscribe({
      next: () => {
        this.flash.mostrar('Ingrediente eliminado correctamente', 'exito');
        this.pasarAlSiguienteIngrediente(ingrediente.id);
      },
      error: () => this.flash.mostrar('Error al eliminar el ingrediente', 'error')
    });
  }

  private pasarAlSiguienteIngrediente(ingredienteId: number) {
    const index = this.ingredientesAVerificar.findIndex(ing => ing.id === ingredienteId);
    if (index >= 0) this.ingredientesAVerificar.splice(index, 1);

    if (this.ingredientesAVerificar.length > 0) {
      this.prepararIngredienteVerificacion(this.ingredientesAVerificar[0]);
    } else {
      this.flash.mostrar('¡Todos los ingredientes han sido procesados!', 'exito');
      this.cerrarModalVerificarIngredientes();
    }
    this.totalIngredientesVerificar = this.ingredientesAVerificar.length;
    this.cdr.markForCheck();
  }

  onMensajeDetalle(ev: { texto: string; tipo: 'exito' | 'error' }) {
    this.flash.mostrar(ev.texto, ev.tipo);
  }
}
