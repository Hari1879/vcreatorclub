import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { ApiService, errorMessage } from '../../core/api.service';
import { PLATFORMS, formatCount } from '../../core/constants';
import { I } from '../../shared/icons';
import { TierBadgeComponent } from '../../shared/ui.components';
import { ProfileFormComponent, ProfileFormValue } from '../../shared/profile-form/profile-form.component';
import { CreatorStore } from './creator.store';

@Component({
  selector: 'vcc-profile',
  standalone: true,
  imports: [DatePipe, DecimalPipe, LucideAngularModule, TierBadgeComponent, ProfileFormComponent],
  template: `
    @if (store.profile(); as p) {
      @if (!editing()) {
        <div class="mb-5 flex items-end justify-between">
          <h1 class="text-4xl font-bold">Profile</h1>
          <button class="btn-primary" (click)="startEdit()"><lucide-icon [img]="I.Pencil" [size]="16" /> Edit</button>
        </div>
        @if (saved()) {
          <p class="mb-4 flex items-center gap-2 rounded-lg bg-vcc-success/15 px-4 py-3 text-sm text-green-300">
            <lucide-icon [img]="I.CheckCircle2" [size]="18" /> Profile updated.
          </p>
        }

        <section class="card-dark p-5">
          <h2 class="text-2xl font-bold">{{ p.fullName }}</h2>
          <div class="mt-2"><vcc-tier-badge [tier]="p.tier" /></div>
          <dl class="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div><dt class="text-vcc-gray-light">Email</dt><dd class="break-all">{{ p.email }}</dd></div>
            <div><dt class="text-vcc-gray-light">Phone</dt><dd>+91 {{ p.phone }}</dd></div>
            <div><dt class="text-vcc-gray-light">City</dt><dd>{{ p.city }}</dd></div>
            <div>
              <dt class="text-vcc-gray-light">Coordination</dt>
              <dd>{{ p.coordinationMode === 'manager' ? 'Through manager — ' + p.managerName + ' (' + p.managerContact + ')' : 'Directly' }}</dd>
            </div>
          </dl>
        </section>

        <section class="card-dark mt-4 p-5">
          <h3 class="text-lg font-bold">Platforms</h3>
          <ul class="mt-3 space-y-2 text-sm">
            @for (pl of platforms(); track pl.label) {
              <li class="flex items-center justify-between gap-3 rounded-lg bg-vcc-navy/60 px-4 py-3">
                <span class="min-w-0">
                  <span class="font-semibold">{{ pl.label }}</span>
                  @if (pl.core) { <span class="pill heading ml-2 bg-vcc-blue px-2 py-0.5 text-[10px]">Core</span> }
                  <span class="block truncate text-vcc-gray-light">{{ pl.link }}</span>
                </span>
                <span class="shrink-0 font-semibold">{{ fmt(pl.count) }}</span>
              </li>
            }
          </ul>
          @if (p.otherPlatforms) { <p class="mt-3 text-sm text-vcc-gray-light">Also on: {{ p.otherPlatforms }}</p> }
          <dl class="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt class="text-vcc-gray-light">Main category</dt><dd>{{ p.contentCategory }}</dd></div>
            <div><dt class="text-vcc-gray-light">Languages</dt><dd>{{ p.contentLanguages.join(', ') }}</dd></div>
          </dl>
        </section>

        <section class="card-dark mt-4 p-5">
          <h3 class="text-lg font-bold">Content</h3>
          @if (p.contentTypes.length) {
            <div class="mt-3 flex flex-wrap gap-2">
              @for (t of p.contentTypes; track t) { <span class="pill border border-vcc-blue/40 text-vcc-gray-light">{{ t }}</span> }
            </div>
          }
          @if (p.bio) { <p class="mt-3 whitespace-pre-line text-sm text-vcc-gray-light">{{ p.bio }}</p> }
          @if (hasRates()) {
            <dl class="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              @for (r of [{ l: 'Story', v: p.rateStory }, { l: 'Post', v: p.ratePost }, { l: 'Reel', v: p.rateReel }, { l: 'TVC', v: p.rateTvc }]; track r.l) {
                @if (r.v !== null) { <div><dt class="text-vcc-gray-light">{{ r.l }}</dt><dd>₹{{ r.v | number }}</dd></div> }
              }
            </dl>
          }
          <p class="mt-4 text-sm"><span class="text-vcc-gray-light">Worked with Vivo before:</span> {{ p.workedWithVivo ? 'Yes' : 'No' }}
            @if (p.vivoWorkDetails) { — {{ p.vivoWorkDetails }} }</p>
        </section>

        <section class="card-dark mt-4 p-5">
          <h3 class="text-lg font-bold">Membership</h3>
          <dl class="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt class="text-vcc-gray-light">Status</dt><dd class="capitalize">{{ p.status }}</dd></div>
            <div><dt class="text-vcc-gray-light">Tier</dt><dd><vcc-tier-badge [tier]="p.tier" /></dd></div>
            <div><dt class="text-vcc-gray-light">Enrolled</dt><dd>{{ p.enrolledAt | date: 'd MMM y' }}</dd></div>
            <div><dt class="text-vcc-gray-light">Approved</dt><dd>{{ p.approvedAt ? (p.approvedAt | date: 'd MMM y') : '—' }}</dd></div>
          </dl>
        </section>
      } @else {
        <div class="mb-4 flex items-center justify-between">
          <h1 class="text-3xl font-bold">Edit Profile</h1>
          <button class="btn-ghost" (click)="editing.set(false)"><lucide-icon [img]="I.X" [size]="18" /> Cancel</button>
        </div>
        @if (formStep() > 1) {
          <button class="mb-3 flex items-center gap-1 text-sm text-vcc-blue-light" (click)="form.back()">
            <lucide-icon [img]="I.ChevronLeft" [size]="18" /> Back
          </button>
        }
        @if (error()) { <p class="mb-4 rounded-lg bg-vcc-danger/15 p-3 text-sm text-red-300">{{ error() }}</p> }
        <div class="mx-auto max-w-md">
          <vcc-profile-form #form mode="edit" [initial]="p" [busy]="busy()" [(step)]="formStep" (completed)="save($event)" />
        </div>
      }
    }
  `,
})
export class ProfileComponent {
  protected store = inject(CreatorStore);
  private api = inject(ApiService);
  protected readonly I = I;
  protected editing = signal(false);
  protected busy = signal(false);
  protected saved = signal(false);
  protected error = signal<string | null>(null);
  protected formStep = signal(1);
  protected fmt = formatCount;

