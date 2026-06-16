import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AlimentosService } from '../../../services/alimentos';
import { IngredientesService } from '../../../services/ingredientes';
import { AiVisionService } from '../../../services/ai-vision';
import { OcrAsyncService } from '../../../services/ocr-async';
import { CATEGORIAS, UNIDADES_COMUNES } from '../detalle/alimento-detalle';

type OcrEstado = 'idle' | 'preparando' | 'analizando' | 'listo' | 'error';

@Component({
  selector: 'app-alimento-anadir',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './alimento-anadir.html',
  styleUrl: './alimento-anadir.css',
})
export class AlimentoAnadir implements OnInit {
  readonly categorias = CATEGORIAS;
  readonly unidadesComunes = UNIDADES_COMUNES;

  alimentos: any[] = [];

  mensaje = '';
  mensajeTipo: 'exito' | 'error' = 'exito';
  cargando = false;
  intentoGuardar = false;

  nuevoAlimento = this.alimentoVacio();

  // OCR
  cargandoOCR = false;
  usarOcrAsincrono = true;
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

  // Modales
  mostrarModal = false;
  alimentoCreado: any = null;

  mostrarSimilarModal = false;
  alimentosSimilares: any[] = [];
  esperandoConfirmacionSimilar = false;

  mostrarModalDuplicado = false;
  alimentoDuplicado: any = null;
  puedeActualizarCodigo = false;
  codigoBarrasNuevo: string | null = null;
  esDuplicadoSoloEAN = false;

  constructor(
    private alimentosService: AlimentosService,
    private ingredientesService: IngredientesService,
    private aiVision: AiVisionService,
    private ocrAsync: OcrAsyncService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.alimentosService.obtenerAlimentos().subscribe({
      next: (data) => { this.alimentos = data; },
      error: () => {}
    });
  }

  volver() {
    this.router.navigate(['/alimentos']);
  }

  // ── Getters ──
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

  // ── OCR foto completa ──
  async procesarImagenOCR(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;

    this.cargandoOCR = true;
    this.cdr.detectChanges();

    try {
      const datos = await this.aiVision.procesarImagenCompleta(file);

      const tieneNombre = datos.nombre && datos.nombre.trim();
      const tieneMarca = datos.marca && datos.marca.trim();
      const tieneCategoria = datos.categoria && datos.categoria.trim();
      const tieneIngredientes = datos.ingredientes && Array.isArray(datos.ingredientes) && datos.ingredientes.length > 0;
      const tieneMacros = datos.macros && (datos.macros.calorias || datos.macros.proteinas || datos.macros.hidratos_carbono || datos.macros.grasas);
      const tieneCodigoBarras = datos.codigo_barras;

      if (!tieneNombre && !tieneMarca && !tieneCategoria && !tieneIngredientes && !tieneMacros && !tieneCodigoBarras) {
        this.mostrarMensaje('Error: No se detectó información del producto', 'error');
        return;
      }

      if (tieneNombre) this.nuevoAlimento.nombre = datos.nombre!;
      if (tieneMarca) this.nuevoAlimento.marca = datos.marca!;
      if (tieneCategoria) this.nuevoAlimento.categoria = datos.categoria!;
      if (datos.codigo_barras) this.nuevoAlimento.codigo_barras = datos.codigo_barras;
      if (tieneIngredientes) this.ingredientesExtraidos = datos.ingredientes!;

      if (datos.macros) {
        if (datos.macros.calorias) this.nuevoAlimento.calorias = datos.macros.calorias;
        if (datos.macros.proteinas) this.nuevoAlimento.proteinas = datos.macros.proteinas;
        if (datos.macros.hidratos_carbono) this.nuevoAlimento.hidratos_carbono = datos.macros.hidratos_carbono;
        if (datos.macros.azucares) this.nuevoAlimento.azucares = datos.macros.azucares;
        if (datos.macros.grasas) this.nuevoAlimento.grasas = datos.macros.grasas;
        if (datos.macros.grasas_saturadas) this.nuevoAlimento.grasas_saturadas = datos.macros.grasas_saturadas;
        if (datos.macros.fibra) this.nuevoAlimento.fibra = datos.macros.fibra;
        if (datos.macros.sal) this.nuevoAlimento.sal = datos.macros.sal;
        if (this.nuevoAlimento.calorias > 0 || this.nuevoAlimento.proteinas > 0) {
          this.secciones.macros = true;
        }
      }
      if (datos.minerales) {
        if (datos.minerales.sodio) this.nuevoAlimento.sodio = datos.minerales.sodio;
        if (datos.minerales.potasio) this.nuevoAlimento.potasio = datos.minerales.potasio;
        if (datos.minerales.calcio) this.nuevoAlimento.calcio = datos.minerales.calcio;
        if (datos.minerales.hierro) this.nuevoAlimento.hierro = datos.minerales.hierro;
      }
      if (datos.peso_unidad) this.nuevoAlimento.peso_unidad = datos.peso_unidad;
      if (datos.nombre_unidad) this.nuevoAlimento.nombre_unidad = datos.nombre_unidad;
      this.cdr.detectChanges();
    } catch (error) {
      this.mostrarMensaje('Error al procesar imagen: ' + this.mensajeOcr(error), 'error');
    } finally {
      this.cargandoOCR = false;
      this.cdr.detectChanges();
      this.resetearInputsFichero();
    }
  }

