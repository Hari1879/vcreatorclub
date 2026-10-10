import { Component, computed, input } from '@angular/core';
import { NgClass } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { TIER_META, TIER_PILL_LIGHT } from '../core/constants';
import { NotificationType, ProfileStatus, Tier } from '../core/models';
import { I } from './icons';

/** VCC V-emblem (original artwork — never the Vivo logo or wordmark). */
@Component({
  selector: 'vcc-logo',
  standalone: true,
  template: `
    <span class="inline-flex items-center gap-3">
      <svg [attr.width]="size()" [attr.height]="size() * 0.8" viewBox="0 0 120 96" aria-hidden="true"
           class="drop-shadow-[0_0_12px_rgba(30,136,229,0.55)]">
        <defs>
          <linearGradient [attr.id]="'vl' + uid" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#1565C0" /><stop offset="1" stop-color="#1E88E5" />
          </linearGradient>
          <linearGradient [attr.id]="'vr' + uid" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#90CAF9" /><stop offset="1" stop-color="#42A5F5" />
          </linearGradient>
        </defs>
        <path d="M4 6h30l30 70-15 14z" [attr.fill]="'url(#vl' + uid + ')'" />
        <path d="M86 6h30L66 90l-15-14z" [attr.fill]="'url(#vr' + uid + ')'" />
      </svg>
      @if (withText()) {
        <span class="flex flex-col leading-none" [class.text-white]="!dark()" [class.text-vcc-navy]="dark()">
          <span class="heading font-bold" [style.font-size.px]="size() * 0.42">VCC</span>
          <span class="heading mt-0.5 tracking-[0.25em] opacity-80" [style.font-size.px]="Math.max(9, size() * 0.15)">Creator Club</span>
        </span>
      }
    </span>
  `,
})
export class VccLogoComponent {
  size = input(48);
  withText = input(false);
  dark = input(false);
  protected readonly Math = Math;
  protected readonly uid = Math.random().toString(36).slice(2, 8);
}

@Component({
  selector: 'vcc-tier-badge',
  standalone: true,
  imports: [NgClass],
  template: `<span class="pill heading text-[13px] tracking-wider" [ngClass]="cls()">{{ meta().label }}</span>`,
})
export class TierBadgeComponent {
  tier = input.required<Tier>();
  light = input(false);
  meta = computed(() => TIER_META[this.tier()] ?? TIER_META.inactive);
  cls = computed(() => (this.light() ? TIER_PILL_LIGHT[this.tier()] : this.meta().pill));
}

const STATUS_CLS: Record<ProfileStatus, string> = {
  pending: 'bg-amber-200 text-amber-950',
  approved: 'bg-vcc-success text-white',
  rejected: 'bg-vcc-danger text-white',
  inactive: 'bg-vcc-gray text-white',
};

@Component({
  selector: 'vcc-status-pill',
  standalone: true,
  imports: [NgClass],
  template: `<span class="pill capitalize" [ngClass]="cls()"><span class="h-1.5 w-1.5 rounded-full bg-current opacity-70"></span>{{ status() }}</span>`,
})
export class StatusPillComponent {
  status = input.required<ProfileStatus>();
  cls = computed(() => STATUS_CLS[this.status()] ?? STATUS_CLS.inactive);
}

const NOTIF: Record<NotificationType, { icon: any; cls: string }> = {
  info: { icon: I.Info, cls: 'bg-vcc-blue text-white' },
  campaign: { icon: I.Megaphone, cls: 'bg-vcc-gold text-vcc-navy' },
  approval: { icon: I.Check, cls: 'bg-vcc-success text-white' },
  alert: { icon: I.AlertTriangle, cls: 'bg-vcc-danger text-white' },
};

@Component({
  selector: 'vcc-notif-icon',
  standalone: true,
  imports: [NgClass, LucideAngularModule],
  template: `
    <span class="grid h-11 w-11 shrink-0 place-items-center rounded-full" [ngClass]="meta().cls">
      <lucide-icon [img]="meta().icon" [size]="20" />
    </span>
  `,
})
export class NotifIconComponent {
  type = input.required<NotificationType>();
  meta = computed(() => NOTIF[this.type()] ?? NOTIF.info);
}

@Component({
  selector: 'vcc-spinner',
  standalone: true,
  imports: [LucideAngularModule],
  template: `<lucide-icon [img]="I.Loader2" [size]="size()" class="animate-spin" />`,
})
export class SpinnerComponent {
  size = input(20);
  protected readonly I = I;
}
