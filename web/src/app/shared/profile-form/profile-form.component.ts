import { Component, OnInit, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { I } from '../icons';
import { SpinnerComponent } from '../ui.components';
import {
  CONTENT_CATEGORIES,
  CONTENT_LANGUAGES,
  CONTENT_TYPES,
  DISCLAIMER,
  PLATFORMS,
} from '../../core/constants';
import { ApiService } from '../../core/api.service';
import { Platform, ProfileForm } from '../../core/models';

export interface ProfileFormValue extends ProfileForm {
  consentEnroll: boolean;
  consentConfidentiality: boolean;
}

export const EMPTY_PROFILE: ProfileFormValue = {
  fullName: '',
  email: '',
  phone: '',
  city: '',
  coordinationMode: 'direct',
  managerName: null,
  managerContact: null,
  corePlatform: '',
  instagramHandle: null,
  instagramUrl: null,
  instagramFollowers: null,
  youtubeHandle: null,
  youtubeUrl: null,
  youtubeSubscribers: null,
  facebookUrl: null,
  facebookFollowers: null,
  linkedinUrl: null,
  linkedinFollowers: null,
  threadsHandle: null,
  threadsUrl: null,
  threadsFollowers: null,
  otherPlatforms: null,
  contentCategory: '',
  contentLanguages: [],
  contentTypes: [],
  bio: null,
  rateStory: null,
  ratePost: null,
  rateReel: null,
  rateTvc: null,
  workedWithVivo: false,
  vivoWorkDetails: null,
  consentEnroll: false,
  consentConfidentiality: false,
};

type Errors = Partial<Record<keyof ProfileFormValue | 'platforms', string>>;

@Component({
  selector: 'vcc-profile-form',
  standalone: true,
  imports: [ReactiveFormsModule, NgClass, LucideAngularModule, SpinnerComponent],
  templateUrl: './profile-form.component.html',
})
export class ProfileFormComponent implements OnInit {
  private fb = inject(FormBuilder).nonNullable;
  private api = inject(ApiService);
  private ytRequest = 0;
  protected ytStatus = signal<'idle' | 'loading' | 'hidden' | 'failed'>('idle');

  /** 'enroll' shows consents + Google sign-in button; 'edit' saves profile. */
  mode = input<'enroll' | 'edit'>('enroll');
  initial = input<Partial<ProfileFormValue> | null>(null);
  signedIn = input(false);
  enrollmentToken = input<string | undefined>(undefined);
  busy = input(false);
  step = model(1);

  changed = output<{ value: ProfileFormValue; step: number }>();
  completed = output<ProfileFormValue>();

  protected readonly I = I;
  protected readonly PLATFORMS = PLATFORMS;
  protected readonly CATEGORIES = CONTENT_CATEGORIES;
  protected readonly LANGUAGES = CONTENT_LANGUAGES;
  protected readonly TYPES = CONTENT_TYPES;
  protected readonly DISCLAIMER = DISCLAIMER;
  protected readonly steps = [1, 2, 3];

  protected form = this.fb.group({
    fullName: '',
    email: '',
    phone: '',
    city: '',
    coordinationMode: 'direct' as 'direct' | 'manager',
    managerName: null as string | null,
    managerContact: null as string | null,
    corePlatform: '' as Platform | '',
    instagramHandle: null as string | null,
    instagramUrl: null as string | null,
    instagramFollowers: null as number | null,
    youtubeHandle: null as string | null,
    youtubeUrl: null as string | null,
    youtubeSubscribers: null as number | null,
    facebookUrl: null as string | null,
    facebookFollowers: null as number | null,
    linkedinUrl: null as string | null,
    linkedinFollowers: null as number | null,
    threadsHandle: null as string | null,
    threadsUrl: null as string | null,
    threadsFollowers: null as number | null,
    otherPlatforms: null as string | null,
    contentCategory: '',
    contentLanguages: [[] as string[]],
    contentTypes: [[] as string[]],
    bio: null as string | null,
    rateStory: null as number | null,
    ratePost: null as number | null,
    rateReel: null as number | null,
    rateTvc: null as number | null,
    workedWithVivo: false,
    vivoWorkDetails: null as string | null,
    consentEnroll: false,
    consentConfidentiality: false,
  });

  /** Platforms the creator says they're on (UI only; derived from data on load). */
  protected active = signal<Set<Platform>>(new Set());
  protected errors = signal<Errors>({});
  protected v = signal<ProfileFormValue>({ ...EMPTY_PROFILE });
  protected bioLength = computed(() => (this.v().bio ?? '').length);

  constructor() {
    this.form.controls.youtubeUrl.valueChanges
      .pipe(debounceTime(600), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((url) => this.fetchYoutubeCount(url));
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      const value = this.value();
      this.v.set(value);
      if (Object.keys(this.errors()).length) this.errors.set(this.validate(this.step(), false));
      this.changed.emit({ value, step: this.step() });
    });
    let first = true;
    effect(() => {
      const s = this.step();
      if (first) {
        first = false;
        return;
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.changed.emit({ value: this.value(), step: s });
    });
  }

  ngOnInit() {
    const init = this.initial();
    if (init) this.patch(init);
    this.v.set(this.value());
  }

  private async fetchYoutubeCount(url: string | null) {
    const id = ++this.ytRequest;
    const u = (url ?? '').trim();
    if (!/^https:\/\/(www\.|m\.)?youtube\.com\/(@|channel\/)/i.test(u)) {
      this.ytStatus.set('idle');
      return;
    }
    this.ytStatus.set('loading');
    try {
      const r = await this.api.followerCount('youtube', u, this.enrollmentToken());
      if (id !== this.ytRequest) return;
      if (r.count === null) {
        this.ytStatus.set(r.hidden ? 'hidden' : 'failed');
        return;
      }
      this.form.patchValue({ youtubeSubscribers: r.count });
      this.ytStatus.set('idle');
    } catch {
      if (id === this.ytRequest) this.ytStatus.set('failed');
    }
  }

  patch(init: Partial<ProfileFormValue>) {
    const clean = Object.fromEntries(
      Object.entries(init).filter(([k]) => k in this.form.controls),
    ) as Partial<ProfileFormValue>;
    this.form.patchValue(clean as any, { emitEvent: false });
    const set = new Set<Platform>();
    const f = this.form.getRawValue();
    if (f.instagramHandle || f.instagramUrl || f.instagramFollowers) set.add('instagram');
    if (f.youtubeHandle || f.youtubeUrl || f.youtubeSubscribers) set.add('youtube');
    if (f.facebookUrl || f.facebookFollowers) set.add('facebook');
    if (f.linkedinUrl || f.linkedinFollowers) set.add('linkedin');
    if (f.threadsHandle || f.threadsUrl || f.threadsFollowers) set.add('threads');
    if (f.corePlatform) set.add(f.corePlatform as Platform);
    this.active.set(set);
    this.v.set(this.value());
  }

  value(): ProfileFormValue {
    return this.form.getRawValue() as ProfileFormValue;
  }

  // ------------------------------------------------------------ helpers
  protected err(key: keyof Errors) {
    return this.errors()[key];
  }

  protected toggleIn(ctrl: 'contentLanguages' | 'contentTypes', item: string) {
    const c = this.form.controls[ctrl];
    const cur = c.value;
    c.setValue(cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item]);
  }

  protected togglePlatform(p: Platform) {
    const set = new Set(this.active());
    if (set.has(p)) {
      if (this.form.controls.corePlatform.value === p) return; // core platform stays on
      set.delete(p);
    } else set.add(p);
    this.active.set(set);
  }

  protected setCore(p: Platform) {
    this.form.controls.corePlatform.setValue(p);
    this.active.set(new Set(this.active()).add(p));
  }

  protected digitsOnly(ctrl: 'phone', max = 10) {
    const c = this.form.controls[ctrl];
    const d = (c.value ?? '').replace(/\D/g, '').slice(0, max);
    if (d !== c.value) c.setValue(d);
  }

  protected prefixAt(ctrl: 'instagramHandle' | 'threadsHandle' | 'youtubeHandle') {
    const c = this.form.controls[ctrl];
    const raw = (c.value ?? '').trim().replace(/^https?:\/\/(www\.)?(instagram|threads)\.(com|net)\//i, '').replace(/\/$/, '');
    if (raw && !raw.startsWith('@')) c.setValue(`@${raw}`);
    else if (raw !== c.value) c.setValue(raw || null);
  }

  // --------------------------------------------------------- validation
  private validate(step: number, includeLater = true): Errors {
    const f = this.value();
    const e: Errors = {};
    const s = (x: string | null | undefined) => (x ?? '').trim();
    if (step >= 1 || includeLater) {
      if (s(f.fullName).length < 2 || s(f.fullName).length > 100) e.fullName = 'Enter your full name (2–100 characters).';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s(f.email))) e.email = 'Enter a valid email address.';
      if (!/^[6-9]\d{9}$/.test(s(f.phone))) e.phone = 'Enter a valid 10-digit Indian mobile number.';
      if (s(f.city).length < 2) e.city = 'Enter your city.';
      if (f.coordinationMode === 'manager') {
        if (s(f.managerName).length < 2) e.managerName = "Enter your manager's name.";
        if (s(f.managerContact).length < 5) e.managerContact = "Enter your manager's phone or email.";
      }
    }
    if (step >= 2) {
      if (!f.corePlatform) e.corePlatform = 'Choose your core platform.';
      else {
        const p = f.corePlatform;
        const link = {
          instagram: f.instagramHandle || f.instagramUrl,
          youtube: f.youtubeHandle || f.youtubeUrl,
          facebook: f.facebookUrl,
          linkedin: f.linkedinUrl,
          threads: f.threadsHandle || f.threadsUrl,
        }[p];
        const count = {
          instagram: f.instagramFollowers,
          youtube: f.youtubeSubscribers,
          facebook: f.facebookFollowers,
          linkedin: f.linkedinFollowers,
          threads: f.threadsFollowers,
        }[p];
        const label = PLATFORMS.find((x) => x.value === p)!.label;
        if (!s(link)) e.platforms = `Add your ${label} handle or profile link — it's your core platform.`;
        else if (!count || count < 1) e.platforms = `Add your ${label} follower count.`;
      }
      if (!f.contentCategory) e.contentCategory = 'Choose your main content category.';
      if (!f.contentLanguages.length) e.contentLanguages = 'Choose at least one content language.';
    }
    if (step >= 3) {
      if ((f.bio ?? '').length > 300) e.bio = 'Keep this under 300 characters.';
      if (this.mode() === 'enroll') {
        if (!f.consentEnroll) e.consentEnroll = 'Please tick this box to continue.';
        if (!f.consentConfidentiality) e.consentConfidentiality = 'Please tick this box to continue.';
      }
    }
    // When re-validating live, only show errors for the current step.
    if (!includeLater) {
      const keep: Record<number, (keyof Errors)[]> = {
        1: ['fullName', 'email', 'phone', 'city', 'managerName', 'managerContact'],
        2: ['corePlatform', 'platforms', 'contentCategory', 'contentLanguages'],
        3: ['bio', 'consentEnroll', 'consentConfidentiality'],
      };
      return Object.fromEntries(Object.entries(e).filter(([k]) => keep[step].includes(k as keyof Errors))) as Errors;
    }
    return e;
  }

  protected next() {
    const e = this.validate(this.step(), false);
    this.errors.set(e);
    if (Object.keys(e).length) {
      setTimeout(() => document.querySelector('[data-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      return;
    }
    if (this.step() < 3) this.step.set(this.step() + 1);
    else {
      const all = this.validate(3, true);
      if (Object.keys(all).length) {
        this.errors.set(all);
        const first = Object.keys(all)[0];
        const s1 = ['fullName', 'email', 'phone', 'city', 'managerName', 'managerContact'];
        this.step.set(s1.includes(first) ? 1 : ['bio', 'consentEnroll', 'consentConfidentiality'].includes(first) ? 3 : 2);
        return;
      }
      this.completed.emit(this.cleaned());
    }
  }

  back() {
    if (this.step() > 1) {
      this.errors.set({});
      this.step.set(this.step() - 1);
    }
  }

  /** Drop data for platforms the creator switched off. */
  private cleaned(): ProfileFormValue {
    const f = { ...this.value() };
    const a = this.active();
    if (!a.has('instagram')) Object.assign(f, { instagramHandle: null, instagramUrl: null, instagramFollowers: null });
    if (!a.has('youtube')) Object.assign(f, { youtubeHandle: null, youtubeUrl: null, youtubeSubscribers: null });
    if (!a.has('facebook')) Object.assign(f, { facebookUrl: null, facebookFollowers: null });
    if (!a.has('linkedin')) Object.assign(f, { linkedinUrl: null, linkedinFollowers: null });
    if (!a.has('threads')) Object.assign(f, { threadsHandle: null, threadsUrl: null, threadsFollowers: null });
    if (f.coordinationMode === 'direct') Object.assign(f, { managerName: null, managerContact: null });
    if (!f.workedWithVivo) f.vivoWorkDetails = null;
    return f;
  }
}
