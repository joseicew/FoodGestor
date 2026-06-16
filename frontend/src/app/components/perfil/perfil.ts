import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { SessionService } from '../../services/session';
import { CalendarioService } from '../../services/calendario';
import { AutoSyncService } from '../../services/auto-sync';
import { AllergensService } from '../../services/allergens';

@Component({
  selector: 'app-perfil',
  imports: [CommonModule, FormsModule],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css',
})
export class Perfil implements OnInit {
  usuario: any = {};
  editando: boolean = false;
  cargando: boolean = false;
  mensaje: string = '';
  mensajeTipo: 'error' | 'exito' = 'error';

  // Datos en edición
  nombreCompleto: string = '';
  edad: number | null = null;
  sexo: string = 'M';
  altura: number | null = null;
  peso: number | null = null;
  nivel_actividad: string = 'moderado';
  objetivo: string = 'mantener';

  // Límites editables
  limites_calorias: number | null = null;
  limites_proteinas: number | null = null;
  limites_grasas: number | null = null;
  limites_carbohidratos: number | null = null;
  limites_azucares: number | null = null;

  // Alergias
  alergenos_disponibles: string[] = [];
  alergenos_seleccionados: string[] = [];

  // Valores calculados para mostrar en tiempo real
  tmb_calculada_temp: number | null = null;
  getd_mantenimiento_temp: number | null = null;  // GETD sin déficit
  tdee_calculada_temp: number | null = null;      // GETD con déficit/superávit

  // Totales diarios
  totalCalorias: number = 0;
  totalProteinas: number = 0;
  totalCarbohidratos: number = 0;
  totalGrasas: number = 0;
  totalAzucares: number = 0;

  constructor(
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private sessionService: SessionService,
    private calendarioService: CalendarioService,
    private autoSyncService: AutoSyncService,
    private allergensService: AllergensService
  ) {}

  ngOnInit(): void {
    // Verificar que tenemos token
    const token = this.authService.obtenerToken();
    console.log('🔍 [Perfil.ngOnInit] Token disponible:', !!token);
    console.log('🔍 [Perfil.ngOnInit] Autenticado:', this.authService.estaAutenticado());
    console.log('🔍 [Perfil.ngOnInit] localStorage keys:', Object.keys(localStorage));

    if (!this.authService.estaAutenticado()) {
      console.warn('⚠️ [Perfil.ngOnInit] No autenticado, redirigiendo a login');
      this.router.navigate(['/login']);
      return;
    }

    console.log('✓ [Perfil.ngOnInit] Autenticado, cargando perfil...');
    this.cargarAlergenos();
    this.cargarPerfil();
    this.cargarTotalesDelDia();

    // Iniciar verificación periódica de cambios
    this.autoSyncService.iniciarVerificacionPeriodica();
  }

  cargarAlergenos(): void {
    this.allergensService.obtenerAlergenos().subscribe({
      next: (alergenos: string[]) => {
        this.alergenos_disponibles = alergenos;
        console.log('Alergenos disponibles cargados:', alergenos);
      },
      error: (error: any) => {
        console.error('Error al cargar alergenos:', error);
      }
    });
  }

  cargarPerfil(): void {
    console.log('Intentando cargar perfil...');

    // Primero intentar cargar desde sesión
    const perfilEnSesion = this.sessionService.obtenerPerfil();
    if (perfilEnSesion) {
      console.log('✓ Perfil cargado desde sesión:', perfilEnSesion);
      this.usuario = Object.assign({}, perfilEnSesion);
      this.nombreCompleto = this.usuario.nombre_completo;
      this.peso = this.usuario.peso;
      this.altura = this.usuario.altura;
      this.alergenos_seleccionados = this.usuario.alergenos_seleccionados || [];
      this.cdr.markForCheck();
      return;
    }

    // Si no hay en sesión, hacer petición al servidor
    this.authService.obtenerPerfil().subscribe({
      next: (response) => {
        console.log('✓ Perfil cargado del servidor:', response);
        this.usuario = Object.assign({}, response);
        this.nombreCompleto = this.usuario.nombre_completo;
        this.peso = this.usuario.peso;
        this.altura = this.usuario.altura;
        this.alergenos_seleccionados = this.usuario.alergenos_seleccionados || [];
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('✗ Error al cargar perfil:', error);

        // Si es 401, redirigir a login (sesión expirada)
        if (error.status === 401) {
          console.warn('Token inválido, redirigiendo a login');
          this.authService.logout();
          this.router.navigate(['/login']);
          return;
        }

        const mensaje = error.error?.error || error.message || 'Error al cargar el perfil';
        this.mostrarMensaje(mensaje, 'error');
      }
    });
  }

