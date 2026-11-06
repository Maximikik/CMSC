import { Routes } from '@angular/router';
import { adminGuard, authGuard } from './core/auth';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login').then(m => m.LoginPage), title: 'Sign in | Sitewright' },
  { path: '', canActivate: [authGuard], loadComponent: () => import('./pages/sites').then(m => m.SitesPage), title: 'Your sites | Sitewright' },
  { path: 'users', canActivate: [adminGuard], loadComponent: () => import('./pages/users').then(m => m.UsersPage), title: 'Users | Sitewright' },
  { path: 'sites/:id', canActivate: [authGuard], loadComponent: () => import('./pages/editor').then(m => m.EditorPage), title: 'Editor | Sitewright' },
  { path: '**', redirectTo: '' },
];
