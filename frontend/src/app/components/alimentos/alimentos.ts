import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AlimentosService } from '../../services/alimentos';
import { AiVisionService } from '../../services/ai-vision';
import { OcrAsyncService } from '../../services/ocr-async';
import { AuthService } from '../../services/auth';

type OcrEstado = 'idle' | 'preparando' | 'analizando' | 'listo' | 'error';

export const CATEGORIAS = [
  'Carnes y Aves',
  'Pescados y Mariscos',
  'Lácteos y Huevos',
  'Frutas',
  'Verduras y Hortalizas',
  'Cereales y Derivados',
  'Legumbres',
  'Grasas y Aceites',
  'Frutos Secos',
  'Bebidas',
  'Snacks y Aperitivos',
  'Dulces y Repostería',
  'Condimentos y Salsas',
  'Platos Preparados',
  'Suplementos',
  'Otros',
];

export const UNIDADES_COMUNES = [
  'Bolsa',
  'Pieza',
  'Rebanada',
  'Loncha',
  'Lata',
  'Bote',
  'Botella',
  'Barrita',
  'Galleta',
];

@Component({
  selector: 'app-alimentos',
  imports: [CommonModule, FormsModule],
  templateUrl: './alimentos.html',
  styleUrl: './alimentos.css',
})
export class Alimentos implements OnInit {
  activePanel: 'anadir' | 'buscar' | 'actualizar' | 'favoritos' = 'anadir';
  readonly categorias = CATEGORIAS;
  readonly unidadesComunes = UNIDADES_COMUNES;

  alimentos: any[] = [];
  alimentosFiltrados: any[] = [];
  alimentoSeleccionado: any = null;

  terminoBusqueda = '';
  categoriaFiltro = '';
  mensaje = '';
  mensajeTipo: 'exito' | 'error' = 'exito';
  cargando = false;
  intentoGuardar = false;

  mostrarModal = false;
  alimentoCreado: any = null;

  mostrarSimilarModal = false;
  alimentosSimilares: any[] = [];
  esperandoConfirmacionSimilar = false;

  mostrarModalDuplicado = false;
  alimentoDuplicado: any = null;
  puedeActualizarCodigo = false;
  codigoBarrasNuevo: string | null = null;
  esDuplicadoSoloEAN = false; // Si solo cambia el EAN y todo lo demás es igual

  mostrarModalActualizacion = false;
  alimentoActualizado: any = null;

  mostrarDetallesAlimento = false;
  alimentoSeleccionadoDetalle: any = null;
  mostrarBotonesEdicion = false;
  mostrarDropdownEdicion = false;
  mostrarDropdownMacros = false;
  fotoAAbrir: 'ingredientes' | 'macros' | null = null;
  mostrarEditorIngredientes = false;
  mostrarEditorMacros = false;
  nuevoIngrediente = '';
  ingredientesFiltrados: string[] = [];
  mostrarDetallesIngrediente = false;
  ingredienteSeleccionado: any = null;
  mostrarFormularioAlergenos = false;
  alimentoSeleccionadoAlergenos: any = null;
  alergenosAsignados: Map<number, number[]> = new Map();
  todosLosIngredientes: Set<string> = new Set();
  mostrarModalVerificarIngredientes = false;
  ingredienteActualVerificacion: any = null;
  ingredientesAVerificar: any[] = [];
  mostrarAlergenosPopup = false;
  ingredienteMostrandoAlergenos: any = null;
  popoverStyle: any = {};
  categoriasAlimentos: string[] = [
    'Cereales y derivados',
    'Legumbres',
    'Frutas',
    'Verduras',
    'Carnes',
    'Pescados y mariscos',
    'Lácteos',
    'Huevos',
    'Grasas y aceites',
    'Azúcares y dulces',
    'Bebidas',
    'Condimentos y especias',
    'Aditivos'
  ];

  // Estados paso a paso del OCR
  ocrIngredientesEstado: OcrEstado = 'idle';
  ocrMacrosEstado: OcrEstado = 'idle';
  ocrCodigoEstado: OcrEstado = 'idle';
  macrosRellenados = false;
  codigoRellenado = false;

  fotoIngredientesPreview: string | null = null;
  fotoMacrosPreview: string | null = null;
  fotoIngredientesFile: File | null = null;
  fotoMacrosFile: File | null = null;
  fotoCodigoFile: File | null = null;

  ingredientesExtraidos: string[] = [];
  codigoDuplicado: string | null = null;
  nombreDuplicado: string | null = null;
  marcaFaltante = false;

  secciones = { macros: true, minerales: false, clasificacion: true };

  // Configuración de OCR
  usarOcrAsincrono = true; // Cambiar a false para usar OCR síncrono

  // Confirmación para editar
  mostrarModalConfirmacionEdicion = false;
  alimentoEditandoConfirmacion: any = null;
  alimentoOriginalParaComparar: any = null;  // Guarda el estado original antes de editar
  diferenciasDetectadas: any[] = [];  // Lista de cambios detectados

  // Confirmación para eliminar
  mostrarModalConfirmacionEliminar = false;
  alimentoAEliminar: any = null;

  nuevoAlimento = this.alimentoVacio();

  constructor(
    private alimentosService: AlimentosService,
    private aiVision: AiVisionService,
    private ocrAsync: OcrAsyncService,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private router: Router,
    private http: HttpClient
  ) {}

  private getHeaders() {
    const token = this.authService.obtenerToken();
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return { headers };
  }

  ngOnInit() {
    // Cerrar dropdowns cuando se hace clic fuera
    document.addEventListener('click', (e: any) => {
      const target = e.target as HTMLElement;

      // Cerrar dropdown de ingredientes si se hace clic fuera
      if (!target.closest('.dropdown-edicion')) {
        this.mostrarDropdownEdicion = false;
      }

      // Cerrar dropdown de macros si se hace clic fuera
      if (!target.closest('.dropdown-macros')) {
        this.mostrarDropdownMacros = false;
      }

      this.cdr.markForCheck();
    });

    // Verificar autenticación
    console.log('🔍 [Alimentos.ngOnInit] Verificando autenticación...');
    if (!this.authService.estaAutenticado()) {
      console.warn('⚠️ [Alimentos.ngOnInit] No autenticado, redirigiendo a login');
      this.router.navigate(['/login']);
      return;
    }

    console.log('✓ [Alimentos.ngOnInit] Autenticado, cargando alimentos...');
    this.cargarAlimentos();
    // Recargar alimentos cada 5 segundos para sincronización en tiempo real
    setInterval(() => {
      if (this.activePanel === 'buscar' || this.activePanel === 'favoritos') {
        this.cargarAlimentos();
      }
    }, 5000);
  }

  cargarAlimentos() {
    this.alimentosService.obtenerAlimentos().subscribe({
      next: (data) => {
        console.log(`Cargados ${data.length} alimentos del servidor`);
        this.alimentos = data;
        this.alimentosFiltrados = data;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar alimentos:', err);
        this.mostrarMensaje('Error al conectar con el servidor', 'error');
      }
    });
  }

  cambiarPanel(panel: 'anadir' | 'buscar' | 'actualizar') {
    this.activePanel = panel;
    this.mensaje = '';
    this.alimentoSeleccionado = null;
    this.terminoBusqueda = '';
    this.nombreDuplicado = null;
    this.cargarAlimentos();
  }

