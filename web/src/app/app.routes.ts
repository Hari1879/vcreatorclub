import { Routes } from '@angular/router';
import { creatorGuard } from './core/guards';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./pages/landing/landing.component').then((m) => m.LandingComponent),
  },
  {
    path: 'join',
    title: 'Join VCC',
    loadComponent: () => import('./pages/join/join.component').then((m) => m.JoinComponent),
  },
  {
    path: 'dashboard',
    canActivate: [creatorGuard],
    loadComponent: () =>
      import('./pages/dashboard/dashboard-shell.component').then((m) => m.DashboardShellComponent),
    children: [
      {
        path: '',
        title: 'VCC — Home',
        loadComponent: () => import('./pages/dashboard/home.component').then((m) => m.HomeComponent),
      },
      {
        path: 'campaigns',
        title: 'VCC — Campaigns',
        loadComponent: () =>
          import('./pages/dashboard/campaigns.component').then((m) => m.CreatorCampaignsComponent),
      },
      {
        path: 'profile',
        title: 'VCC — Profile',
        loadComponent: () => import('./pages/dashboard/profile.component').then((m) => m.ProfileComponent),
      },
      {
        path: 'notifications',
        title: 'VCC — Notifications',
        loadComponent: () =>
          import('./pages/dashboard/notifications.component').then((m) => m.NotificationsComponent),
      },
    ],
  },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin-shell.component').then((m) => m.AdminShellComponent),
    children: [
      {
        path: '',
        title: 'VCC Admin — Dashboard',
        loadComponent: () =>
          import('./pages/admin/admin-dashboard.component').then((m) => m.AdminDashboardComponent),
      },
      {
        path: 'creators',
        title: 'VCC Admin — Creators',
        loadComponent: () =>
          import('./pages/admin/admin-creators.component').then((m) => m.AdminCreatorsComponent),
      },
      {
        path: 'campaigns',
        title: 'VCC Admin — Campaigns',
        loadComponent: () =>
          import('./pages/admin/admin-campaigns.component').then((m) => m.AdminCampaignsComponent),
      },
      {
        path: 'users',
        title: 'VCC Admin — Users',
        loadComponent: () => import('./pages/admin/admin-users.component').then((m) => m.AdminUsersComponent),
      },
      {
        path: 'tokens',
        title: 'VCC Admin — QR Tokens',
        loadComponent: () => import('./pages/admin/admin-tokens.component').then((m) => m.AdminTokensComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