  protected hasRates = computed(() => {
    const p = this.store.profile();
    return !!p && [p.rateStory, p.ratePost, p.rateReel, p.rateTvc].some((v) => v !== null);
  });

  protected platforms = computed(() => {
    const p = this.store.profile();
    if (!p) return [];
    const rows = [
      { v: 'instagram', link: p.instagramHandle || p.instagramUrl, count: p.instagramFollowers },
      { v: 'youtube', link: p.youtubeHandle || p.youtubeUrl, count: p.youtubeSubscribers },
      { v: 'facebook', link: p.facebookUrl, count: p.facebookFollowers },
      { v: 'linkedin', link: p.linkedinUrl, count: p.linkedinFollowers },
      { v: 'threads', link: p.threadsHandle || p.threadsUrl, count: p.threadsFollowers },
    ];
    return rows
      .filter((r) => r.link || r.count)
      .map((r) => ({ ...r, label: PLATFORMS.find((x) => x.value === r.v)!.label, core: p.corePlatform === r.v }))
      .sort((a, b) => Number(b.core) - Number(a.core));
  });

  protected startEdit() {
    this.saved.set(false);
    this.error.set(null);
    this.formStep.set(1);
    this.editing.set(true);
  }

  protected async save(value: ProfileFormValue) {
    this.busy.set(true);
    this.error.set(null);
    try {
      const { consentEnroll, consentConfidentiality, ...body } = value;
      const updated = await this.api.updateProfile(body);
      this.store.summary.update((s) => (s ? { ...s, profile: updated } : s));
      this.editing.set(false);
      this.saved.set(true);
      window.scrollTo({ top: 0 });
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
