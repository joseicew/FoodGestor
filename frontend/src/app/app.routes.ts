import { Routes } from '@angular/router';
import { Perfil } from './components/perfil/perfil';
import { Alimentos } from './components/alimentos/alimentos';
import { AlimentoAnadir } from './components/alimentos/anadir/alimento-anadir';
import { Raciones } from './components/raciones/raciones';
import { Calendario } from './components/calendario/calendario';
import { LoginComponent } from './components/login/login';
import { RegistroComponent } from './components/registro/registro';
import { OnboardingComponent } from './components/onboarding/onboarding';
import { AuthGuard } from './guards/auth.guard';
import { StatsComponent } from './components/stats/stats';

export const routes: Routes = [
  // Rutas públicas
  { path: 'login', component: LoginComponent },
  { path: 'registro', component: RegistroComponent },

  // Rutas protegidas
  { path: 'onboarding', component: OnboardingComponent, canActivate: [AuthGuard] },
  { path: 'perfil', component: Perfil, canActivate: [AuthGuard] },
  { path: 'alimentos', component: Alimentos, canActivate: [AuthGuard] },
  { path: 'alimentos/nuevo', component: AlimentoAnadir, canActivate: [AuthGuard] },
  { path: 'raciones', component: Raciones, canActivate: [AuthGuard] },
  { path: 'calendario', component: Calendario, canActivate: [AuthGuard] },
  { path: 'stats', component: StatsComponent, canActivate: [AuthGuard] },

  // Redirect por defecto
  { path: '', redirectTo: 'perfil', pathMatch: 'full' }
];