  async onFotoIngredientes(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.[0]) return;

    this.fotoIngredientesFile = input.files[0];
    this.ingredientesExtraidos = [];
    this.ocrIngredientesEstado = 'idle';
    this.cdr.detectChanges();
    await this.esperar(100);
    this.ocrIngredientesEstado = 'preparando';

    const reader = new FileReader();
    reader.onload = (e) => this.fotoIngredientesPreview = e.target?.result as string;
    reader.readAsDataURL(input.files[0]);

    await this.esperar(300);
    this.ocrIngredientesEstado = 'analizando';

    try {
      if (this.usarOcrAsincrono) {
        const jobId = await this.ocrAsync.iniciarOcrIngredientes(input.files[0]);
        this.ingredientesExtraidos = await this.ocrAsync.esperarResultado(jobId, () => this.cdr.detectChanges());
      } else {
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
        codigo = await this.ocrAsync.esperarResultado(jobId, () => this.cdr.detectChanges());
      } else {
        codigo = await this.aiVision.procesarImagenCodigoBarras(input.files[0]);
      }

      this.nuevoAlimento.codigo_barras = codigo;
      this.ocrCodigoEstado = 'listo';
      this.codigoRellenado = true;
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
    this.ocrMacrosEstado = 'idle';
    this.cdr.detectChanges();
    await this.esperar(100);
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
        macros = await this.ocrAsync.esperarResultado(jobId, () => this.cdr.detectChanges());
      } else {
        macros = await this.aiVision.procesarImagenMacros(input.files[0]);
      }

      this.nuevoAlimento.calorias = macros.calorias ?? this.nuevoAlimento.calorias;
      this.nuevoAlimento.proteinas = macros.proteinas ?? this.nuevoAlimento.proteinas;
      this.nuevoAlimento.hidratos_carbono = macros.hidratos_carbono ?? this.nuevoAlimento.hidratos_carbono;
      this.nuevoAlimento.azucares = macros.azucares ?? this.nuevoAlimento.azucares;
      this.nuevoAlimento.grasas = macros.grasas ?? this.nuevoAlimento.grasas;
      this.nuevoAlimento.grasas_saturadas = macros.grasas_saturadas ?? this.nuevoAlimento.grasas_saturadas;
      this.nuevoAlimento.fibra = macros.fibra ?? this.nuevoAlimento.fibra;
      this.nuevoAlimento.sal = macros.sal ?? this.nuevoAlimento.sal;
      this.nuevoAlimento.sodio = macros.sodio ?? this.nuevoAlimento.sodio;

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

  // ── Validación de duplicados ──
  onNombreBlur() {
    const n = this.nuevoAlimento.nombre.trim();
    const m = this.nuevoAlimento.marca.trim();
    if (!n || !m) { this.nombreDuplicado = null; return; }

    const existe = this.alimentos.find(a =>
      a.nombre.toLowerCase() === n.toLowerCase() && a.marca.toLowerCase() === m.toLowerCase()
    );

    if (existe) {
      this.nombreDuplicado = existe.nombre;
      this.mostrarProductoEncontrado(existe);
    } else {
      this.nombreDuplicado = null;
    }
  }