  async onFotoIngredientes(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.[0]) return;

    this.fotoIngredientesFile = input.files[0];
    this.ingredientesExtraidos = [];
    this.ocrIngredientesEstado = 'idle'; // Resetear a idle primero
    this.cdr.detectChanges();
    await this.esperar(100); // Pequeño delay para que se actualice el UI
    this.ocrIngredientesEstado = 'preparando';

    // Preview local
    const reader = new FileReader();
    reader.onload = (e) => this.fotoIngredientesPreview = e.target?.result as string;
    reader.readAsDataURL(input.files[0]);

    // Pequeño delay para que se vea el paso "preparando"
    await this.esperar(300);
    this.ocrIngredientesEstado = 'analizando';

    try {
      if (this.usarOcrAsincrono) {
        // OCR asíncrono: inicia el job y espera con polling
        const jobId = await this.ocrAsync.iniciarOcrIngredientes(input.files[0]);
        const resultado = await this.ocrAsync.esperarResultado(jobId, (estado) => {
          // El estado va a ser "procesando" o "listo"
          if (estado === 'procesando') {
            this.ocrIngredientesEstado = 'analizando';
          }
          this.cdr.detectChanges();
        });
        this.ingredientesExtraidos = resultado;
      } else {
        // OCR síncrono (fallback)
        this.ingredientesExtraidos = await this.aiVision.procesarImagenIngredientes(input.files[0]);
      }
      this.ocrIngredientesEstado = 'listo';
    } catch (e: any) {
      this.ocrIngredientesEstado = 'error';
      this.mostrarMensaje('Error OCR ingredientes: ' + this.mensajeOcr(e), 'error');
    } finally {
      this.cdr.detectChanges();
    }
  }

  async onFotoCodigo(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.[0]) return;

    this.fotoCodigoFile = input.files[0];
    this.ocrCodigoEstado = 'preparando';
    this.codigoRellenado = false;

    await this.esperar(300);
    this.ocrCodigoEstado = 'analizando';

    try {
      let codigo;
      if (this.usarOcrAsincrono) {
        const jobId = await this.ocrAsync.iniciarOcrCodigoBarras(input.files[0]);
        codigo = await this.ocrAsync.esperarResultado(jobId, (estado) => {
          if (estado === 'procesando') {
            this.ocrCodigoEstado = 'analizando';
          }
          this.cdr.detectChanges();
        });
      } else {
        codigo = await this.aiVision.procesarImagenCodigoBarras(input.files[0]);
      }

      this.nuevoAlimento.codigo_barras = codigo;
      this.ocrCodigoEstado = 'listo';
      this.codigoRellenado = true;

      // onCodigoBlur se encargará de verificar si el código existe
      this.onCodigoBlur();
      setTimeout(() => { this.codigoRellenado = false; this.cdr.detectChanges(); }, 3000);
    } catch (e: any) {
      this.ocrCodigoEstado = 'error';
      this.mostrarMensaje('Error al leer el código: ' + this.mensajeOcr(e), 'error');
    } finally {
      this.cdr.detectChanges();
    }
  }

  async onFotoMacros(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.[0]) return;

    this.fotoMacrosFile = input.files[0];
    this.macrosRellenados = false;
    this.ocrMacrosEstado = 'idle'; // Resetear a idle primero
    this.cdr.detectChanges();
    await this.esperar(100); // Pequeño delay para que se actualice el UI
    this.ocrMacrosEstado = 'preparando';

    const reader = new FileReader();
    reader.onload = (e) => this.fotoMacrosPreview = e.target?.result as string;
    reader.readAsDataURL(input.files[0]);

    await this.esperar(300);
    this.ocrMacrosEstado = 'analizando';

    try {
      let macros;
      if (this.usarOcrAsincrono) {
        const jobId = await this.ocrAsync.iniciarOcrMacros(input.files[0]);
        macros = await this.ocrAsync.esperarResultado(jobId, (estado) => {
          if (estado === 'procesando') {
            this.ocrMacrosEstado = 'analizando';
          }
          this.cdr.detectChanges();
        });
      } else {
        macros = await this.aiVision.procesarImagenMacros(input.files[0]);
      }

      this.nuevoAlimento.calorias        = macros.calorias        ?? this.nuevoAlimento.calorias;
      this.nuevoAlimento.proteinas       = macros.proteinas       ?? this.nuevoAlimento.proteinas;
      this.nuevoAlimento.hidratos_carbono= macros.hidratos_carbono?? this.nuevoAlimento.hidratos_carbono;
      this.nuevoAlimento.azucares        = macros.azucares        ?? this.nuevoAlimento.azucares;
      this.nuevoAlimento.grasas          = macros.grasas          ?? this.nuevoAlimento.grasas;
      this.nuevoAlimento.grasas_saturadas= macros.grasas_saturadas?? this.nuevoAlimento.grasas_saturadas;
      this.nuevoAlimento.fibra           = macros.fibra           ?? this.nuevoAlimento.fibra;
      this.nuevoAlimento.sal             = macros.sal             ?? this.nuevoAlimento.sal;
      this.nuevoAlimento.sodio           = macros.sodio           ?? this.nuevoAlimento.sodio;
      if (this.nuevoAlimento.sodio > 0) this.secciones.minerales = true;
      this.ocrMacrosEstado = 'listo';
      this.macrosRellenados = true;
      setTimeout(() => { this.macrosRellenados = false; this.cdr.detectChanges(); }, 3000);
    } catch (e: any) {
      this.ocrMacrosEstado = 'error';
      this.mostrarMensaje('Error OCR macros: ' + this.mensajeOcr(e), 'error');
    } finally {
      this.cdr.detectChanges();
    }
  }

  get ocrEnProceso(): boolean {
    const activo = (e: OcrEstado) => e === 'preparando' || e === 'analizando';
    return activo(this.ocrIngredientesEstado) || activo(this.ocrMacrosEstado) || activo(this.ocrCodigoEstado);
  }

  get formularioValido(): boolean {
    return this.nuevoAlimento.nombre.trim() !== ''
      && this.nuevoAlimento.marca.trim() !== ''
      && this.nuevoAlimento.calorias > 0
      && !!this.nuevoAlimento.categoria
      && !this.codigoDuplicado
      && !this.nombreDuplicado;
  }

  toggleSeccion(sec: keyof typeof this.secciones) {
    this.secciones[sec] = !this.secciones[sec];
  }

  onNombreBlur() {
    const n = this.nuevoAlimento.nombre.trim();
    const m = this.nuevoAlimento.marca.trim();
    if (!n || !m) { this.nombreDuplicado = null; return; }

    // Solo verificar duplicado si es MISMO nombre Y MISMA marca
    const existe = this.alimentos.find(a =>
      a.nombre.toLowerCase() === n.toLowerCase() &&
      a.marca.toLowerCase() === m.toLowerCase()
    );

    if (existe) {
      this.nombreDuplicado = existe.nombre;
      // Mostrar el mismo popup que con código de barras
      this.mostrarProductoEncontradoPorCodigoBarras(existe);
    } else {
      this.nombreDuplicado = null;
    }

  }

  onCodigoBlur() {
    const cod = this.nuevoAlimento.codigo_barras?.trim();
    if (!cod) { this.codigoDuplicado = null; return; }
    const existe = this.alimentos.find(a => a.codigo_barras === cod);

    if (existe) {
      this.codigoDuplicado = existe.nombre;
      // Mostrar el popup del producto encontrado
      this.mostrarProductoEncontradoPorCodigoBarras(existe);
    } else {
      this.codigoDuplicado = null;
    }
  }

  mostrarProductoEncontradoPorCodigoBarras(producto: any) {
    this.alimentoDuplicado = producto;
    this.nombreDuplicado = null; // Limpiar aviso de nombre para que no aparezca en rojo
    this.codigoDuplicado = null; // Limpiar aviso de código también
    this.mostrarModalDuplicado = true;
    this.cdr.detectChanges();
  }

  crearAlimento() {
    this.intentoGuardar = true;
    this.marcaFaltante = false;

    if (!this.formularioValido) {
      const falta = [];
      if (!this.nuevoAlimento.nombre.trim()) falta.push('nombre');
      if (!this.nuevoAlimento.marca.trim()) {
        falta.push('marca');
        this.marcaFaltante = true;
      }
      if (this.nuevoAlimento.calorias <= 0) falta.push('calorías');
      if (!this.nuevoAlimento.categoria) falta.push('categoría');
      this.mostrarMensaje(`Completa los campos obligatorios: ${falta.join(', ')}`, 'error');
      this.cdr.detectChanges();

      // Scroll automático al primer campo en rojo
      setTimeout(() => {
        const primerCampoError = document.querySelector('.campo-error');
        if (primerCampoError) {
          primerCampoError.scrollIntoView({ behavior: 'smooth', block: 'center' });
          (primerCampoError as HTMLInputElement).focus();
        }
      }, 100);

      return;
    }

    // Primero verificar si existe un verdadero duplicado
    this.verificarDuplicado();
  }

  async verificarDuplicado() {
    this.cargando = true;
    try {
      const response = await fetch('http://192.168.1.17:5000/api/alimentos/duplicado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: this.nuevoAlimento.nombre,
          marca: this.nuevoAlimento.marca,
          calorias: this.nuevoAlimento.calorias,
          proteinas: this.nuevoAlimento.proteinas,
          grasas: this.nuevoAlimento.grasas,
          hidratos_carbono: this.nuevoAlimento.hidratos_carbono,
          codigo_barras: this.nuevoAlimento.codigo_barras?.trim() || null
        })
      });

      const data = await response.json();

      if (data.es_duplicado && data.duplicado) {
        // Es un verdadero duplicado - mostrar modal
        this.alimentoDuplicado = data.duplicado;
        this.puedeActualizarCodigo = data.puede_actualizar_codigo || false;
        this.codigoBarrasNuevo = data.codigo_barras_nuevo || null;

        // Verificar si es SOLO EAN (datos iguales, diferente código)
        // Solo comparar campos principales
        const datosSonIguales =
          this.nuevoAlimento.nombre.trim().toLowerCase() === data.duplicado.nombre.toLowerCase() &&
          this.nuevoAlimento.marca.trim().toLowerCase() === data.duplicado.marca.toLowerCase() &&
          this.nuevoAlimento.calorias === data.duplicado.calorias &&
          this.nuevoAlimento.proteinas === data.duplicado.proteinas &&
          this.nuevoAlimento.grasas === data.duplicado.grasas &&
          this.nuevoAlimento.hidratos_carbono === data.duplicado.hidratos_carbono;

        // Es solo EAN si: el producto anterior no tiene código, el nuevo sí, y los datos principales son iguales
        this.esDuplicadoSoloEAN = datosSonIguales && !!this.codigoBarrasNuevo && !data.duplicado.codigo_barras;

        // Si es SOLO EAN, actualizar automáticamente en BD
        if (this.esDuplicadoSoloEAN) {
          this.actualizarCodigoDelDuplicado();
          return;
        }

        this.mostrarModalDuplicado = true;
        this.cargando = false;
        this.cdr.detectChanges();
        return;
      }

      // No es duplicado, verificar similares
      this.verificarSimilares();
    } catch (e) {
      this.mostrarMensaje('Error al verificar duplicados', 'error');
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  cerrarModalDuplicado() {
    this.mostrarModalDuplicado = false;

    // Restaurar avisos de duplicado si el usuario no cambió los valores
    const nombreActual = this.nuevoAlimento.nombre.trim().toLowerCase();
    const nombreDuplicadoAnterior = this.alimentoDuplicado?.nombre.toLowerCase();

    if (nombreDuplicadoAnterior && nombreActual === nombreDuplicadoAnterior) {
      this.nombreDuplicado = this.alimentoDuplicado.nombre;
    }

    const codigoActual = this.nuevoAlimento.codigo_barras?.trim();
    const codigoDuplicadoAnterior = this.alimentoDuplicado?.codigo_barras;

    if (codigoDuplicadoAnterior && codigoActual === codigoDuplicadoAnterior) {
      this.codigoDuplicado = this.alimentoDuplicado.nombre;
    }

    this.alimentoDuplicado = null;
    this.puedeActualizarCodigo = false;
    this.codigoBarrasNuevo = null;
    this.esDuplicadoSoloEAN = false;
    this.cdr.detectChanges();
  }

  crearDuplicado() {
    this.cerrarModalDuplicado();
    this.guardarAlimento();
  }

  agregarAFavoritoDelDuplicado() {
    if (!this.alimentoDuplicado) return;

    // Si existe un nuevo EAN y el producto no lo tiene, actualizar primero
    if (this.codigoBarrasNuevo && !this.alimentoDuplicado.codigo_barras) {
      this.cargando = true;
      this.alimentosService.actualizarCodigoBarras(this.alimentoDuplicado.id, this.codigoBarrasNuevo).subscribe({
        next: () => {
          // Después actualizar, agregar a favoritos
          this.alimentosService.toggleFavorito(this.alimentoDuplicado.id).subscribe({
            next: (res) => {
              this.alimentoDuplicado.favorito = res.alimento.favorito;
              this.mostrarMensaje('✅ EAN actualizado y agregado a favoritos', 'exito');
              this.cerrarModalDuplicado();
              this.cargarAlimentos();
              this.cargando = false;
              this.cdr.detectChanges();
            },
            error: () => {
              this.mostrarMensaje('Error al actualizar favorito', 'error');
              this.cargando = false;
              this.cdr.detectChanges();
            }
          });
        },
        error: () => {
          this.mostrarMensaje('Error al actualizar EAN', 'error');
          this.cargando = false;
          this.cdr.detectChanges();
        }
      });
    } else {
      // Sin EAN nuevo, solo agregar a favoritos
      this.alimentosService.toggleFavorito(this.alimentoDuplicado.id).subscribe({
        next: (res) => {
          this.alimentoDuplicado.favorito = res.alimento.favorito;
          this.mostrarMensaje(
            this.alimentoDuplicado.favorito ? '⭐ Agregado a favoritos' : '☆ Removido de favoritos',
            'exito'
          );
          this.cerrarModalDuplicado();
          this.cargando = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.mostrarMensaje('Error al actualizar favorito', 'error');
          this.cargando = false;
          this.cdr.detectChanges();
        }
      });
    }
  }

  actualizarCodigoDelDuplicado() {
    if (!this.alimentoDuplicado) {
      this.mostrarMensaje('Error: Producto no encontrado', 'error');
      return;
    }

    if (!this.codigoBarrasNuevo) {
      this.mostrarMensaje('Error: No hay código de barras para actualizar', 'error');
      return;
    }

    this.cargando = true;
    this.alimentosService.actualizarCodigoBarras(this.alimentoDuplicado.id, this.codigoBarrasNuevo).subscribe({
      next: (res) => {
        this.mostrarMensaje('✅ Código de barras actualizado correctamente', 'exito');
        this.alimentoDuplicado = null;
        this.codigoBarrasNuevo = null;
        this.mostrarModalDuplicado = false;
        this.cargarAlimentos();
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        const errorMsg = err.error?.error || err.error?.mensaje || err.statusText || 'Error desconocido';
        this.mostrarMensaje('❌ Error al actualizar código: ' + errorMsg, 'error');
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  async verificarSimilares() {
    this.cargando = true;
    try {
      const response = await fetch('http://192.168.1.17:5000/api/alimentos/similar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: this.nuevoAlimento.nombre,
          marca: this.nuevoAlimento.marca
        })
      });

      const data = await response.json();
      this.alimentosSimilares = data.similares || [];

      if (this.alimentosSimilares.length > 0) {
        this.mostrarSimilarModal = true;
        this.esperandoConfirmacionSimilar = true;
      } else {
        // No hay similares, proceder a guardar
        this.guardarAlimento();
      }
    } catch (e) {
      this.mostrarMensaje('Error al verificar productos similares', 'error');
      this.guardarAlimento();
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }


  guardarAlimento() {
    this.cargando = true;
    const formData = this.toFormData(this.nuevoAlimento);
    if (this.fotoIngredientesFile) formData.append('foto_ingredientes', this.fotoIngredientesFile);
    if (this.fotoMacrosFile) formData.append('foto_macros', this.fotoMacrosFile);
    if (this.ingredientesExtraidos.length > 0) {
      formData.append('ingredientes', JSON.stringify(this.ingredientesExtraidos));
    }

    this.alimentosService.crearAlimento(formData).subscribe({
      next: (res) => {
        try {
          this.alimentoCreado = res.alimento;
          this.mostrarModal = true;
          this.mostrarSimilarModal = false;
          this.esperandoConfirmacionSimilar = false;
          this.codigoDuplicado = null;
          this.nombreDuplicado = null;
          this.marcaFaltante = false;
          this.nuevoAlimento = this.alimentoVacio();
          this.secciones = { macros: true, minerales: false, clasificacion: true };
          this.fotoIngredientesFile = null;
          this.fotoMacrosFile = null;
          this.fotoIngredientesPreview = null;
          this.fotoMacrosPreview = null;
          this.ingredientesExtraidos = [];
          this.ocrIngredientesEstado = 'idle';
          this.ocrMacrosEstado = 'idle';
          this.ocrCodigoEstado = 'idle';
          this.fotoCodigoFile = null;
          this.intentoGuardar = false;
          this.resetearInputsFichero();

          // Recargar alimentos para sincronizar
          setTimeout(() => this.cargarAlimentos(), 1000);
        } finally {
          this.cargando = false;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        if (err.status === 409) {
          const existente = err.error?.producto_existente ?? 'producto existente';
          if (err.error?.tipo_duplicado === 'nombre') {
            this.nombreDuplicado = existente;
            this.mostrarMensaje(`Ya existe un alimento con ese nombre: "${existente}"`, 'error');
          } else {
            this.codigoDuplicado = existente;
            this.mostrarMensaje(`Código duplicado — ya existe: "${existente}"`, 'error');
          }
        } else {
          this.mostrarMensaje('Error al crear el alimento', 'error');
        }
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  continuarConGuardado() {
    this.mostrarSimilarModal = false;
    this.esperandoConfirmacionSimilar = false;
    this.guardarAlimento();
  }

  cancelarGuardado() {
    this.mostrarSimilarModal = false;
    this.esperandoConfirmacionSimilar = false;
    this.cargando = false;
    this.cdr.detectChanges();
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.alimentoCreado = null;
  }

  cerrarModalActualizacion() {
    this.mostrarModalActualizacion = false;
    this.alimentoActualizado = null;
    this.alimentoSeleccionado = null;
  }

  getMacrosVisibles(a: any): { label: string; valor: number; unidad: string }[] {
    return [
      { key: 'calorias',        label: 'Calorías',       unidad: 'kcal' },
      { key: 'proteinas',       label: 'Proteínas',      unidad: 'g' },
      { key: 'hidratos_carbono',label: 'Carbohidratos',  unidad: 'g' },
      { key: 'azucares',        label: 'Azúcares',       unidad: 'g' },
      { key: 'grasas',          label: 'Grasas',         unidad: 'g' },
      { key: 'grasas_saturadas',label: 'Grasas sat.',    unidad: 'g' },
      { key: 'fibra',           label: 'Fibra',          unidad: 'g' },
      { key: 'sal',             label: 'Sal',            unidad: 'g' },
      { key: 'sodio',           label: 'Sodio',          unidad: 'mg' },
      { key: 'potasio',         label: 'Potasio',        unidad: 'mg' },
      { key: 'calcio',          label: 'Calcio',         unidad: 'mg' },
      { key: 'hierro',          label: 'Hierro',         unidad: 'mg' },
    ].filter(c => a[c.key] && a[c.key] > 0)
     .map(c => ({ label: c.label, valor: a[c.key], unidad: c.unidad }));
  }

  buscarAlimento() {
    let resultado = this.alimentos;

    // Filtrar por término de búsqueda
    if (this.terminoBusqueda.trim()) {
      const t = this.terminoBusqueda.toLowerCase();
      resultado = resultado.filter(a =>
        a.nombre.toLowerCase().includes(t) ||
        a.marca.toLowerCase().includes(t) ||
        (a.categoria && a.categoria.toLowerCase().includes(t))
      );
    }

    // Filtrar por categoría
    if (this.categoriaFiltro) {
      resultado = resultado.filter(a => a.categoria === this.categoriaFiltro);
    }

    this.alimentosFiltrados = resultado;
  }

  toggleFavorito(alimento: any, event?: Event) {
    if (event) {
      event.stopPropagation();
    }

    this.alimentosService.toggleFavorito(alimento.id).subscribe({
      next: (res) => {
        alimento.favorito = res.alimento.favorito;
        this.mostrarMensaje(
          alimento.favorito ? '⭐ Agregado a favoritos' : '☆ Removido de favoritos',
          'exito'
        );
        this.cdr.detectChanges();
      },
      error: () => this.mostrarMensaje('Error al actualizar favorito', 'error')
    });
  }

  irAFavoritos() {
    this.categoriaFiltro = '';
    this.terminoBusqueda = '';
    this.activePanel = 'favoritos';
    this.cargarAlimentos();
  }

  obtenerFavoritos() {
    return this.alimentos.filter(a => a.favorito);
  }

  seleccionarAlimento(alimento: any) {
    this.alimentoSeleccionado = { ...alimento };
    this.alimentoOriginalParaComparar = { ...alimento };  // Guardar estado original
    this.ocrIngredientesEstado = 'idle';
    this.ocrMacrosEstado = 'idle';
    this.ocrCodigoEstado = 'idle';

    // Abrir automáticamente el input de foto si fue especificado
    if (this.fotoAAbrir) {
      setTimeout(() => {
        if (this.fotoAAbrir === 'ingredientes') {
          (document.querySelector('input[id*="fotoIngredientes"]') as HTMLElement)?.click();
        } else if (this.fotoAAbrir === 'macros') {
          (document.querySelector('input[id*="fotoMacros"]') as HTMLElement)?.click();
        }
        this.fotoAAbrir = null;
      }, 100);
    }
  }

  abrirDetallesAlimento(alimento: any, desdeActualizar = false) {
    this.alimentoSeleccionadoDetalle = { ...alimento };
    this.mostrarDetallesAlimento = true;
    this.mostrarBotonesEdicion = desdeActualizar;
    this.cdr.markForCheck();
  }

  cerrarDetallesAlimento() {
    this.mostrarDetallesAlimento = false;
    this.alimentoSeleccionadoDetalle = null;
    this.mostrarBotonesEdicion = false;
    this.mostrarDropdownEdicion = false;
    this.mostrarDropdownMacros = false;
  }

  abrirDetallesIngrediente(ingrediente: any) {
    // Solo mostrar popup si tiene alergenos
    if (ingrediente.alergenos && ingrediente.alergenos.length > 0) {
      this.ingredienteSeleccionado = ingrediente;
      this.mostrarDetallesIngrediente = true;
      this.cdr.markForCheck();
    }
  }

  cerrarDetallesIngrediente() {
    this.mostrarDetallesIngrediente = false;
    this.ingredienteSeleccionado = null;
  }

  mostrarAlergenosIngrediente(ing: any, event: any) {
    this.ingredienteMostrandoAlergenos = ing;

    // Parsear alergenos_categorias si es string JSON
    if (typeof ing.alergenos_categorias === 'string') {
      try {
        this.ingredienteMostrandoAlergenos.alergenos_categorias = JSON.parse(ing.alergenos_categorias);
      } catch (e) {
        this.ingredienteMostrandoAlergenos.alergenos_categorias = [];
      }
    }

    // Calcular posición del popover basado en el click
    const button = event.target as HTMLElement;
    const rect = button.getBoundingClientRect();

    // Estimar ancho del popover (aproximadamente 150-200px)
    const popoverWidth = 160;

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

  tieneIngredientesSinVerificar(alimento: any): boolean {
    if (!alimento.ingredientes || alimento.ingredientes.length === 0) {
      return false;
    }

    // Retorna true si hay ingredientes sin verificar
    return alimento.ingredientes.some((ing: any) => !ing.verificado);
  }

  obtenerIngredientesSinVerificar(): any[] {
    // Obtener todos los ingredientes sin verificar de todos los alimentos
    const ingredientesSet = new Map<number, any>();

    for (const alimento of this.alimentos) {
      if (alimento.ingredientes) {
        for (const ing of alimento.ingredientes) {
          if (!ing.verificado && !ingredientesSet.has(ing.id)) {
            ingredientesSet.set(ing.id, {
              ...ing,
              alimentosRelacionados: [alimento.nombre]
            });
          } else if (!ing.verificado && ingredientesSet.has(ing.id)) {
            // Agregar alimento adicional si el ingrediente está en múltiples alimentos
            const stored = ingredientesSet.get(ing.id);
            if (stored && !stored.alimentosRelacionados.includes(alimento.nombre)) {
              stored.alimentosRelacionados.push(alimento.nombre);
            }
          }
        }
      }
    }

    return Array.from(ingredientesSet.values());
  }

  abrirFormularioAlergenos(alimento: any) {
    this.alimentoSeleccionadoAlergenos = { ...alimento };
    // Cargar lista de categorías de alergenos disponibles
    this.cargarCategoriasAlergenos();
    this.mostrarFormularioAlergenos = true;
    this.cdr.markForCheck();
  }

  cerrarFormularioAlergenos() {
    this.mostrarFormularioAlergenos = false;
    this.alimentoSeleccionadoAlergenos = null;
    this.alergenosAsignados.clear();
  }

  abrirModalVerificarIngredientes() {
    this.ingredientesAVerificar = this.obtenerIngredientesSinVerificar();

    if (this.ingredientesAVerificar.length > 0) {
      const ingrediente = { ...this.ingredientesAVerificar[0] };

      // Parsear alergenos_categorias si es un string JSON
      if (typeof ingrediente.alergenos_categorias === 'string') {
        try {
          ingrediente.alergenos_categorias = JSON.parse(ingrediente.alergenos_categorias);
        } catch (e) {
          ingrediente.alergenos_categorias = [];
        }
      }

      this.ingredienteActualVerificacion = ingrediente;
      this.cargarCategoriasAlimentos();
      this.mostrarModalVerificarIngredientes = true;
    } else {
      this.mostrarMensaje('No hay ingredientes para verificar', 'exito');
    }
  }

  cerrarModalVerificarIngredientes() {
    this.mostrarModalVerificarIngredientes = false;
    this.ingredienteActualVerificacion = null;
    this.ingredientesAVerificar = [];
  }

  cargarCategoriasAlimentos() {
    // Las categorías están definidas como constante en la clase
    // No necesitamos cargarlas del servidor ya que son datos estáticos
    this.cdr.markForCheck();
  }

  guardarIngredienteVerificado(ingrediente: any) {
    if (!ingrediente || !ingrediente.id) {
      this.mostrarMensaje('Error: Ingrediente inválido', 'error');
      return;
    }

    // Actualizar el ingrediente en el backend
    this.alimentosService.actualizarIngrediente(ingrediente.id, {
      nombre: ingrediente.nombre,
      categoria: ingrediente.categoria,
      es_aditivo: ingrediente.es_aditivo,
      notas: ingrediente.notas,
      verificado: true,
      alergenos_categorias: ingrediente.alergenos_categorias || []
    }).subscribe({
      next: (response: any) => {
        this.mostrarMensaje('✓ Ingrediente verificado correctamente', 'exito');

        // Actualizar el ingrediente en la lista local
        const indexEnAlimentos = this.ingredientesAVerificar.findIndex(ing => ing.id === ingrediente.id);
        if (indexEnAlimentos >= 0) {
          this.ingredientesAVerificar.splice(indexEnAlimentos, 1);
        }

        // Mostrar el siguiente ingrediente o cerrar
        if (this.ingredientesAVerificar.length > 0) {
          const siguienteIngrediente = { ...this.ingredientesAVerificar[0] };

          // Parsear alergenos_categorias si es un string JSON
          if (typeof siguienteIngrediente.alergenos_categorias === 'string') {
            try {
              siguienteIngrediente.alergenos_categorias = JSON.parse(siguienteIngrediente.alergenos_categorias);
            } catch (e) {
              siguienteIngrediente.alergenos_categorias = [];
            }
          }

          this.ingredienteActualVerificacion = siguienteIngrediente;
        } else {
          this.mostrarMensaje('¡Todos los ingredientes han sido verificados!', 'exito');
          this.cerrarModalVerificarIngredientes();
        }

        this.cdr.markForCheck();
      },
      error: (error: any) => {
        this.mostrarMensaje('Error al guardar el ingrediente', 'error');
        console.error('Error:', error);
      }
    });
  }

  cargarCategoriasAlergenos() {
    // Cargar categorías de alergenos disponibles desde el servicio
    this.alimentosService.obtenerCategoriasAlergenos().subscribe({
      next: (data: any) => {
        if (this.alimentoSeleccionadoAlergenos) {
          this.alimentoSeleccionadoAlergenos.categorias_alergenos = data.categorias || [];
        }
      },
      error: (error: any) => {
        console.error('Error cargando categorías de alergenos:', error);
      }
    });
  }

  estaSeleccionadoAlergeno(ingrediente: any, categoria: string): boolean {
    if (!ingrediente.alergenos_categorias) {
      return false;
    }
    return ingrediente.alergenos_categorias.includes(categoria);
  }

  toggleAlergeno(ingrediente: any, categoria: string) {
    if (!ingrediente.alergenos_categorias) {
      ingrediente.alergenos_categorias = [];
    }
    const index = ingrediente.alergenos_categorias.indexOf(categoria);
    if (index > -1) {
      ingrediente.alergenos_categorias.splice(index, 1);
    } else {
      ingrediente.alergenos_categorias.push(categoria);
    }
  }

  guardarAlergenos() {
    if (!this.alimentoSeleccionadoAlergenos) return;

    const ingredientesActualizados = this.alimentoSeleccionadoAlergenos.ingredientes.map((ing: any) => ({
      id: ing.id,
      nombre: ing.nombre,
      categoria: ing.categoria,
      alergenos_categorias: ing.alergenos_categorias || [],
      verificado: true  // Marcar como verificado al guardar
    }));

    this.alimentosService.actualizarAlergenos(this.alimentoSeleccionadoAlergenos.id, ingredientesActualizados).subscribe({
      next: () => {
        this.mostrarMensaje('✓ Ingredientes verificados correctamente', 'exito');
        this.cerrarFormularioAlergenos();
        // Actualizar los ingredientes en la vista actual
        if (this.alimentoSeleccionado) {
          this.alimentoSeleccionado.ingredientes = this.alimentoSeleccionadoAlergenos.ingredientes;
        }
      },
      error: (error: any) => {
        this.mostrarMensaje('Error al guardar cambios', 'error');
        console.error(error);
      }
    });
  }

  toggleDropdownEdicion() {
    this.mostrarDropdownEdicion = !this.mostrarDropdownEdicion;
  }

  toggleDropdownMacros() {
    this.mostrarDropdownMacros = !this.mostrarDropdownMacros;
    console.log('Dropdown macros toggled:', this.mostrarDropdownMacros);
  }

  cerrarDropdowns() {
    this.mostrarDropdownEdicion = false;
    this.mostrarDropdownMacros = false;
  }

  abrirEditorIngredientes() {
    this.mostrarEditorIngredientes = true;
    this.nuevoIngrediente = '';
    this.recolectarTodosLosIngredientes();
  }

  removerTildes(texto: string): string {
    return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  recolectarTodosLosIngredientes() {
    this.todosLosIngredientes = new Set();
    this.alimentos.forEach(alimento => {
      if (alimento.ingredientes && Array.isArray(alimento.ingredientes)) {
        alimento.ingredientes.forEach((ing: string) => {
          this.todosLosIngredientes.add(ing);
        });
      }
    });
  }

  cerrarEditorIngredientes() {
    this.mostrarEditorIngredientes = false;
    this.nuevoIngrediente = '';
  }

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
    if (!this.alimentoSeleccionadoDetalle) return;

    const campos = ['nombre','marca','calorias','proteinas','grasas','grasas_saturadas',
      'hidratos_carbono','azucares','fibra','sal','sodio','potasio','calcio','hierro','categoria'];
    const formData = new FormData();
    campos.forEach(k => formData.append(k, String(this.alimentoSeleccionadoDetalle[k] ?? '')));

    this.alimentosService.actualizarAlimento(this.alimentoSeleccionadoDetalle.id, formData).subscribe({
      next: (res) => {
        this.mostrarMensaje('Macronutrientes actualizados ✅', 'exito');
        this.mostrarEditorMacros = false;
        this.cargarAlimentos();
        this.cdr.detectChanges();
      },
      error: () => this.mostrarMensaje('Error al actualizar macros', 'error')
    });
  }

  async agregarIngrediente() {
    const ingrediente = this.nuevoIngrediente.trim();
    if (!ingrediente) return;

    if (!this.alimentoSeleccionadoDetalle.ingredientes) {
      this.alimentoSeleccionadoDetalle.ingredientes = [];
    }

    // Evitar duplicados
    if (this.alimentoSeleccionadoDetalle.ingredientes.includes(ingrediente)) {
      this.nuevoIngrediente = '';
      this.cdr.detectChanges();
      return;
    }

    // Verificar si es un ingrediente NUEVO (no existe en la base de datos)
    const esNuevo = !this.todosLosIngredientes.has(ingrediente);

    if (esNuevo) {
      // Crear el ingrediente manualmente
      try {
        await this.http.post<any>(
          'http://192.168.1.17:5000/api/ingredientes/',
          { nombre: ingrediente },
          this.getHeaders()
        ).toPromise();
        this.mostrarMensaje(`Ingrediente "${ingrediente}" creado. Asigna sus alérgenos desde la gestión de ingredientes.`, 'exito');
      } catch (error: any) {
        this.mostrarMensaje(`Error creando ingrediente: ${error.message}`, 'error');
        return;
      }
    }

    // Agregar el ingrediente
    this.alimentoSeleccionadoDetalle.ingredientes.push(ingrediente);
    this.todosLosIngredientes.add(ingrediente);

    this.nuevoIngrediente = '';
    this.ingredientesFiltrados = [];
    this.cdr.detectChanges();
  }

  eliminarIngrediente(index: number) {
    if (this.alimentoSeleccionadoDetalle.ingredientes) {
      this.alimentoSeleccionadoDetalle.ingredientes.splice(index, 1);
      this.cdr.detectChanges();
    }
  }

  filtrarIngredientes() {
    const texto = this.nuevoIngrediente.trim();

    // Requerir al menos 3 letras
    if (texto.length < 3) {
      this.ingredientesFiltrados = [];
      return;
    }

    const busquedaSinTildes = this.removerTildes(texto).toLowerCase();
    const ingredientesActuales = new Set(
      (this.alimentoSeleccionadoDetalle.ingredientes || []).map((ing: string) => ing.toLowerCase())
    );

    // Filtrar todos los ingredientes
    this.ingredientesFiltrados = Array.from(this.todosLosIngredientes)
      .filter((ing: string) => {
        // No mostrar ingredientes ya en el alimento actual
        if (ingredientesActuales.has(ing.toLowerCase())) {
          return false;
        }

        // Debe empezar por las mismas letras (sin tildes)
        const ingrenienteSinTildes = this.removerTildes(ing).toLowerCase();
        return ingrenienteSinTildes.startsWith(busquedaSinTildes);
      })
      .sort();
  }

  seleccionarSugerencia(ingrediente: string) {
    this.nuevoIngrediente = ingrediente;
    this.ingredientesFiltrados = [];
  }

  editarDesdeDetalles() {
    const alimento = this.alimentoSeleccionadoDetalle;
    this.cerrarDetallesAlimento();
    this.seleccionarAlimento(alimento);
  }

  abrirCamaraDesdeDetalles() {
    // Abrir file picker para ingredientes
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => this.capturarFotoIngredientesDesdeDetalles(e);
    input.click();
  }

  editarMacrosDesdeDetalles() {
    const alimento = this.alimentoSeleccionadoDetalle;
    this.cerrarDetallesAlimento();
    this.seleccionarAlimento(alimento);
  }

  abrirCamaraMacrosDesdeDetalles() {
    // Abrir file picker para macros
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => this.capturarFotoMacrosDesdeDetalles(e);
    input.click();
  }

  async capturarFotoIngredientesDesdeDetalles(event: any) {
    const files = event.target?.files;
    if (!files?.[0] || !this.alimentoSeleccionadoDetalle) return;

    this.ocrIngredientesEstado = 'analizando';

    try {
      let ingredientes;
      if (this.usarOcrAsincrono) {
        const jobId = await this.ocrAsync.iniciarOcrIngredientes(files[0]);
        ingredientes = await this.ocrAsync.esperarResultado(jobId, () => this.cdr.detectChanges());
      } else {
        ingredientes = await this.aiVision.procesarImagenIngredientes(files[0]);
      }

      // Actualizar el alimento en detalles
      this.alimentoSeleccionadoDetalle.ingredientes = ingredientes;

      // Guardar en la base de datos
      const formData = new FormData();
      formData.append('ingredientes', JSON.stringify(ingredientes));
      await this.alimentosService.actualizarAlimento(this.alimentoSeleccionadoDetalle.id, formData).toPromise();

      this.ocrIngredientesEstado = 'listo';
      this.mostrarMensaje('Ingredientes actualizados', 'exito');
      setTimeout(() => { this.ocrIngredientesEstado = 'idle'; this.cdr.detectChanges(); }, 2000);
    } catch (e: any) {
      this.ocrIngredientesEstado = 'error';
      this.mostrarMensaje('Error al procesar ingredientes', 'error');
    } finally {
      this.cdr.detectChanges();
    }
  }

  async capturarFotoMacrosDesdeDetalles(event: any) {
    const files = event.target?.files;
    if (!files?.[0] || !this.alimentoSeleccionadoDetalle) return;

    this.ocrMacrosEstado = 'analizando';

    try {
      let macros;
      if (this.usarOcrAsincrono) {
        const jobId = await this.ocrAsync.iniciarOcrMacros(files[0]);
        macros = await this.ocrAsync.esperarResultado(jobId, () => this.cdr.detectChanges());
      } else {
        macros = await this.aiVision.procesarImagenMacros(files[0]);
      }

      // Actualizar el alimento en detalles
      Object.assign(this.alimentoSeleccionadoDetalle, macros);

      // Guardar en la base de datos
      const formData = new FormData();
      Object.keys(macros).forEach(key => {
        formData.append(key, String(macros[key] ?? ''));
      });
      await this.alimentosService.actualizarAlimento(this.alimentoSeleccionadoDetalle.id, formData).toPromise();

      this.ocrMacrosEstado = 'listo';
      this.mostrarMensaje('Macronutrientes actualizados', 'exito');
      setTimeout(() => { this.ocrMacrosEstado = 'idle'; this.cdr.detectChanges(); }, 2000);
    } catch (e: any) {
      this.ocrMacrosEstado = 'error';
      this.mostrarMensaje('Error al procesar macros', 'error');
    } finally {
      this.cdr.detectChanges();
    }
  }

  async onFotoIngredientesEditar(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.[0] || !this.alimentoSeleccionado) return;

    this.ocrIngredientesEstado = 'analizando';

    try {
      let ingredientes;
      if (this.usarOcrAsincrono) {
        const jobId = await this.ocrAsync.iniciarOcrIngredientes(input.files[0]);
        ingredientes = await this.ocrAsync.esperarResultado(jobId, () => this.cdr.detectChanges());
      } else {
        ingredientes = await this.aiVision.procesarImagenIngredientes(input.files[0]);
      }

      this.ingredientesExtraidos = ingredientes;
      this.alimentoSeleccionado.ingredientes = ingredientes;
      this.ocrIngredientesEstado = 'listo';

      // Guardar automáticamente
      this.guardarAlimentoEdicion();
      setTimeout(() => { this.ocrIngredientesEstado = 'idle'; this.cdr.detectChanges(); }, 3000);
    } catch (e: any) {
      this.ocrIngredientesEstado = 'error';
      this.mostrarMensaje('Error al procesar ingredientes', 'error');
    } finally {
      this.cdr.detectChanges();
    }
  }

  async onFotoMacrosEditar(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.[0] || !this.alimentoSeleccionado) return;

    this.ocrMacrosEstado = 'analizando';

    try {
      let macros;
      if (this.usarOcrAsincrono) {
        const jobId = await this.ocrAsync.iniciarOcrMacros(input.files[0]);
        macros = await this.ocrAsync.esperarResultado(jobId, () => this.cdr.detectChanges());
      } else {
        macros = await this.aiVision.procesarImagenMacros(input.files[0]);
      }

      this.alimentoSeleccionado.calorias = macros.calorias ?? this.alimentoSeleccionado.calorias;
      this.alimentoSeleccionado.proteinas = macros.proteinas ?? this.alimentoSeleccionado.proteinas;
      this.alimentoSeleccionado.grasas = macros.grasas ?? this.alimentoSeleccionado.grasas;
      this.alimentoSeleccionado.hidratos_carbono = macros.hidratos_carbono ?? this.alimentoSeleccionado.hidratos_carbono;
      this.alimentoSeleccionado.grasas_saturadas = macros.grasas_saturadas ?? this.alimentoSeleccionado.grasas_saturadas;
      this.alimentoSeleccionado.azucares = macros.azucares ?? this.alimentoSeleccionado.azucares;
      this.alimentoSeleccionado.fibra = macros.fibra ?? this.alimentoSeleccionado.fibra;
      this.alimentoSeleccionado.sal = macros.sal ?? this.alimentoSeleccionado.sal;
      this.alimentoSeleccionado.sodio = macros.sodio ?? this.alimentoSeleccionado.sodio;

      this.ocrMacrosEstado = 'listo';

      // Guardar automáticamente
      this.guardarAlimentoEdicion();
      setTimeout(() => { this.ocrMacrosEstado = 'idle'; this.cdr.detectChanges(); }, 3000);
    } catch (e: any) {
      this.ocrMacrosEstado = 'error';
      this.mostrarMensaje('Error al procesar macros', 'error');
    } finally {
      this.cdr.detectChanges();
    }
  }

  async onFotoCodigoEditar(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.[0] || !this.alimentoSeleccionado) return;

    this.ocrCodigoEstado = 'analizando';

    try {
      let codigo;
      if (this.usarOcrAsincrono) {
        const jobId = await this.ocrAsync.iniciarOcrCodigoBarras(input.files[0]);
        codigo = await this.ocrAsync.esperarResultado(jobId, () => this.cdr.detectChanges());
      } else {
        codigo = await this.aiVision.procesarImagenCodigoBarras(input.files[0]);
      }

      this.alimentoSeleccionado.codigo_barras = codigo;
      this.ocrCodigoEstado = 'listo';

      // Guardar automáticamente
      this.guardarAlimentoEdicion();
      setTimeout(() => { this.ocrCodigoEstado = 'idle'; this.cdr.detectChanges(); }, 3000);
    } catch (e: any) {
      this.ocrCodigoEstado = 'error';
      this.mostrarMensaje('Error al procesar código de barras', 'error');
    } finally {
      this.cdr.detectChanges();
    }
  }

  guardarAlimentoEdicion() {
    if (!this.alimentoSeleccionado) return;

    const campos = ['nombre','marca','calorias','proteinas','grasas','grasas_saturadas',
      'hidratos_carbono','azucares','fibra','sal','sodio','potasio','calcio','hierro','categoria'];
    const formData = new FormData();
    campos.forEach(k => formData.append(k, String(this.alimentoSeleccionado[k] ?? '')));

    if (this.ingredientesExtraidos.length > 0) {
      formData.append('ingredientes', JSON.stringify(this.ingredientesExtraidos));
    }

    this.alimentosService.actualizarAlimento(this.alimentoSeleccionado.id, formData).subscribe({
      next: (res) => {
        this.alimentoActualizado = res.alimento || this.alimentoSeleccionado;
        this.mostrarModalActualizacion = true;
        this.cargarAlimentos();
        this.cdr.detectChanges();
      },
      error: () => this.mostrarMensaje('Error al actualizar', 'error')
    });
  }

  editarAlimento() {
    if (!this.alimentoSeleccionado || !this.alimentoOriginalParaComparar) return;

    // Detectar diferencias entre original y actual
    this.detectarDiferencias();

    if (this.diferenciasDetectadas.length === 0) {
      this.mostrarMensaje('No hay cambios para guardar', 'error');
      return;
    }

    // Mostrar modal de confirmación con diferencias
    this.alimentoEditandoConfirmacion = { ...this.alimentoSeleccionado };
    this.mostrarModalConfirmacionEdicion = true;
    this.cdr.detectChanges();
  }

  private detectarDiferencias() {
    this.diferenciasDetectadas = [];
    const campos = [
      { key: 'nombre', label: 'Nombre' },
      { key: 'marca', label: 'Marca' },
      { key: 'calorias', label: 'Calorías' },
      { key: 'proteinas', label: 'Proteínas' },
      { key: 'grasas', label: 'Grasas' },
      { key: 'grasas_saturadas', label: 'Grasas saturadas' },
      { key: 'hidratos_carbono', label: 'Carbohidratos' },
      { key: 'azucares', label: 'Azúcares' },
      { key: 'fibra', label: 'Fibra' },
      { key: 'sal', label: 'Sal' },
      { key: 'sodio', label: 'Sodio' },
      { key: 'potasio', label: 'Potasio' },
      { key: 'calcio', label: 'Calcio' },
      { key: 'hierro', label: 'Hierro' },
      { key: 'categoria', label: 'Categoría' }
    ];

    campos.forEach(campo => {
      const original = this.alimentoOriginalParaComparar[campo.key];
      const actual = this.alimentoSeleccionado[campo.key];

      if (original !== actual) {
        this.diferenciasDetectadas.push({
          label: campo.label,
          anterior: original,
          nuevo: actual
        });
      }
    });
  }

  confirmarActualizacion() {
    if (!this.alimentoSeleccionado) return;

    this.cargando = true;
    const campos = ['nombre','marca','calorias','proteinas','grasas','grasas_saturadas',
      'hidratos_carbono','azucares','fibra','sal','sodio','potasio','calcio','hierro','categoria'];
    const formData = new FormData();
    campos.forEach(k => formData.append(k, String(this.alimentoSeleccionado[k] ?? '')));

    this.alimentosService.actualizarAlimento(this.alimentoSeleccionado.id, formData).subscribe({
      next: () => {
        this.mostrarMensaje('Alimento actualizado ✅', 'exito');
        this.mostrarModalConfirmacionEdicion = false;
        this.alimentoEditandoConfirmacion = null;
        this.alimentoOriginalParaComparar = null;
        this.diferenciasDetectadas = [];
        this.cargarAlimentos();
        this.alimentoSeleccionado = null;
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.mostrarMensaje('Error al actualizar', 'error');
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  cancelarActualizacion() {
    this.mostrarModalConfirmacionEdicion = false;
    this.alimentoEditandoConfirmacion = null;
    this.diferenciasDetectadas = [];
    this.cdr.detectChanges();
  }

  abrirConfirmacionEliminar(alimento: any) {
    this.alimentoAEliminar = alimento;
    this.mostrarModalConfirmacionEliminar = true;
    this.cdr.detectChanges();
  }

  cerrarConfirmacionEliminar() {
    this.mostrarModalConfirmacionEliminar = false;
    this.alimentoAEliminar = null;
    this.cdr.detectChanges();
  }

  eliminarAlimento(alimento: any) {
    this.abrirConfirmacionEliminar(alimento);
  }

  confirmarEliminar() {
    if (!this.alimentoAEliminar) return;

    const id = this.alimentoAEliminar.id;
    this.alimentosService.eliminarAlimento(id).subscribe({
      next: () => {
        this.mostrarMensaje('Alimento eliminado ✅', 'exito');
        this.cerrarConfirmacionEliminar();
        this.cargarAlimentos();
        this.alimentoSeleccionado = null;
        this.cdr.detectChanges();
      },
      error: () => this.mostrarMensaje('Error al eliminar', 'error')
    });
  }

  private toFormData(obj: Record<string, any>): FormData {
    const fd = new FormData();
    Object.entries(obj).forEach(([k, v]) => fd.append(k, String(v ?? '')));
    return fd;
  }

  private alimentoVacio() {
    return { nombre: '', marca: '', codigo_barras: '', calorias: 0, proteinas: 0, grasas: 0,
      grasas_saturadas: 0, hidratos_carbono: 0, azucares: 0, fibra: 0,
      sal: 0, sodio: 0, potasio: 0, calcio: 0, hierro: 0, categoria: '',
      peso_unidad: null, nombre_unidad: '' };
  }

  private esperar(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }

  private resetearInputsFichero() {
    document.querySelectorAll<HTMLInputElement>('.panel input[type="file"]')
      .forEach(el => { el.value = ''; });
  }

  private mensajeOcr(e: any): string {
    if (e?.status === 0) return 'Servidor no disponible — ¿está arrancado el backend?';
    return e?.error?.error ?? e?.error?.message ?? e?.message ?? `Error ${e?.status ?? ''}`.trim();
  }

  mostrarMensaje(texto: string, tipo: 'exito' | 'error') {
    this.mensaje = texto;
    this.mensajeTipo = tipo;
    setTimeout(() => this.mensaje = '', 4000);
  }
}
