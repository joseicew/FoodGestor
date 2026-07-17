import { Component, Input, Output, EventEmitter, OnChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AlimentosService } from '../../../services/alimentos';
import { IngredientesService } from '../../../services/ingredientes';
import { AiVisionService } from '../../../services/ai-vision';
import { OcrAsyncService } from '../../../services/ocr-async';
import { ReportesService } from '../../../services/reportes';

type OcrEstado = 'idle' | 'preparando' | 'analizando' | 'listo' | 'error';

export const CAMPOS_REPORTE = [
  { key: 'macros', label: 'Macros' },
  { key: 'ingredientes', label: 'Ingredientes' },
  { key: 'marca', label: 'Marca' },
  { key: 'otro', label: 'Otro' },
];

export const MACROS_REPORTE = [
  { key: 'calorias', label: 'Calorías' },
  { key: 'proteinas', label: 'Proteínas' },
  { key: 'grasas', label: 'Grasas' },
  { key: 'grasas_saturadas', label: 'Grasas saturadas' },
  { key: 'hidratos_carbono', label: 'Hidratos de carbono' },
  { key: 'azucares', label: 'Azúcares' },
  { key: 'fibra', label: 'Fibra' },
  { key: 'sal', label: 'Sal' },
  { key: 'sodio', label: 'Sodio' },
  { key: 'potasio', label: 'Potasio' },
  { key: 'calcio', label: 'Calcio' },
  { key: 'hierro', label: 'Hierro' },
];

export const CATEGORIAS = [
  'Carnes y Aves', 'Pescados y Mariscos', 'Lácteos y Huevos', 'Frutas',
  'Verduras y Hortalizas', 'Cereales y Derivados', 'Legumbres', 'Grasas y Aceites',
  'Frutos Secos', 'Bebidas', 'Snacks y Aperitivos', 'Dulces y Repostería',
  'Condimentos y Salsas', 'Platos Preparados', 'Suplementos', 'Otros',
];

export const UNIDADES_COMUNES = [
  'Bolsa', 'Pieza', 'Rebanada', 'Loncha', 'Lata', 'Bote', 'Botella', 'Barrita', 'Galleta',
];

@Component({
  selector: 'app-alimento-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './alimento-detalle.html',
  styleUrl: './alimento-detalle.css',
})
export class AlimentoDetalle implements OnChanges {
  @Input() alimento: any = null;
  @Input() editable = false;
  @Input() alergenosUsuario: string[] = [];
  @Input() ingredientesNoDeseados: number[] = [];

  @Output() cerrar = new EventEmitter<void>();
  @Output() guardado = new EventEmitter<void>();
  @Output() eliminado = new EventEmitter<void>();
  @Output() mensaje = new EventEmitter<{ texto: string; tipo: 'exito' | 'error' }>();

  readonly categorias = CATEGORIAS;
  readonly unidadesComunes = UNIDADES_COMUNES;

  // Copia de trabajo del alimento
  detalle: any = null;

  // Originales para autosave al cerrar
  private categoriaOriginal = '';
  private pesoOriginal: number | null = null;
  private unidadOriginal: string | null = null;
  private medidaOriginal: string | null = null;

  cargandoDetalles = false;
  cargandoEliminar = false;

  mostrarDropdownEdicion = false;
  mostrarDropdownMacros = false;

  mostrarEditorIngredientes = false;
  mostrarEditorMacros = false;
  cargandoIngrediente = false;
  nuevoIngrediente = '';
  ingredientesFiltrados: string[] = [];
  todosLosIngredientes: Set<string> = new Set();

  mostrarAlergenosPopup = false;
  ingredienteMostrandoAlergenos: any = null;
  popoverStyle: any = {};

  mostrarModalConfirmacionEliminar = false;

  ocrIngredientesEstado: OcrEstado = 'idle';
  ocrMacrosEstado: OcrEstado = 'idle';