  cargarTotalesDelDia(): void {
    // Obtener fecha actual en formato YYYY-MM-DD
    const hoy = new Date();
    const fechaStr = hoy.toISOString().split('T')[0];

    this.calendarioService.obtenerDia(fechaStr).subscribe({
      next: (response) => {
        console.log('Totales del día cargados:', response.totales_diarios);

        // Asignar los totales
        if (response.totales_diarios) {
          this.totalCalorias = Math.round(response.totales_diarios.calorias || 0);
          this.totalProteinas = Math.round(response.totales_diarios.proteinas * 10) / 10;
          this.totalCarbohidratos = Math.round(response.totales_diarios.carbohidratos * 10) / 10 || Math.round(response.totales_diarios.hidratos_carbono * 10) / 10 || 0;
          this.totalGrasas = Math.round(response.totales_diarios.grasas * 10) / 10;
          this.totalAzucares = Math.round(response.totales_diarios.azucares || 0);

          this.cdr.markForCheck();
        }
      },
      error: (error) => {
        console.log('No hay datos para el día actual (es normal si es la primera vez)');
        // Inicializar en 0 si no hay datos
        this.totalCalorias = 0;
        this.totalProteinas = 0;
        this.totalCarbohidratos = 0;
        this.totalGrasas = 0;
        this.totalAzucares = 0;
      }
    });
  }

  editarPerfil(): void {
    // Recargar perfil para asegurar datos actualizados
    this.authService.obtenerPerfil().subscribe({
      next: (perfilActualizado) => {
        console.log('Perfil recargado para edición:', perfilActualizado);
        this.usuario = Object.assign({}, perfilActualizado);

        // Cargar valores actuales para edición
        this.nombreCompleto = this.usuario.nombre_completo || '';
        this.edad = this.usuario.edad || 30;
        this.sexo = this.usuario.sexo || 'M';
        this.altura = this.usuario.altura || 170;
        this.peso = this.usuario.peso || 70;
        this.nivel_actividad = this.usuario.nivel_actividad || 'moderado';
        this.objetivo = this.usuario.objetivo || 'mantener';
        this.limites_calorias = this.usuario.limites_calorias || 2500;
        this.limites_proteinas = this.usuario.limites_proteinas || 100;
        this.limites_grasas = this.usuario.limites_grasas || 80;
        this.limites_carbohidratos = this.usuario.limites_carbohidratos || 250;
        this.limites_azucares = this.usuario.limites_azucares || 62;
        this.alergenos_seleccionados = [...(this.usuario.alergenos_seleccionados || [])];

        console.log('Alergenos cargados en edición:', this.alergenos_seleccionados);

        // Limpiar preview de calorías
        this.tmb_calculada_temp = 0;
        this.getd_mantenimiento_temp = 0;
        this.tdee_calculada_temp = 0;

        this.editando = true;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error al recargar perfil para edición:', error);
      }
    });
  }

  cancelarEdicion(): void {
    this.editando = false;
    // Restaurar valores originales
    this.nombreCompleto = this.usuario.nombre_completo || '';
    this.edad = this.usuario.edad || null;
    this.sexo = this.usuario.sexo || 'M';
    this.altura = this.usuario.altura || null;
    this.peso = this.usuario.peso || null;
    this.nivel_actividad = this.usuario.nivel_actividad || 'moderado';
    this.objetivo = this.usuario.objetivo || 'mantener';
    this.limites_calorias = this.usuario.limites_calorias || null;
    this.limites_proteinas = this.usuario.limites_proteinas || null;
    this.limites_grasas = this.usuario.limites_grasas || null;
    this.limites_carbohidratos = this.usuario.limites_carbohidratos || null;
    this.limites_azucares = this.usuario.limites_azucares || null;
    this.alergenos_seleccionados = [...(this.usuario.alergenos_seleccionados || [])];
  }

