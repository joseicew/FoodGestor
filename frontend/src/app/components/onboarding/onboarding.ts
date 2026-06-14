import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { AllergensService } from '../../services/allergens';

interface LimitesCalculados {
  calorias: number;
  proteinas: number;
  grasas: number;
  azucares: number;
}

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './onboarding.html',
  styleUrl: './onboarding.css'
})
export class OnboardingComponent implements OnInit {
  // Datos del formulario
  nombreCompleto: string = '';
  edad: number | null = null;
  sexo: string = 'M';
  altura: number | null = null; // en cm
  peso: number | null = null; // en kg
  nivelActividad: string = 'moderado';
  objetivo: string = 'mantener';
  intolerancias: string[] = []; // Alergias/intolerancias del usuario

  // Estado
  cargando: boolean = false;
  mensaje: string = '';
  mensajeTipo: 'error' | 'exito' = 'error';
  cargandoAlergenos: boolean = true;

  // Límites calculados
  limitesCalculados: LimitesCalculados | null = null;

  // Opciones
  opcionesAlergenos: string[] = [];

  opcicionesSexo = [
    { value: 'M', label: 'Hombre' },
    { value: 'F', label: 'Mujer' },
    { value: 'O', label: 'Otro' }
  ];

  opcionesActividad = [
    { value: 'sedentario', label: 'Sedentario (poco ejercicio)' },
    { value: 'ligero', label: 'Ligero (1-3 días/semana)' },
    { value: 'moderado', label: 'Moderado (3-5 días/semana)' },
    { value: 'activo', label: 'Activo (6-7 días/semana)' },
    { value: 'muy_activo', label: 'Muy activo (ejercicio intenso)' }
  ];

  opcionesObjetivo = [
    { value: 'perder_peso', label: 'Perder peso' },
    { value: 'mantener', label: 'Mantener peso' },
    { value: 'ganar_musculo', label: 'Ganar músculo' }
  ];

  constructor(
    private authService: AuthService,
    private allergensService: AllergensService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Si no está autenticado, redirigir a registro
    if (!this.authService.estaAutenticado()) {
      this.router.navigate(['/registro']);
      return;
    }

    // Cargar alergenos disponibles
    this.allergensService.obtenerAlergenos().subscribe({
      next: (alergenos) => {
        this.opcionesAlergenos = alergenos;
        this.cargandoAlergenos = false;
        console.log('✅ Alergenos cargados para selector:', alergenos.length);
      },
      error: (err) => {
        console.error('Error cargando alergenos:', err);
        this.cargandoAlergenos = false;
      }
    });
  }

  /**
   * Calcula los límites basados en TMB/TDEE
   * Fórmula de Mifflin-St Jeor
   */
  calcularLimites(): LimitesCalculados | null {
    if (!this.edad || !this.altura || !this.peso) {
      return null;
    }

    // TMB = (10 * peso_kg + 6.25 * altura_cm - 5 * edad_años) ± 5
    let tmb = 10 * this.peso + 6.25 * this.altura - 5 * this.edad;

    // Ajuste por sexo
    if (this.sexo === 'F') {
      tmb -= 161;
    } else if (this.sexo === 'M') {
      tmb += 5;
    } else {
      // Otro: promedio
      tmb -= 78;
    }

    // Factores de actividad
    const factoresActividad: { [key: string]: number } = {
      sedentario: 1.2,
      ligero: 1.375,
      moderado: 1.55,
      activo: 1.725,
      muy_activo: 1.9
    };

    // Factores de objetivo
    const factoresObjetivo: { [key: string]: number } = {
      perder_peso: 0.9,
      mantener: 1.0,
      ganar_musculo: 1.1
    };

    // TDEE = TMB * factor_actividad * factor_objetivo
    const calorias = Math.round(
      tmb *
        factoresActividad[this.nivelActividad] *
        factoresObjetivo[this.objetivo]
    );

    // Proteínas: 1.6-2.2g/kg según objetivo
    let proteinasGramos: number;
    if (this.objetivo === 'ganar_musculo') {
      proteinasGramos = this.peso * 2.2;
    } else if (this.objetivo === 'perder_peso') {
      proteinasGramos = this.peso * 2.0; // Mayor en déficit calórico
    } else {
      proteinasGramos = this.peso * 1.6;
    }

    // Grasas: 25-30% de calorías (aproximadamente 1g por 37 calorías)
    const grasasGramos = Math.round(calorias * 0.27) / 9;

    // Azúcares: OMS recomienda menos del 10% de calorías diarias (beneficios adicionales por debajo del 5%)
    // Usamos 10% como recomendación estándar
    const azucaresGramos = Math.round((calorias * 0.10) / 4);

    return {
      calorias,
      proteinas: Math.round(proteinasGramos * 10) / 10,
      grasas: Math.round(grasasGramos * 10) / 10,
      azucares: azucaresGramos
    };
  }

