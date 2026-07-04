import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin.guard';
import { LoginComponent } from './pages/login/login';
import { LayoutComponent } from './pages/layout/layout';
import { UsuariosComponent } from './pages/usuarios/usuarios';
import { AlimentosComponent } from './pages/alimentos/alimentos';
import { IngredientesComponent } from './pages/ingredientes/ingredientes';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: 'panel',
    component: LayoutComponent,
    canActivate: [adminGuard],
    children: [
      { path: 'usuarios', component: UsuariosComponent },
      { path: 'alimentos', component: AlimentosComponent },
      { path: 'ingredientes', component: IngredientesComponent },
      { path: '', redirectTo: 'usuarios', pathMatch: 'full' },
    ],
  },
  { path: '', redirectTo: 'panel', pathMatch: 'full' },
  { path: '**', redirectTo: 'panel' },
];