  recalcularBases(): void {
    /**
     * Recalcula los límites nutricionales usando la fórmula Mifflin-St Jeor
     * Basándose en peso, altura, sexo, edad, nivel_actividad y objetivo
     */
    if (!this.peso || !this.altura || !this.edad) {
      this.mostrarMensaje('Faltan datos: Peso, Altura y Edad son requeridos', 'error');
      return;
    }

    try {
      // PASO 1: Calcular TMB (Tasa Metabólica Basal)
      let tmb: number;
      if (this.sexo === 'M') {
        tmb = (10 * this.peso) + (6.25 * this.altura) - (5 * this.edad) + 5;
      } else {
        tmb = (10 * this.peso) + (6.25 * this.altura) - (5 * this.edad) - 161;
      }
      this.tmb_calculada_temp = Math.round(tmb * 10) / 10;

      // PASO 2: Ajustar por Nivel de Actividad (GETD)
      const factoresActividad: { [key: string]: number } = {
        'sedentario': 1.2,
        'ligero': 1.375,
        'moderado': 1.55,
        'activo': 1.725,
        'muy_activo': 1.9
      };
      const factorActividad = factoresActividad[this.nivel_actividad] || 1.55;
      const getd = tmb * factorActividad;
      this.getd_mantenimiento_temp = Math.round(getd * 10) / 10;

      // PASO 3: Aplicar Objetivo (déficit/superávit)
      let tdee: number;
      if (this.objetivo === 'perder_peso') {
        tdee = getd * 0.85; // -15% déficit
      } else if (this.objetivo === 'ganar_musculo') {
        tdee = getd * 1.1; // +10% superávit
      } else {
        tdee = getd; // Mantenimiento
      }
      this.tdee_calculada_temp = Math.round(tdee * 10) / 10;

      // PASO 4: Calcular Macronutrientes
      this.limites_calorias = Math.round(tdee);

      // Proteínas: 1.8-2.2g/kg según objetivo
      let proteinas_g: number;
      if (this.objetivo === 'ganar_musculo') {
        proteinas_g = this.peso * 2.2;
      } else if (this.objetivo === 'perder_peso') {
        proteinas_g = this.peso * 1.8;
      } else {
        proteinas_g = this.peso * 1.6;
      }
      this.limites_proteinas = Math.round(proteinas_g * 10) / 10;

      // Grasas: 25-30% de calorías
      const porcentajeGrasas = this.objetivo === 'perder_peso' ? 0.25 : 0.30;
      const grasas_kcal = this.limites_calorias * porcentajeGrasas;
      const grasas_g = grasas_kcal / 9;
      this.limites_grasas = Math.round(grasas_g * 10) / 10;

      // Carbohidratos: El resto de calorías
      const proteinas_kcal = this.limites_proteinas * 4;
      const carbohidratos_kcal = this.limites_calorias - proteinas_kcal - grasas_kcal;
      const carbohidratos_g = carbohidratos_kcal / 4;
      this.limites_carbohidratos = Math.round(carbohidratos_g * 10) / 10;

      // Azúcares: 25% de calorías máximo (OMS)
      const azucares_kcal = this.limites_calorias * 0.25;
      const azucares_g = azucares_kcal / 4;
      this.limites_azucares = Math.round(azucares_g * 10) / 10;

      this.mostrarMensaje('✓ Bases recalculadas correctamente', 'exito');
      this.cdr.markForCheck();
    } catch (error) {
      this.mostrarMensaje('Error al recalcular bases', 'error');
      console.error('Error en recalcularBases:', error);
    }
  }