  readonly camposReporte = CAMPOS_REPORTE;
  readonly macrosReporte = MACROS_REPORTE;
  mostrarModalReportar = false;
  reportarCampos: string[] = [];
  reportarDetalleMacros: { campo: string; valor: string }[] = [];
  reportarDetalleIngredientes: { nombre: string; correccion: string }[] = [];
  reportarMarcaCorrecta = '';
  reportarComentario = '';
  enviandoReporte = false;

  constructor(
    private alimentosService: AlimentosService,
    private ingredientesService: IngredientesService,
    private aiVision: AiVisionService,
    private ocrAsync: OcrAsyncService,
    private reportesService: ReportesService,
    private cdr: ChangeDetectorRef
  ) {}

  nombreIngrediente(ing: any): string {
    return typeof ing === 'string' ? ing : ing.nombre;
  }

  etiquetaMacro(key: string): string {
    return this.macrosReporte.find(m => m.key === key)?.label || key;
  }

  abrirModalReportar(): void {
    this.reportarCampos = [];
    this.reportarDetalleMacros = [];
    this.reportarDetalleIngredientes = [];
    this.reportarMarcaCorrecta = '';
    this.reportarComentario = '';
    this.mostrarModalReportar = true;
  }

  cerrarModalReportar(): void {
    this.mostrarModalReportar = false;
  }

  toggleCampoReporte(key: string): void {
    const idx = this.reportarCampos.indexOf(key);
    if (idx >= 0) this.reportarCampos.splice(idx, 1);
    else this.reportarCampos.push(key);
  }

  toggleDetalleMacro(key: string): void {
    const idx = this.reportarDetalleMacros.findIndex(m => m.campo === key);
    if (idx >= 0) this.reportarDetalleMacros.splice(idx, 1);
    else this.reportarDetalleMacros.push({ campo: key, valor: '' });
  }

  detalleMacroSeleccionado(key: string): boolean {
    return this.reportarDetalleMacros.some(m => m.campo === key);
  }

  toggleDetalleIngrediente(nombre: string): void {
    const idx = this.reportarDetalleIngredientes.findIndex(i => i.nombre === nombre);
    if (idx >= 0) this.reportarDetalleIngredientes.splice(idx, 1);
    else this.reportarDetalleIngredientes.push({ nombre, correccion: '' });
  }

  detalleIngredienteSeleccionado(nombre: string): boolean {
    return this.reportarDetalleIngredientes.some(i => i.nombre === nombre);
  }

  get reporteValido(): boolean {
    if (this.reportarCampos.length === 0) return false;
    if (this.reportarCampos.includes('macros') && this.reportarDetalleMacros.length === 0) return false;
    if (this.reportarCampos.includes('ingredientes') && this.reportarDetalleIngredientes.length === 0) return false;
    if (this.reportarCampos.includes('marca') && !this.reportarMarcaCorrecta.trim()) return false;
    if (this.reportarCampos.includes('otro') && !this.reportarComentario.trim()) return false;
    return true;
  }

  enviarReporte(): void {
    if (!this.detalle || !this.reporteValido || this.enviandoReporte) return;
    this.enviandoReporte = true;
    this.reportesService.crearReporte({
      alimentoId: this.detalle.id,
      campos: this.reportarCampos,
      comentario: this.reportarComentario.trim(),
      detalleMacros: this.reportarDetalleMacros,
      detalleIngredientes: this.reportarDetalleIngredientes,
      marcaCorrecta: this.reportarMarcaCorrecta.trim()
    }).subscribe({
        next: () => {
          this.enviandoReporte = false;
          this.mostrarModalReportar = false;
          this.mensaje.emit({ texto: 'Gracias, hemos recibido tu reporte', tipo: 'exito' });
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.enviandoReporte = false;
          this.mensaje.emit({ texto: err.error?.error || 'No se pudo enviar el reporte', tipo: 'error' });
          this.cdr.markForCheck();
        }
      });
  }

