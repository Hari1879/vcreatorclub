import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ApiService, errorMessage } from '../../core/api.service';
import { AdminStats } from '../../core/models';
import { formatCount } from '../../core/constants';
import { I } from '../../shared/icons';
import { SpinnerComponent, StatusPillComponent, TierBadgeComponent } from '../../shared/ui.components';
import { KpiComponent } from './admin-ui';
import { AdminStore } from './admin.store';

@Component({
  selector: 'vcc-admin-dashboard',
  standalone: true,
  imports: [DatePipe, RouterLink, LucideAngularModule, KpiComponent, StatusPillComponent, TierBadgeComponent, SpinnerComponent],
  template: `
    <div class="flex items-center justify-between">
      <h1 class="text-5xl font-bold text-vcc-navy">Dashboard</h1>
      @if (store.canWrite()) {
        <div class="flex gap-3">
          <a routerLink="/admin/tokens" [queryParams]="{ new: 1 }" class="btn-primary"><lucide-icon [img]="I.QrCode" [size]="18" /> Generate QR token</a>
          <a routerLink="/admin/campaigns" [queryParams]="{ new: 1 }" class="btn border border-vcc-blue text-vcc-blue hover:bg-blue-50"><lucide-icon [img]="I.Plus" [size]="18" /> New campaign</a>
          <button type="button" class="btn border border-vcc-blue text-vcc-blue hover:bg-blue-50 disabled:opacity-60" [disabled]="testing()" (click)="sendTest()">
            <lucide-icon [img]="testing() ? I.Loader2 : I.Mail" [size]="18" /> SEND TEST EMAIL
          </button>
        </div>
      }
    </div>
    @if (testResult(); as r) {
      <p class="mt-3 text-right text-sm" role="status" [class.text-red-600]="r.error" [class.text-gray-600]="!r.error">{{ r.text }}</p>
    }

    <div class="mt-7 grid grid-cols-2 gap-4 xl:grid-cols-4">
      <vcc-kpi label="Total enrolled" [value]="stats()?.totalEnrolled" [icon]="I.Users" />
      <vcc-kpi label="Pending approval" [value]="stats()?.pending" [icon]="I.Hourglass" tone="bg-amber-50 text-amber-600" />
      <vcc-kpi label="Approved" [value]="stats()?.approved" [icon]="I.Check" tone="bg-green-50 text-vcc-success" />
      <vcc-kpi label="Active campaigns" [value]="stats()?.activeCampaigns" [icon]="I.Megaphone" />
    </div>

    <section class="card-light mt-7 overflow-hidden">
      <div class="flex items-center justify-between px-6 py-4">
        <h2 class="text-2xl font-bold text-vcc-navy">Recent enrollments</h2>
        <a routerLink="/admin/creators" class="text-sm font-semibold text-vcc-blue hover:underline">Open roster</a>
      </div>
      @if (loading()) {
        <div class="grid place-items-center py-12 text-vcc-blue"><vcc-spinner [size]="28" /></div>
      } @else if (error()) {
        <p class="px-6 pb-6 text-red-600">{{ error() }}</p>
      } @else {
        <table class="w-full text-left text-sm">
          <thead class="heading bg-slate-50 text-xs text-gray-600">
            <tr><th class="px-6 py-3">Name</th><th class="px-4 py-3">Core platform</th><th class="px-4 py-3">Followers</th><th class="px-4 py-3">City</th><th class="px-4 py-3">Status</th><th class="px-4 py-3">Tier</th><th class="px-4 py-3">Enrolled</th></tr>
          </thead>
          <tbody>
            @for (p of stats()?.recent; track p.id) {
              <tr class="border-t border-gray-100">
                <td class="px-6 py-3"><span class="font-semibold text-gray-900">{{ p.fullName }}</span><span class="block text-xs text-gray-500">{{ p.contentCategory }}</span></td>
                <td class="px-4 py-3 capitalize">{{ p.corePlatform }}</td>
                <td class="px-4 py-3">{{ fmt(coreFollowers(p)) }}</td>
                <td class="px-4 py-3">{{ p.city }}</td>
                <td class="px-4 py-3"><vcc-status-pill [status]="p.status" /></td>
                <td class="px-4 py-3"><vcc-tier-badge [tier]="p.tier" [light]="true" /></td>
                <td class="px-4 py-3 text-gray-500">{{ p.enrolledAt | date: 'd MMM, h:mm a' }}</td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="px-6 py-10 text-center text-gray-500">No enrollments yet.</td></tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
})
export class AdminDashboardComponent implements OnInit {
  private api = inject(ApiService);
  protected store = inject(AdminStore);
  protected readonly I = I;
  protected stats = signal<AdminStats | null>(null);
  protected loading = signal(true);
  protected error = signal<string | null>(null);
  protected testing = signal(false);
  protected testResult = signal<{ text: string; error: boolean } | null>(null);
  protected fmt = formatCount;

  protected async sendTest() {
    this.testing.set(true);
    this.testResult.set(null);
    try {
      const { status } = await this.api.sendTestEmail();
      this.testResult.set(
        status === 'sent'
          ? { text: 'Test email sent to your inbox', error: false }
          : status === 'skipped'
            ? { text: 'Email not configured (skipped)', error: false }
            : { text: `Test email ${status}`, error: true },
      );
    } catch (e) {
      this.testResult.set({ text: errorMessage(e), error: true });
    } finally {
      this.testing.set(false);
    }
  }
  protected coreFollowers = coreFollowers;

  async ngOnInit() {
    try {
      this.stats.set(await this.api.stats());
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
}

export function coreFollowers(p: {
  corePlatform: string;
  instagramFollowers: number | null;
  youtubeSubscribers: number | null;
  facebookFollowers: number | null;
  linkedinFollowers: number | null;
  threadsFollowers: number | null;
}): number {
  const map: Record<string, number | null> = {
    instagram: p.instagramFollowers,
    youtube: p.youtubeSubscribers,
    facebook: p.facebookFollowers,
    linkedin: p.linkedinFollowers,
    threads: p.threadsFollowers,
  };
  return map[p.corePlatform] ?? 0;
}
