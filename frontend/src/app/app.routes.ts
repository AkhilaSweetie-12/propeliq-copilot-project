import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
	{
		path: 'login',
		canActivate: [guestGuard],
		loadComponent: () => import('./features/auth/login.component').then((module) => module.LoginComponent),
	},
	{
		path: 'register',
		canActivate: [guestGuard],
		loadComponent: () => import('./features/auth/register.component').then((module) => module.RegisterComponent),
	},
	{
		path: 'dashboard',
		canActivate: [authGuard],
		loadComponent: () => import('./features/dashboard/dashboard.component').then((module) => module.DashboardComponent),
	},
	{
		path: '',
		pathMatch: 'full',
		redirectTo: 'dashboard',
	},
	{
		path: '**',
		redirectTo: 'dashboard',
	},
];
