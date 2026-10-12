import { Component, OnInit, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { I } from '../../shared/icons';
import { NotifIconComponent, TierBadgeComponent } from '../../shared/ui.components';
import { timeAgo } from '../../core/constants';
import { CreatorStore } from './creator.store';
import { CampaignCardComponent } from './campaign-card.component';

@Component({
  selector: 'vcc-home',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, TierBadgeComponent, NotifIconComponent, CampaignCardComponent, DatePipe],
  template: `
    @if (store.summary(); as s) {
      <!-- Greeting -->
      <section class="relative flex items-center gap-3 overflow-hidden py-4 xs:gap-5">
        <span class="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-vcc-blue-light bg-vcc-navy-light text-3xl font-bold shadow-[0_0_24px_rgba(66,165,245,0.45)] xs:h-24 xs:w-24">
          @if (s.profile.profilePhotoUrl) {
            <img [src]="s.profile.profilePhotoUrl" [alt]="s.profile.fullName" class="h-full w-full object-cover" />
          } @else {
            <span class="heading">{{ initials() }}</span>
          }
        </span>
        <div class="min-w-0 flex-1">
          <h1 class="break-words text-2xl font-bold leading-tight xs:text-3xl">Hi, {{ firstName() }} <span aria-hidden="true">👋</span></h1>
          <div class="mt-2"><vcc-tier-badge [tier]="s.profile.tier" /></div>
          <p class="heading mt-2 text-[10px] tracking-[0.2em] text-vcc-gray-light">Create · Collaborate · Grow</p>
        </div>
        <img src="/vcc-logo.svg" alt="" aria-hidden="true" class="h-16 w-14 shrink-0 drop-shadow-[0_0_12px_rgba(30,136,229,0.5)] xs:h-20 xs:w-16" />
      </section>

      <!-- Status -->
      <a routerLink="/dashboard/profile" class="card-dark mt-4 flex items-center gap-4 border-vcc-blue/50 bg-gradient-to-r from-vcc-navy-light to-vcc-blue-dark/30 px-5 py-4">
        <span class="h-3.5 w-3.5 rounded-full bg-vcc-success shadow-[0_0_10px_#43A047]"></span>
        <span class="flex-1">
          <span class="heading block text-xl font-bold">Active Member</span>
          <span class="text-sm text-vcc-gray-light">Enrolled {{ s.profile.enrolledAt | date: 'MMM y' }}</span>
        </span>
        <lucide-icon [img]="I.ChevronRight" [size]="22" class="text-vcc-gray-light" />
      </a>

      <!-- Notifications (database only — never hardcoded) -->
      <section class="mt-9">
        <div class="mb-3 flex items-end justify-between">
          <h2 class="text-2xl font-bold">Notifications</h2>
          <a routerLink="/dashboard/notifications" class="flex items-center gap-1 text-sm text-vcc-blue-light">View All <lucide-icon [img]="I.ChevronRight" [size]="16" /></a>
        </div>
        @for (n of s.notifications; track n.id) {
          <a routerLink="/dashboard/notifications" class="card-dark mb-3 flex items-start gap-3 p-3 xs:gap-4 xs:p-4">
            <vcc-notif-icon [type]="n.type" />
            <span class="min-w-0 flex-1">
              <span class="flex items-start justify-between gap-3">
                <span class="heading font-bold" [class.text-white]="!n.read" [class.text-vcc-gray-light]="n.read">{{ n.title }}</span>
                <span class="shrink-0 text-xs text-vcc-gray-light">{{ ago(n.createdAt) }}</span>
              </span>
              <span class="mt-0.5 line-clamp-2 block text-sm text-vcc-gray-light">{{ n.message }}</span>
            </span>
            <lucide-icon [img]="I.ChevronRight" [size]="18" class="mt-1 shrink-0 text-vcc-gray-light" />
          </a>
        } @empty {
          <p class="card-dark p-5 text-center text-sm text-vcc-gray-light">No notifications yet.</p>
        }
      </section>

      <!-- Campaigns -->
      <section class="mt-9">
        <div class="mb-3 flex items-end justify-between">
          <h2 class="text-2xl font-bold">Campaigns</h2>
          <a routerLink="/dashboard/campaigns" class="flex items-center gap-1 text-sm text-vcc-blue-light">View All <lucide-icon [img]="I.ChevronRight" [size]="16" /></a>
        </div>
        @for (c of s.campaigns; track c.id) {
          <vcc-campaign-card [campaign]="c" [compact]="true" class="mb-3 block" />
        } @empty {
          <p class="card-dark p-5 text-center text-sm text-vcc-gray-light">No campaigns available right now. Check back soon.</p>
        }
      </section>
    }
  `,
})
export class HomeComponent implements OnInit {
  protected store = inject(CreatorStore);
  protected readonly I = I;
  protected firstName = computed(() => (this.store.profile()?.fullName ?? '').trim().split(/\s+/)[0]);
  protected initials = computed(() =>
    (this.store.profile()?.fullName ?? '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join(''),
  );
  protected ago = timeAgo;

  ngOnInit() {
    this.store.refresh().catch(() => undefined);
  }
}