  ngOnChanges() {
    if (this.alimento) {
      this.detalle = { ...this.alimento };
      this.categoriaOriginal = this.detalle.categoria || '';
      this.pesoOriginal = this.detalle.peso_unidad || null;
      this.unidadOriginal = this.detalle.nombre_unidad || null;
      this.medidaOriginal = this.detalle.medida_unidad || 'g';
      this.enriquecerIngredientes();
    }
  }

  // ── Enriquecimiento de ingredientes desde el caché ──
  enriquecerIngredientes() {
    if (!this.detalle?.ingredientes || this.detalle.ingredientes.length === 0) return;

    this.detalle.ingredientes = this.detalle.ingredientes.map((ing: any) => {
      const nombre = typeof ing === 'string' ? ing : ing.nombre;
      if (typeof ing === 'object' && ing.es_aditivo !== undefined && ing.alergenos_categorias !== undefined) {
        return ing;
      }
      const enCache = this.ingredientesService.obtenerIngredientePorNombre(nombre);
      if (enCache) return enCache;
      return { nombre, es_aditivo: false, alergenos_categorias: [] };
    });
    this.cdr.detectChanges();
  }

  // ── Colores de ingredientes ──
  tieneAlergeniaIngrediente(ingrediente: any): boolean {
    if (!ingrediente || !ingrediente.alergenos_categorias || this.alergenosUsuario.length === 0) {
      return false;
    }
    return ingrediente.alergenos_categorias.some((a: string) => this.alergenosUsuario.includes(a));
  }

  esIngredienteNoDeseado(ingrediente: any): boolean {
    if (!ingrediente?.id || this.ingredientesNoDeseados.length === 0) return false;
    return this.ingredientesNoDeseados.includes(Number(ingrediente.id));
  }

  getColorIngrediente(ingrediente: any): string {
    if (!ingrediente) return '';
    if (this.tieneAlergeniaIngrediente(ingrediente)) return 'rojo';
    if (this.esIngredienteNoDeseado(ingrediente)) return 'marron';
    if (ingrediente.es_aditivo) return 'naranja';
    if (ingrediente.alergenos_categorias && ingrediente.alergenos_categorias.length > 0) return 'amarillo';
    return '';
  }

  mostrarAlergenosIngrediente(ing: any, event: any) {
    this.ingredienteMostrandoAlergenos = ing;
    if (typeof ing.alergenos_categorias === 'string') {
      try {
        this.ingredienteMostrandoAlergenos.alergenos_categorias = JSON.parse(ing.alergenos_categorias);
      } catch (e) {
        this.ingredienteMostrandoAlergenos.alergenos_categorias = [];
      }
    }
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    this.popoverStyle = {
      'bottom': (window.innerHeight - rect.top) + 'px',
      'right': (window.innerWidth - rect.right) + 'px'
    };
    this.mostrarAlergenosPopup = true;
  }

  cerrarAlergenosPopup() {
    this.mostrarAlergenosPopup = false;
    this.ingredienteMostrandoAlergenos = null;
  }

  // ── Cerrar / Guardar / Eliminar ──
  cerrar_() {
    // Autosave de cambios en categoría/peso/unidad (modo editable)
    if (!this.editable || !this.detalle) {
      this.cerrar.emit();
      return;
    }

    const categoriaChanged = this.detalle.categoria !== this.categoriaOriginal;
    const pesoChanged = this.detalle.peso_unidad !== this.pesoOriginal;
    const unidadChanged = this.detalle.nombre_unidad !== this.unidadOriginal;
    const medidaChanged = this.detalle.medida_unidad !== this.medidaOriginal;

    if (categoriaChanged || pesoChanged || unidadChanged || medidaChanged) {
      const formData = new FormData();
      if (categoriaChanged) formData.append('categoria', this.detalle.categoria);
      if (pesoChanged) formData.append('peso_unidad', this.detalle.peso_unidad || '');
      if (unidadChanged) formData.append('nombre_unidad', this.detalle.nombre_unidad || '');
      if (medidaChanged) formData.append('medida_unidad', this.detalle.medida_unidad || 'g');

      this.alimentosService.actualizarAlimento(this.detalle.id, formData).subscribe({
        next: () => this.guardado.emit(),
        error: () => this.cerrar.emit()
      });
    } else {
      this.cerrar.emit();
    }
  }