  onCodigoBlur() {
    const cod = this.nuevoAlimento.codigo_barras?.trim();
    if (!cod) { this.codigoDuplicado = null; return; }

    this.alimentosService.buscarPorCodigoBarras(cod).subscribe({
      next: (alimentos) => {
        const existe = alimentos.find((a: any) => a.codigo_barras === cod);
        if (existe) {
          this.codigoDuplicado = existe.nombre;
          this.mostrarProductoEncontrado(existe);
        } else {
          this.codigoDuplicado = null;
        }
      },
      error: () => { this.codigoDuplicado = null; }
    });
  }

  mostrarProductoEncontrado(producto: any) {
    this.alimentoDuplicado = producto;
    this.nombreDuplicado = null;
    this.codigoDuplicado = null;
    this.mostrarModalDuplicado = true;
    this.cdr.detectChanges();
  }

  // ── Crear ──
  crearAlimento() {
    this.intentoGuardar = true;
    this.marcaFaltante = false;

    if (!this.formularioValido) {
      const falta = [];
      if (!this.nuevoAlimento.nombre.trim()) falta.push('nombre');
      if (!this.nuevoAlimento.marca.trim()) { falta.push('marca'); this.marcaFaltante = true; }
      if (this.nuevoAlimento.calorias <= 0) falta.push('calorías');
      if (!this.nuevoAlimento.categoria) falta.push('categoría');
      this.mostrarMensaje(`Completa los campos obligatorios: ${falta.join(', ')}`, 'error');
      this.cdr.detectChanges();
      setTimeout(() => {
        const primerCampoError = document.querySelector('.campo-error');
        if (primerCampoError) {
          primerCampoError.scrollIntoView({ behavior: 'smooth', block: 'center' });
          (primerCampoError as HTMLInputElement).focus();
        }
      }, 100);
      return;
    }

    this.verificarDuplicado();
  }