  /**
   * Se ejecuta al cambiar cualquier campo de cálculo
   */
  onCampoChanged(): void {
    this.limitesCalculados = this.calcularLimites();
  }

  /**
   * Valida el formulario
   */
  validar(): boolean {
    if (!this.nombreCompleto.trim()) {
      this.mostrarMensaje('El nombre completo es requerido', 'error');
      return false;
    }

    if (!this.edad || this.edad < 13 || this.edad > 120) {
      this.mostrarMensaje('La edad debe estar entre 13 y 120 años', 'error');
      return false;
    }

    if (!this.altura || this.altura < 100 || this.altura > 300) {
      this.mostrarMensaje('La altura debe estar entre 100 y 300 cm', 'error');
      return false;
    }

    if (!this.peso || this.peso < 25 || this.peso > 500) {
      this.mostrarMensaje('El peso debe estar entre 25 y 500 kg', 'error');
      return false;
    }

    if (!this.limitesCalculados) {
      this.mostrarMensaje('Error al calcular los límites', 'error');
      return false;
    }

    return true;
  }

  /**
   * Completa el onboarding y guarda en backend
   */
  completarOnboarding(): void {
    if (!this.validar()) {
      return;
    }

    if (!this.limitesCalculados) {
      this.mostrarMensaje('Error al calcular los límites', 'error');
      return;
    }

    this.cargando = true;

    const datosOnboarding = {
      nombre_completo: this.nombreCompleto,
      edad: this.edad,
      sexo: this.sexo,
      altura: this.altura,
      peso: this.peso,
      nivel_actividad: this.nivelActividad,
      objetivo: this.objetivo,
      limites_calorias: this.limitesCalculados.calorias,
      limites_proteinas: this.limitesCalculados.proteinas,
      limites_grasas: this.limitesCalculados.grasas,
      limites_azucares: this.limitesCalculados.azucares,
      intolerancias: this.intolerancias
    };

    this.authService.actualizarPerfil(datosOnboarding).subscribe({
      next: (response) => {
        // Redirigir inmediatamente a perfil sin esperar
        this.router.navigate(['/perfil']);
      },
      error: (error) => {
        this.cargando = false;
        const mensaje = error.error?.error || 'Error al completar el onboarding';
        this.mostrarMensaje(mensaje, 'error');
      }
    });
  }

  /**
   * Toggle de intolerancia
   */
  toggleIntolerancia(alergeno: string): void {
    const index = this.intolerancias.indexOf(alergeno);
    if (index > -1) {
      this.intolerancias.splice(index, 1);
    } else {
      this.intolerancias.push(alergeno);
    }
    console.log('Intolerancias seleccionadas:', this.intolerancias);
  }

  /**
   * Cancela el onboarding y hace logout
   */
  cancelarOnboarding(): void {
    if (confirm('¿Descartar datos y cerrar sesión?')) {
      this.authService.logout();
      this.router.navigate(['/login']);
    }
  }

  private mostrarMensaje(texto: string, tipo: 'error' | 'exito'): void {
    this.mensaje = texto;
    this.mensajeTipo = tipo;
    setTimeout(() => {
      this.mensaje = '';
    }, 4000);
  }
}
