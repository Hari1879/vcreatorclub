import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { LucideAngularModule } from 'lucide-angular';
import { ApiService, errorMessage } from '../../core/api.service';
import { CoCreateApi } from '../../core/co-create.api';
import { ToastService } from '../../core/toast.service';
import { signInUrl } from '../../core/constants';
import { AdminRole } from '../../core/models';
import { I } from '../../shared/icons';
import { SpinnerComponent, VccLogoComponent } from '../../shared/ui.components';
import { AdminStore } from './admin.store';

type State = 'loading' | 'signed-out' | 'denied' | 'ready' | 'error';

const ROLE_LABEL: Record<AdminRole, string> = { super_admin: 'Super Admin', admin: 'Admin', viewer: 'Viewer' };

@Component({
  selector: 'vcc-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LucideAngularModule, VccLogoComponent, SpinnerComponent],
  providers: [AdminStore],
  template: `
    @switch (state()) {
      @case ('loading') {
        <div class="grid min-h-screen place-items-center bg-vcc-navy text-white"><vcc-spinner [size]="36" /></div>
      }
      @case ('ready') {
        <div class="min-h-screen bg-slate-50">
          <!-- Sidebar (fixed, 220px) -->
          <aside class="fixed inset-y-0 left-0 z-30 flex w-[220px] flex-col bg-vcc-navy px-3 py-6 text-white">
            <vcc-logo [width]="180" class="px-2" />
            <div class="mx-2 mt-8 rounded-lg bg-white/5 px-3 py-2.5">
              <p class="truncate font-semibold">{{ store.admin()?.name }}</p>
              <p class="text-xs text-vcc-gray-light">{{ roleLabel() }}</p>
            </div>
            <nav class="mt-6 flex flex-col gap-1">
              @for (n of visibleNav(); track n.path) {
                <a [routerLink]="n.path" routerLinkActive="!bg-vcc-blue !text-white shadow-lg shadow-vcc-blue/30" [routerLinkActiveOptions]="{ exact: n.exact }"
                   class="flex items-center gap-3 rounded-lg px-4 py-3 text-[15px] text-vcc-gray-light transition hover:bg-white/5 hover:text-white">
                  <lucide-icon [img]="n.icon" [size]="20" /> {{ n.label }}
                  @if (n.badge && n.badge() > 0) {
                    <span class="ml-auto rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-vcc-navy" [attr.aria-label]="n.badge() + ' pending'">{{ n.badge() }}</span>
                  }
                </a>
              }
            </nav>
            <div class="mx-3 my-4 h-px bg-vcc-blue/30"></div>
            <button class="flex items-center gap-3 rounded-lg px-4 py-3 text-[15px] text-vcc-gray-light hover:bg-white/5 hover:text-white" (click)="logout()">
              <lucide-icon [img]="I.LogOut" [size]="20" /> Logout
            </button>
          </aside>

          <div class="pl-[220px]">
            <header class="sticky top-0 z-20 flex h-16 items-center justify-end gap-4 bg-vcc-navy px-8 text-white">
              <span class="grid h-9 w-9 place-items-center rounded-full bg-vcc-blue font-bold">{{ initial() }}</span>
              <span class="leading-tight">
                <span class="block text-sm font-semibold">{{ store.admin()?.name }}</span>
                <span class="block text-xs text-vcc-gray-light">{{ roleLabel() }}</span>
              </span>
            </header>
            <main class="min-w-[804px] px-8 py-8">
              @if (!store.canWrite()) {
                <p class="mb-5 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800">You have view-only access.</p>
              }
              <router-outlet />
            </main>
          </div>
          <div class="fixed bottom-6 right-6 z-[60] flex w-80 flex-col gap-2" aria-live="assertive">
            @for (t of toast.toasts(); track t.id) {
              <div [class]="'flex items-start justify-between gap-3 rounded-lg px-4 py-3 text-sm text-white shadow-lg ' + (t.kind === 'error' ? 'bg-red-600' : 'bg-green-600')" role="alert">
                <span>{{ t.text }}</span>
                <button class="opacity-80 hover:opacity-100" (click)="toast.dismiss(t.id)" aria-label="Dismiss">✕</button>
              </div>
            }
          </div>
        </div>
      }
      @default {
        <div class="grid min-h-screen place-items-center bg-hero px-6 text-center text-white">
          <div class="max-w-sm">
            <vcc-logo [width]="260" class="mx-auto block w-fit" />
            <h1 class="mt-6 text-4xl font-bold">VCC Admin</h1>
            @if (state() === 'signed-out') {
              <p class="mt-3 text-vcc-gray-light">Sign in with your authorised Google account.</p>
              <a [href]="signIn" class="btn-primary mt-8 px-8 py-3">Sign in with Google</a>
            } @else if (state() === 'denied') {
              <p class="mt-4 rounded-lg border border-vcc-danger/40 bg-vcc-danger/10 p-4">
                Access denied. This area is restricted to authorised VCC team members.
              </p>
              <button class="btn-ghost mt-6" (click)="logout()">Sign in with a different account</button>
            } @else {
              <p class="mt-4 text-red-300">{{ error() }}</p>
              <button class="btn-primary mt-6" (click)="load()">Try again</button>
            }
          </div>
        </div>
      }
    }
  `,
})
export class AdminShellComponent implements OnInit {
  protected store = inject(AdminStore);
  private api = inject(ApiService);
  private coApi = inject(CoCreateApi);
  protected toast = inject(ToastService);
  private router = inject(Router);
  protected readonly I = I;
  protected state = signal<State>('loading');
  protected error = signal('');
  protected signIn = signInUrl('/admin');

  protected nav: { path: string; label: string; icon: typeof I.Users; exact: boolean; superOnly?: boolean; badge?: () => number }[] = [
    { path: '/admin', label: 'Dashboard', icon: I.LayoutDashboard, exact: true },
    { path: '/admin/creators', label: 'Creators', icon: I.Users, exact: false },
    { path: '/admin/campaigns', label: 'Campaigns', icon: I.Megaphone, exact: false },
    { path: '/admin/tokens', label: 'QR Tokens', icon: I.QrCode, exact: false },
    { path: '/admin/co-create', label: 'Co-Create Requests', icon: I.Handshake, exact: false, badge: () => this.store.coCreatePending() },
    { path: '/admin/users', label: 'Users', icon: I.UserCog, exact: false, superOnly: true },
  ];

  protected visibleNav = computed(() =>
    this.nav.filter((n) => !n.superOnly || this.store.isSuperAdmin()),
  );
  protected roleLabel = () => ROLE_LABEL[(this.store.admin()?.role ?? 'admin') as AdminRole];
  protected initial = () => (this.store.admin()?.name ?? '?').charAt(0).toUpperCase();

  ngOnInit() {
    this.load();
  }

  async load() {
    this.state.set('loading');
    try {
      const a = await this.api.adminMe();
      this.store.admin.set({ name: a.name, email: a.email, role: a.role as AdminRole });
      this.state.set('ready');
      this.coApi.summary().then((r) => this.store.coCreatePending.set(r.pending)).catch(() => undefined);
    } catch (e) {
      const status = e instanceof HttpErrorResponse ? e.status : 0;
      if (status === 401) this.state.set('signed-out');
      else if (status === 403) this.state.set('denied');
      else {
        this.error.set(errorMessage(e));
        this.state.set('error');
      }
    }
  }

  async logout() {
    await this.api.logout().catch(() => undefined);
    if (this.state() === 'denied') {
      this.state.set('signed-out');
      return;
    }
    this.router.navigateByUrl('/');
  }
}
