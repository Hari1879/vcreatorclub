import { Component, computed, input } from '@angular/core';
import { NgClass } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { TIER_META, TIER_PILL_LIGHT } from '../core/constants';
import { NotificationType, ProfileStatus, Tier } from '../core/models';
import { I } from './icons';

type VccLogoVariant = 'black' | 'blue' | 'copper';

@Component({
  selector: 'vcc-logo',
  standalone: true,
  template: `
    <img
      [src]="'/brand/logo-' + variant() + '.png'"
      [style.width.px]="width()"
      class="block h-auto max-w-full object-contain"
      alt="V Creator Club — Powered by Fangs Technology Pvt. Ltd."
    />
  `,
})
export class VccLogoComponent {
  width = input(180);
  variant = input<VccLogoVariant>('copper');
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
