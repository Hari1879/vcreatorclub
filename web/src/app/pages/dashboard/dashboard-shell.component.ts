import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ApiService, errorMessage } from '../../core/api.service';
import { I } from '../../shared/icons';
import { SpinnerComponent, VccLogoComponent } from '../../shared/ui.components';
import { CreatorStore } from './creator.store';

@Component({
  selector: 'vcc-dashboard-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LucideAngularModule, VccLogoComponent, SpinnerComponent],
  providers: [CreatorStore],
  template: `
    <div class="min-h-[100svh] bg-vcc-navy-deep text-white">
      @if (loading()) {
        <div class="grid min-h-[100svh] place-items-center"><vcc-spinner [size]="36" /></div>
      } @else if (error()) {
        <div class="grid min-h-[100svh] place-items-center px-6 text-center">
          <div>
            <p>{{ error() }}</p>
            <button class="btn-primary mt-6" (click)="load()">Try again</button>
          </div>
        </div>
      } @else if (store.profile()?.status !== 'approved') {
        <!-- Pending / rejected / inactive: no dashboard content -->
        <div class="flex min-h-[100svh] flex-col items-center justify-center px-6 text-center">
          <vcc-logo [size]="80" />
          @switch (store.profile()?.status) {
            @case ('pending') {
              <span class="mt-10 grid h-16 w-16 place-items-center rounded-full bg-vcc-warning/20 text-vcc-warning">
                <lucide-icon [img]="I.Hourglass" [size]="30" />
              </span>
              <h1 class="mt-6 text-3xl font-bold xs:text-4xl">Application Under Review</h1>
              <p class="mt-4 max-w-sm text-vcc-gray-light">
                Thank you for enrolling. Our team is reviewing your application. You will be notified once approved.
              </p>
            }
            @case ('rejected') {
              <h1 class="mt-10 text-3xl font-bold">Application Not Approved</h1>
              <p class="mt-4 max-w-sm text-vcc-gray-light">
                Thank you for your interest in VCC. Your application was not approved at this time. For questions, please contact the VCC team.
              </p>
            }
            @default {
              <h1 class="mt-10 text-3xl font-bold">Membership Inactive</h1>
              <p class="mt-4 max-w-sm text-vcc-gray-light">Your VCC membership is currently inactive. Please contact the VCC team.</p>
            }
          }
          <button class="btn-ghost mt-10 text-vcc-gray-light" (click)="logout()">
            <lucide-icon [img]="I.LogOut" [size]="18" /> Sign out
          </button>
        </div>
      } @else {
        <div class="lg:flex">
          <!-- Laptop sidebar -->
          <aside class="sticky top-0 hidden h-[100svh] w-60 shrink-0 flex-col border-r border-vcc-blue/15 bg-vcc-navy px-4 py-6 lg:flex">
            <vcc-logo [size]="48" [withText]="true" class="px-2" />
            <nav class="mt-10 flex flex-col gap-1">
              @for (n of nav; track n.path) {
                <a [routerLink]="n.path" routerLinkActive="!bg-vcc-blue !text-white" [routerLinkActiveOptions]="{ exact: n.exact }"
                   class="nav-item flex items-center gap-3 rounded-lg px-4 py-3 text-lg text-vcc-gray-light transition hover:bg-vcc-blue/10">
                  <lucide-icon [img]="n.icon" [size]="20" />
                  <span>{{ n.label }}</span>
                  @if (n.badge && store.unread()) {
                    <span class="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-vcc-danger px-1.5 text-xs font-bold text-white">{{ store.unread() }}</span>
                  }
                </a>
              }
            </nav>
            <button class="nav-item mt-auto flex items-center gap-3 rounded-lg px-4 py-3 text-lg text-vcc-gray-light hover:bg-vcc-blue/10" (click)="logout()">
              <lucide-icon [img]="I.LogOut" [size]="20" /> Logout
            </button>
          </aside>

          <div class="min-w-0 flex-1">
            <!-- Phone header -->
            <header class="flex items-center justify-between px-5 pb-2 pt-5 lg:hidden">
              <vcc-logo [size]="52" [withText]="true" />
              <a routerLink="/dashboard/notifications" class="relative p-2" aria-label="Notifications">
                <lucide-icon [img]="I.Bell" [size]="26" />
                @if (store.unread()) { <span class="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-vcc-danger"></span> }
              </a>
            </header>

            <main class="mx-auto max-w-3xl px-5 pb-28 pt-2 lg:px-10 lg:pb-12 lg:pt-10">
              <router-outlet />
            </main>
          </div>

          <!-- Phone bottom tabs -->
          <nav class="safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-vcc-blue/20 bg-vcc-navy/95 backdrop-blur lg:hidden">
            @for (n of nav; track n.path) {
              <a [routerLink]="n.path" routerLinkActive="!text-vcc-blue-light [&>span.bar]:!opacity-100" [routerLinkActiveOptions]="{ exact: n.exact }"
                 class="relative flex flex-col items-center gap-1 pb-2 pt-3 text-xs text-vcc-gray-light">
                <span class="relative">
                  <lucide-icon [img]="n.icon" [size]="24" />
                  @if (n.badge && store.unread()) {
                    <span class="absolute -right-2.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-vcc-danger px-1 text-[11px] font-bold text-white">{{ store.unread() }}</span>
                  }
                </span>
                {{ n.label }}
                <span class="bar absolute bottom-1 h-0.5 w-10 rounded bg-vcc-blue-light opacity-0"></span>
              </a>
            }
          </nav>
        </div>
      }
    </div>
  `,
})
export class DashboardShellComponent implements OnInit {
  protected store = inject(CreatorStore);
  private api = inject(ApiService);
  private router = inject(Router);
  protected readonly I = I;
  protected loading = signal(true);
  protected error = signal<string | null>(null);

  protected nav = [
    { path: '/dashboard', label: 'Home', icon: I.Home, exact: true, badge: false },
    { path: '/dashboard/campaigns', label: 'Campaigns', icon: I.Megaphone, exact: false, badge: false },
    { path: '/dashboard/profile', label: 'Profile', icon: I.User, exact: false, badge: false },
    { path: '/dashboard/notifications', label: 'Notifications', icon: I.Bell, exact: false, badge: true },
  ];

  ngOnInit() {
    this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.store.refresh();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  async logout() {
    await this.api.logout().catch(() => undefined);
    this.router.navigateByUrl('/');
  }
}