  guardarCambios(): void {
    // Validaciones
    if (!this.nombreCompleto.trim()) {
      this.mostrarMensaje('El nombre completo es requerido', 'error');
      return;
    }

    if (!this.peso || this.peso < 25 || this.peso > 500) {
      this.mostrarMensaje('El peso debe estar entre 25 y 500 kg', 'error');
      return;
    }

    if (!this.altura || this.altura < 100 || this.altura > 300) {
      this.mostrarMensaje('La altura debe estar entre 100 y 300 cm', 'error');
      return;
    }

    if (!this.limites_calorias || this.limites_calorias < 500 || this.limites_calorias > 10000) {
      this.mostrarMensaje('Las calorías deben estar entre 500 y 10000', 'error');
      return;
    }

    this.cargando = true;

    const datosActualizados = {
      nombre_completo: this.nombreCompleto,
      peso: this.peso,
      altura: this.altura,
      nivel_actividad: this.nivel_actividad,
      objetivo: this.objetivo,
      limites_calorias: this.limites_calorias,
      limites_proteinas: this.limites_proteinas,
      limites_grasas: this.limites_grasas,
      limites_carbohidratos: this.limites_carbohidratos,
      limites_azucares: this.limites_azucares,
      alergenos_seleccionados: this.alergenos_seleccionados
    };

    this.authService.actualizarPerfil(datosActualizados).subscribe({
      next: (response) => {
        // Actualizar el objeto usuario con los datos nuevos
        this.usuario = Object.assign({}, {
          id: response.id,
          email: response.email || '',
          nombre_completo: response.nombre_completo || 'Usuario',
          edad: response.edad || 30,
          sexo: response.sexo || 'M',
          altura: response.altura || 170,
          peso: response.peso || 70,
          nivel_actividad: response.nivel_actividad || 'moderado',
          objetivo: response.objetivo || 'mantener',
          limites_calorias: response.limites_calorias || 2500,
          limites_proteinas: response.limites_proteinas || 100,
          limites_grasas: response.limites_grasas || 80,
          limites_carbohidratos: response.limites_carbohidratos || 250,
          limites_azucares: response.limites_azucares || 62,
          tmb_calculada: response.tmb_calculada || 0,
          tdee_calculada: response.tdee_calculada || 0,
          alergenos_seleccionados: response.alergenos_seleccionados || []
        });
        // Guardar en sesión para futuras cargas
        this.sessionService.guardarPerfil(this.usuario);
        this.editando = false;
        this.cargando = false;
        this.mostrarMensaje('✓ Perfil actualizado', 'exito');
        // Recargar totales si cambió algo relevante
        this.cargarTotalesDelDia();
        // Forzar detección de cambios
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.cargando = false;
        const mensaje = error.error?.error || 'Error al actualizar el perfil';
        this.mostrarMensaje(mensaje, 'error');
      }
    });
  }

  obtenerDiasSemana(nivel_actividad: string): string {
    const diasMap: { [key: string]: string } = {
      'sedentario': '0-1',
      'ligero': '1-3',
      'moderado': '3-4',
      'activo': '5-6',
      'muy_activo': '6-7'
    };
    return diasMap[nivel_actividad] || '3-4';
  }

  formatearObjetivo(objetivo: string): string {
    if (!objetivo) return '-';
    const objetivosMap: { [key: string]: string } = {
      'perder_peso': 'PERDER PESO',
      'ganar_musculo': 'GANAR MÚSCULO',
      'mantener': 'MANTENER'
    };
    return objetivosMap[objetivo] || objetivo.toUpperCase();
  }

  formatearActividad(nivel_actividad: string): string {
    if (!nivel_actividad) return '-';
    const actividadMap: { [key: string]: string } = {
      'sedentario': 'SEDENTARIO',
      'ligero': 'LIGERO',
      'moderado': 'MODERADO',
      'activo': 'ACTIVO',
      'muy_activo': 'MUY ACTIVO'
    };
    return actividadMap[nivel_actividad] || nivel_actividad.toUpperCase();
  }

  private mostrarMensaje(texto: string, tipo: 'error' | 'exito'): void {
    this.mensaje = texto;
    this.mensajeTipo = tipo;
    setTimeout(() => {
      this.mensaje = '';
    }, 4000);
  }
}