  guardarDetallesAlimento() {
    if (!this.detalle) return;
    this.cargandoDetalles = true;
    this.cdr.detectChanges();

    const formData = new FormData();
    formData.append('nombre', this.detalle.nombre || '');
    formData.append('marca', this.detalle.marca || '');
    formData.append('categoria', this.detalle.categoria || '');
    formData.append('peso_unidad', String(this.detalle.peso_unidad ?? ''));
    formData.append('nombre_unidad', this.detalle.nombre_unidad || '');
    formData.append('medida_unidad', this.detalle.medida_unidad || 'g');
    if (this.detalle.ingredientes) {
      formData.append('ingredientes', JSON.stringify(this.detalle.ingredientes));
    }

    this.alimentosService.actualizarAlimento(this.detalle.id, formData).subscribe({
      next: () => {
        this.cargandoDetalles = false;
        this.mensaje.emit({ texto: 'Alimento actualizado correctamente ✅', tipo: 'exito' });
        this.guardado.emit();
      },
      error: () => {
        this.cargandoDetalles = false;
        this.mensaje.emit({ texto: 'Error al guardar cambios', tipo: 'error' });
        this.cdr.detectChanges();
      }
    });
  }

  abrirConfirmacionEliminar() {
    this.mostrarModalConfirmacionEliminar = true;
    this.cdr.detectChanges();
  }

  cerrarConfirmacionEliminar() {
    this.mostrarModalConfirmacionEliminar = false;
    this.cdr.detectChanges();
  }

