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

  activePanel: 'buscar' | 'favoritos' | 'actualizar' = 'buscar';

  readonly categorias = CATEGORIAS;

  alimentos: any[] = [];
  alimentosFiltrados: any[] = [];

  terminoBusqueda = '';
  categoriaFiltro = '';

  alergenosDelUsuario: string[] = [];
  ingredientesNoDeseadosUsuario: number[] = [];
  perfilCargado = false;

  // Detalle
  alimentoDetalle: any = null;
  detalleEditable = false;

  cargando = false;

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
    this.alimentosFiltrados = resultado;
  }

  onTermino(valor: string) { this.terminoBusqueda = valor; this.buscarAlimento(); }
  onCategoria(valor: string) { this.categoriaFiltro = valor; this.buscarAlimento(); }

  // ── Pestañas ──
  cambiarPanel(panel: 'buscar' | 'favoritos' | 'actualizar') {
    this.activePanel = panel;
    this.terminoBusqueda = '';
    this.categoriaFiltro = '';
    this.cargarAlimentos();
  }

  navegarAnadir() {
    this.router.navigate(['/alimentos/nuevo']);
  }

  obtenerFavoritos() {
    return this.alimentos.filter(a => a.favorito);
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