  verificarDuplicado() {
    this.cargando = true;
    this.alimentosService.verificarDuplicado({
      nombre: this.nuevoAlimento.nombre,
      marca: this.nuevoAlimento.marca,
      calorias: this.nuevoAlimento.calorias,
      proteinas: this.nuevoAlimento.proteinas,
      grasas: this.nuevoAlimento.grasas,
      hidratos_carbono: this.nuevoAlimento.hidratos_carbono,
      codigo_barras: this.nuevoAlimento.codigo_barras?.trim() || null
    }).subscribe({
      next: (data) => {
        if (data.es_duplicado && data.duplicado) {
          this.alimentoDuplicado = data.duplicado;
          this.puedeActualizarCodigo = data.puede_actualizar_codigo || false;
          this.codigoBarrasNuevo = data.codigo_barras_nuevo || null;

          const datosSonIguales =
            this.nuevoAlimento.nombre.trim().toLowerCase() === data.duplicado.nombre.toLowerCase() &&
            this.nuevoAlimento.marca.trim().toLowerCase() === data.duplicado.marca.toLowerCase() &&
            this.nuevoAlimento.calorias === data.duplicado.calorias &&
            this.nuevoAlimento.proteinas === data.duplicado.proteinas &&
            this.nuevoAlimento.grasas === data.duplicado.grasas &&
            this.nuevoAlimento.hidratos_carbono === data.duplicado.hidratos_carbono;

          this.esDuplicadoSoloEAN = datosSonIguales && !!this.codigoBarrasNuevo && !data.duplicado.codigo_barras;

          if (this.esDuplicadoSoloEAN) {
            this.actualizarCodigoDelDuplicado();
            return;
          }

          this.mostrarModalDuplicado = true;
          this.cargando = false;
          this.cdr.detectChanges();
          return;
        }
        this.verificarSimilares();
      },
      error: () => {
        this.mostrarMensaje('Error al verificar duplicados', 'error');
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  verificarSimilares() {
    this.cargando = true;
    this.alimentosService.verificarSimilares({
      nombre: this.nuevoAlimento.nombre,
      marca: this.nuevoAlimento.marca
    }).subscribe({
      next: (data) => {
        this.alimentosSimilares = data.similares || [];
        if (this.alimentosSimilares.length > 0) {
          this.mostrarSimilarModal = true;
          this.esperandoConfirmacionSimilar = true;
        } else {
          this.guardarAlimento();
        }
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.guardarAlimento();
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  cerrarModalDuplicado() {
    this.mostrarModalDuplicado = false;
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

    if (this.codigoBarrasNuevo && !this.alimentoDuplicado.codigo_barras) {
      this.cargando = true;
      this.alimentosService.actualizarCodigoBarras(this.alimentoDuplicado.id, this.codigoBarrasNuevo).subscribe({
        next: () => {
          this.alimentosService.toggleFavorito(this.alimentoDuplicado.id).subscribe({
            next: (res) => {
              this.alimentoDuplicado.favorito = res.alimento.favorito;
              this.mostrarMensaje('✅ EAN actualizado y agregado a favoritos', 'exito');
              this.cerrarModalDuplicado();
              this.cargando = false;
              this.cdr.detectChanges();
            },
            error: () => { this.mostrarMensaje('Error al actualizar favorito', 'error'); this.cargando = false; this.cdr.detectChanges(); }
          });
        },
        error: () => { this.mostrarMensaje('Error al actualizar EAN', 'error'); this.cargando = false; this.cdr.detectChanges(); }
      });
    } else {
      this.alimentosService.toggleFavorito(this.alimentoDuplicado.id).subscribe({
        next: (res) => {
          this.alimentoDuplicado.favorito = res.alimento.favorito;
          this.mostrarMensaje(this.alimentoDuplicado.favorito ? '⭐ Agregado a favoritos' : '☆ Removido de favoritos', 'exito');
          this.cerrarModalDuplicado();
          this.cargando = false;
          this.cdr.detectChanges();
        },
        error: () => { this.mostrarMensaje('Error al actualizar favorito', 'error'); this.cargando = false; this.cdr.detectChanges(); }
      });
    }
  }

  actualizarCodigoDelDuplicado() {
    if (!this.alimentoDuplicado || !this.codigoBarrasNuevo) {
      this.mostrarMensaje('Error: faltan datos para actualizar', 'error');
      return;
    }
    this.cargando = true;
    this.alimentosService.actualizarCodigoBarras(this.alimentoDuplicado.id, this.codigoBarrasNuevo).subscribe({
      next: () => {
        this.mostrarMensaje('✅ Código de barras actualizado correctamente', 'exito');
        this.alimentoDuplicado = null;
        this.codigoBarrasNuevo = null;
        this.mostrarModalDuplicado = false;
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
        this.alimentoCreado = res.alimento;
        this.mostrarModal = true;
        this.mostrarSimilarModal = false;
        this.esperandoConfirmacionSimilar = false;
        this.cargando = false;
        // Refrescar el caché de ingredientes (puede haber nuevos)
        this.ingredientesService.cargarTodosLosIngredientes().subscribe();
        this.cdr.detectChanges();
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
    // Volver a la lista de alimentos
    this.router.navigate(['/alimentos']);
  }

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
      { key: 'potasio', label: 'Potasio', unidad: 'mg' },
      { key: 'calcio', label: 'Calcio', unidad: 'mg' },
      { key: 'hierro', label: 'Hierro', unidad: 'mg' },
    ].filter(c => a[c.key] && a[c.key] > 0)
     .map(c => ({ label: c.label, valor: a[c.key], unidad: c.unidad }));
  }

  // ── Helpers ──
  private toFormData(obj: Record<string, any>): FormData {
    const fd = new FormData();
    Object.entries(obj).forEach(([k, v]) => fd.append(k, String(v ?? '')));
    return fd;
  }

  private alimentoVacio() {
    return { nombre: '', marca: '', codigo_barras: '', calorias: 0, proteinas: 0, grasas: 0,
      grasas_saturadas: 0, hidratos_carbono: 0, azucares: 0, fibra: 0,
      sal: 0, sodio: 0, potasio: 0, calcio: 0, hierro: 0, categoria: '',
      peso_unidad: 0, nombre_unidad: '' };
  }

  private esperar(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }

  private resetearInputsFichero() {
    document.querySelectorAll<HTMLInputElement>('.panel input[type="file"]').forEach(el => { el.value = ''; });
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