  confirmarEliminar() {
    if (!this.detalle) return;
    this.cargandoEliminar = true;
    this.alimentosService.eliminarAlimento(this.detalle.id).subscribe({
      next: () => {
        this.mensaje.emit({ texto: 'Alimento eliminado ✅', tipo: 'exito' });
        this.mostrarModalConfirmacionEliminar = false;
        this.cargandoEliminar = false;
        this.eliminado.emit();
      },
      error: () => {
        this.mensaje.emit({ texto: 'Error al eliminar', tipo: 'error' });
        this.cargandoEliminar = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── Macros visibles para lectura (no usado aquí pero útil si se requiere) ──
  getMacrosVisibles(a: any): { label: string; valor: number; unidad: string }[] {
    return [
      { key: 'calorias', label: 'Calorías', unidad: 'kcal' },
      { key: 'proteinas', label: 'Proteínas', unidad: 'g' },
      { key: 'hidratos_carbono', label: 'Carbohidratos', unidad: 'g' },
      { key: 'azucares', label: 'Azúcares', unidad: 'g' },
      { key: 'grasas', label: 'Grasas', unidad: 'g' },
      { key: 'grasas_saturadas', label: 'Grasas sat.', unidad: 'g' },
      { key: 'fibra', label: 'Fibra', unidad: 'g' },
      { key: 'sal', label: 'Sal', unidad: 'g' },
      { key: 'sodio', label: 'Sodio', unidad: 'mg' },
    ].filter(c => a[c.key] && a[c.key] > 0)
     .map(c => ({ label: c.label, valor: a[c.key], unidad: c.unidad }));
  }

  // ── Dropdowns ──
  toggleDropdownEdicion() { this.mostrarDropdownEdicion = !this.mostrarDropdownEdicion; }
  toggleDropdownMacros() { this.mostrarDropdownMacros = !this.mostrarDropdownMacros; }
  cerrarDropdowns() {
    this.mostrarDropdownEdicion = false;
    this.mostrarDropdownMacros = false;
  }

  // ── Editor de ingredientes ──
  abrirEditorIngredientes() {
    this.mostrarEditorIngredientes = true;
    this.nuevoIngrediente = '';
    this.todosLosIngredientes = new Set(
      this.ingredientesService.obtenerIngredientesCacheados().map(i => i.nombre)
    );
  }

  cerrarEditorIngredientes() {
    this.mostrarEditorIngredientes = false;
    this.nuevoIngrediente = '';
  }

  removerTildes(texto: string): string {
    return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  filtrarIngredientes() {
    const texto = this.nuevoIngrediente.trim();
    if (texto.length < 3) {
      this.ingredientesFiltrados = [];
      return;
    }
    const busqueda = this.removerTildes(texto).toLowerCase();
    const actuales = new Set(
      (this.detalle.ingredientes || []).map((ing: any) => (ing.nombre || ing).toLowerCase())
    );
    this.ingredientesFiltrados = Array.from(this.todosLosIngredientes)
      .filter((ing: string) => {
        if (actuales.has(ing.toLowerCase())) return false;
        return this.removerTildes(ing).toLowerCase().startsWith(busqueda);
      })
      .sort();
  }

  async seleccionarSugerencia(ingrediente: string) {
    this.nuevoIngrediente = ingrediente;
    this.ingredientesFiltrados = [];
    await this.agregarIngrediente();
  }

  async agregarIngrediente() {
    const nombreIngrediente = this.nuevoIngrediente.trim();
    if (!nombreIngrediente) return;
    this.cargandoIngrediente = true;

    try {
      if (!this.detalle.ingredientes) this.detalle.ingredientes = [];

      const yaExiste = this.detalle.ingredientes.some(
        (ing: any) => (ing.nombre || ing).toLowerCase() === nombreIngrediente.toLowerCase()
      );
      if (yaExiste) {
        this.nuevoIngrediente = '';
        this.cdr.detectChanges();
        return;
      }

      const nombreCapitalizado = nombreIngrediente.charAt(0).toUpperCase() + nombreIngrediente.slice(1);
      const respuesta = await this.alimentosService.crearIngrediente(nombreCapitalizado).toPromise();

      if (respuesta && (respuesta.id || respuesta.ingrediente)) {
        const ingrediente = respuesta.ingrediente || respuesta;
        this.detalle.ingredientes.push({
          id: ingrediente.id,
          nombre: ingrediente.nombre,
          verificado: ingrediente.verificado || false,
          alergenos_categorias: ingrediente.alergenos_categorias || [],
          es_aditivo: ingrediente.es_aditivo || false
        });
      }

      this.todosLosIngredientes.add(nombreIngrediente);
      this.nuevoIngrediente = '';
      this.ingredientesFiltrados = [];
      this.cdr.detectChanges();
    } catch (error: any) {
      // Si ya existe (409), obtenerlo desde el backend y agregarlo
      if (error.status === 409) {
        try {
          const ingrediente = await this.alimentosService.obtenerIngrediente(nombreIngrediente).toPromise();
          if (ingrediente) {
            const yaExiste = this.detalle.ingredientes.some((ing: any) => ing.id === ingrediente.id);
            if (!yaExiste) {
              this.detalle.ingredientes.push({
                id: ingrediente.id,
                nombre: ingrediente.nombre,
                verificado: ingrediente.verificado || false,
                alergenos_categorias: ingrediente.alergenos_categorias || [],
                es_aditivo: ingrediente.es_aditivo || false
              });
            }
            this.nuevoIngrediente = '';
            this.ingredientesFiltrados = [];
            this.cdr.detectChanges();
          }
        } catch {
          this.mensaje.emit({ texto: 'Error al agregar ingrediente', tipo: 'error' });
        }
      } else {
        this.mensaje.emit({ texto: 'No se pudo agregar ingrediente', tipo: 'error' });
      }
    } finally {
      this.cargandoIngrediente = false;
    }
  }

  eliminarIngrediente(index: number) {
    if (this.detalle.ingredientes) {
      this.detalle.ingredientes.splice(index, 1);
      this.cdr.detectChanges();
    }
  }

  // ── Editor de macros ──
  abrirEditorMacros() {
    this.mostrarEditorMacros = true;
    this.mostrarDropdownMacros = false;
    this.cdr.detectChanges();
  }

  cerrarEditorMacros() {
    this.mostrarEditorMacros = false;
    this.cdr.detectChanges();
  }

  guardarMacrosEditados() {
    if (!this.detalle) return;
    const campos = ['nombre', 'marca', 'calorias', 'proteinas', 'grasas', 'grasas_saturadas',
      'hidratos_carbono', 'azucares', 'fibra', 'sal', 'sodio', 'potasio', 'calcio', 'hierro', 'categoria'];
    const formData = new FormData();
    campos.forEach(k => formData.append(k, String(this.detalle[k] ?? '')));

    this.alimentosService.actualizarAlimento(this.detalle.id, formData).subscribe({
      next: () => {
        this.mensaje.emit({ texto: 'Macronutrientes actualizados ✅', tipo: 'exito' });
        this.mostrarEditorMacros = false;
        this.guardado.emit();
      },
      error: () => this.mensaje.emit({ texto: 'Error al actualizar macros', tipo: 'error' })
    });
  }

  // ── Re-escaneo de ingredientes/macros por foto ──
  abrirCamaraDesdeDetalles() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => this.capturarFotoIngredientesDesdeDetalles(e);
    input.click();
  }

  async capturarFotoIngredientesDesdeDetalles(event: any) {
    const files = event.target?.files;
    if (!files?.[0] || !this.detalle) return;
    this.ocrIngredientesEstado = 'analizando';

    try {
      const jobId = await this.ocrAsync.iniciarOcrIngredientes(files[0]);
      const ingredientes = await this.ocrAsync.esperarResultado(jobId, () => this.cdr.detectChanges());
      this.detalle.ingredientes = ingredientes;

      const formData = new FormData();
      formData.append('ingredientes', JSON.stringify(ingredientes));
      await this.alimentosService.actualizarAlimento(this.detalle.id, formData).toPromise();

      this.ocrIngredientesEstado = 'listo';
      this.enriquecerIngredientes();
      this.mensaje.emit({ texto: 'Ingredientes actualizados', tipo: 'exito' });
      setTimeout(() => { this.ocrIngredientesEstado = 'idle'; this.cdr.detectChanges(); }, 2000);
    } catch {
      this.ocrIngredientesEstado = 'error';
      this.mensaje.emit({ texto: 'Error al procesar ingredientes', tipo: 'error' });
    } finally {
      this.cdr.detectChanges();
    }
  }

  abrirCamaraMacrosDesdeDetalles() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => this.capturarFotoMacrosDesdeDetalles(e);
    input.click();
  }

  async capturarFotoMacrosDesdeDetalles(event: any) {
    const files = event.target?.files;
    if (!files?.[0] || !this.detalle) return;
    this.ocrMacrosEstado = 'analizando';

    try {
      const jobId = await this.ocrAsync.iniciarOcrMacros(files[0]);
      const macros: any = await this.ocrAsync.esperarResultado(jobId, () => this.cdr.detectChanges());
      Object.assign(this.detalle, macros);

      const formData = new FormData();
      Object.keys(macros).forEach(key => formData.append(key, String(macros[key] ?? '')));
      await this.alimentosService.actualizarAlimento(this.detalle.id, formData).toPromise();

      this.ocrMacrosEstado = 'listo';
      this.mensaje.emit({ texto: 'Macronutrientes actualizados', tipo: 'exito' });
      setTimeout(() => { this.ocrMacrosEstado = 'idle'; this.cdr.detectChanges(); }, 2000);
    } catch {
      this.ocrMacrosEstado = 'error';
      this.mensaje.emit({ texto: 'Error al procesar macros', tipo: 'error' });
    } finally {
      this.cdr.detectChanges();
    }
  }
}
