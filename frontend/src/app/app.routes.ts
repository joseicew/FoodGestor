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
import { AdminGuard } from './guards/admin.guard';
import { StatsComponent } from './components/stats/stats';
import { ResetPasswordComponent } from './components/reset-password/reset-password';
import { AdminLayoutComponent } from './components/admin/admin-layout/admin-layout';
import { AdminUsuariosComponent } from './components/admin/usuarios/admin-usuarios';
import { AdminAlimentosComponent } from './components/admin/alimentos/admin-alimentos';
import { AdminIngredientesComponent } from './components/admin/ingredientes/admin-ingredientes';

export const routes: Routes = [
  // Rutas públicas
  { path: 'login', component: LoginComponent },
  { path: 'registro', component: RegistroComponent },
  { path: 'resetear-password', component: ResetPasswordComponent },

  // Rutas protegidas
  { path: 'onboarding', component: OnboardingComponent, canActivate: [AuthGuard] },
  { path: 'perfil', component: Perfil, canActivate: [AuthGuard] },
  { path: 'alimentos', component: Alimentos, canActivate: [AuthGuard] },
  { path: 'alimentos/nuevo', component: AlimentoAnadir, canActivate: [AuthGuard] },
  { path: 'raciones', component: Raciones, canActivate: [AuthGuard] },
  { path: 'calendario', component: Calendario, canActivate: [AuthGuard] },
  { path: 'stats', component: StatsComponent, canActivate: [AuthGuard] },

  // Panel de administración (web) — solo admin/superadmin
  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [AdminGuard],
    children: [
      { path: 'usuarios', component: AdminUsuariosComponent },
      { path: 'alimentos', component: AdminAlimentosComponent },
      { path: 'ingredientes', component: AdminIngredientesComponent },
      { path: '', redirectTo: 'usuarios', pathMatch: 'full' }
    ]
  },

  // Redirect por defecto
  { path: '', redirectTo: 'perfil', pathMatch: 'full' }
];
