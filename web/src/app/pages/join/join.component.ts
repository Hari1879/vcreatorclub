import { Component, OnDestroy, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { LucideAngularModule } from 'lucide-angular';
import { ApiService, errorMessage } from '../../core/api.service';
import { DISCLAIMER, signInUrl, timeAgo } from '../../core/constants';
import { I } from '../../shared/icons';
import { SpinnerComponent, VccLogoComponent } from '../../shared/ui.components';
import {
  EMPTY_PROFILE,
  ProfileFormComponent,
  ProfileFormValue,
} from '../../shared/profile-form/profile-form.component';

type View = 'checking' | 'invalid' | 'expired' | 'no-profile' | 'form' | 'submitting' | 'success' | 'already' | 'error';

interface LocalDraft {
  draftId: string;
  step: number;
  formData: Partial<ProfileFormValue>;
  savedAt: string;
}

const LOCAL_DEBOUNCE_MS = 2_000; // layer 1
const SERVER_INTERVAL_MS = 30_000; // layer 2

@Component({
  selector: 'vcc-join',
  standalone: true,
  imports: [ProfileFormComponent, VccLogoComponent, SpinnerComponent, LucideAngularModule, RouterLink],
  template: `
    <div class="min-h-[100svh] bg-gradient-to-b from-vcc-navy-deep via-vcc-navy to-vcc-navy-deep text-white">
      @switch (view()) {
        @case ('checking') {
          <div class="grid min-h-[100svh] place-items-center"><vcc-spinner [size]="36" /></div>
        }
        @case ('submitting') {
          <div class="grid min-h-[100svh] place-items-center px-6 text-center">
            <div>
              <vcc-spinner [size]="40" />
              <p class="heading mt-4 text-xl">Submitting your enrollment…</p>
            </div>
          </div>
        }
        @case ('form') {
          <!-- Sticky top bar: back + auto-save indicator -->
          <div class="sticky top-0 z-20 bg-vcc-navy-deep/90 backdrop-blur">
            <div class="mx-auto flex max-w-md items-center justify-between px-4 py-3">
              <button type="button" (click)="form()?.back()" [disabled]="step() === 1" aria-label="Back"
                      class="grid h-11 w-11 place-items-center rounded-full bg-vcc-blue/20 text-vcc-blue-light transition disabled:opacity-0">
                <lucide-icon [img]="I.ChevronLeft" [size]="24" />
              </button>
              <p class="flex items-center gap-2 text-sm text-vcc-gray-light" aria-live="polite">
                <lucide-icon [img]="offline() ? I.CloudOff : I.Cloud" [size]="18" class="text-vcc-blue-light" />
                {{ saveLabel() }}
              </p>
              <span class="w-11"></span>
            </div>
          </div>

          <main class="mx-auto max-w-md px-5 pb-12">
            <div class="mb-6 mt-2 text-center">
              <vcc-logo [width]="260" class="mx-auto block w-fit" />
              <p class="heading mt-1 text-3xl font-bold tracking-[0.15em]">VCC</p>
              <h1 class="mt-3 text-4xl font-bold leading-none xs:text-5xl">
                Creator <span class="text-gradient-blue">Enrollment</span>
              </h1>
            </div>

            @if (submitError()) {
              <div class="mb-5 flex items-start gap-3 rounded-lg border border-vcc-danger/50 bg-vcc-danger/15 p-4 text-sm" role="alert">
                <lucide-icon [img]="I.AlertTriangle" [size]="18" class="mt-0.5 shrink-0 text-red-300" />
                <span>{{ submitError() }}</span>
              </div>
            }

            <vcc-profile-form
              mode="enroll"
              [initial]="initial()"
              [signedIn]="signedIn()"
              [(step)]="step"
              (changed)="onChanged($event.value, $event.step)"
              (completed)="onCompleted($event)" />
          </main>
        }
        @case ('success') {
          <div class="grid min-h-[100svh] place-items-center px-6 text-center">
            <div>
              <span class="mx-auto grid h-28 w-28 place-items-center rounded-full bg-vcc-blue shadow-[0_0_48px_rgba(30,136,229,0.6)]">
                <lucide-icon [img]="I.Check" [size]="64" [strokeWidth]="3" />
              </span>
              <h1 class="mt-8 text-4xl font-bold">Enrollment Submitted</h1>
              <p class="heading mt-3 text-2xl text-vcc-blue-light">Welcome to V Creater Club</p>
              <p class="mx-auto mt-4 max-w-xs text-vcc-gray-light">Your application is under review. Our team will be in touch.</p>
            </div>
          </div>
        }
        @default {
          <div class="grid min-h-[100svh] place-items-center px-6 text-center">
            <div class="max-w-sm">
              <vcc-logo [width]="220" class="mx-auto block w-fit" />
              <span class="mx-auto mt-8 grid h-16 w-16 place-items-center rounded-full"
                    [class]="view() === 'already' ? 'bg-vcc-blue/20 text-vcc-blue-light' : 'bg-vcc-danger/20 text-red-300'">
                <lucide-icon [img]="view() === 'already' ? I.CheckCircle2 : I.ShieldX" [size]="32" />
              </span>
              <p class="mt-6 text-lg leading-relaxed">{{ message() }}</p>
              @if (view() === 'already') {
                <a routerLink="/dashboard" class="btn-primary mt-8 px-8 py-3">Go to dashboard</a>
              } @else {
                <a routerLink="/" class="btn-ghost mt-8">Visit vcreatorclub.in</a>
              }
              <p class="mt-10 text-xs text-vcc-gray-light/70">{{ disclaimer }}</p>
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class JoinComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected readonly I = I;
  protected readonly disclaimer = DISCLAIMER;
  protected form = viewChild(ProfileFormComponent);

  protected view = signal<View>('checking');
  protected step = signal(1);
  protected initial = signal<Partial<ProfileFormValue> | null>(null);
  protected signedIn = signal(false);
  protected submitError = signal<string | null>(null);
  protected savedAt = signal<string | null>(null);
  protected offline = signal(!navigator.onLine);
  private now = signal(Date.now());
  private errorText = signal('');

  private token = '';
  private draftId = '';
  private latest: { value: ProfileFormValue; step: number } | null = null;
  private localTimer?: ReturnType<typeof setTimeout>;
  private serverTimer?: ReturnType<typeof setInterval>;
  private tickTimer?: ReturnType<typeof setInterval>;
  private serverDirty = false;
  private onlineHandler = () => this.offline.set(!navigator.onLine);

  protected saveLabel = computed(() => {
    this.now();
    const at = this.savedAt();
    if (!at) return this.offline() ? 'Offline · saving on this device' : 'Auto-save on';
    return `Draft saved · ${timeAgo(at)}`;
  });

  protected message = computed(() => {
    switch (this.view()) {
      case 'expired':
        return 'This enrollment link has expired. Please contact the VCC team.';
      case 'no-profile':
        return "We couldn't find a VCC enrollment for this Google account. Please use your personal QR code to enrol.";
      case 'already':
        return "You've already enrolled in VCC with this Google account.";
      case 'error':
        return this.errorText();
      default:
        return 'This link is not valid. Please use your personal QR code to access VCC enrollment.';
    }
  });

  private get localKey() {
    return `vcc_draft_${this.token}`;
  }
  private get pendingKey() {
    return `vcc_submit_${this.token}`;
  }

  async ngOnInit() {
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.onlineHandler);
    document.addEventListener('visibilitychange', this.hideHandler);
    window.addEventListener('pagehide', this.hideHandler);
    const q = this.route.snapshot.queryParamMap;
    this.token = (q.get('token') ?? '').trim();

    if (!this.token) {
      this.view.set(q.get('reason') === 'no-profile' ? 'no-profile' : 'invalid');
      return;
    }

    try {
      const [me, tok] = await Promise.all([this.api.me().catch(() => ({ signedIn: false }) as const), this.api.validateToken(this.token)]);
      this.signedIn.set(me.signedIn);
      if ('profile' in me && me.profile) {
        this.clearLocal();
        this.view.set('already');
        return;
      }
      if (tok.state === 'expired') return this.view.set('expired');
      if (tok.state !== 'valid') return this.view.set('invalid');
    } catch (e) {
      this.errorText.set(errorMessage(e));
      this.view.set('error');
      return;
    }

    await this.restoreDraft();

    // Returning from Google sign-in with a submission pending → submit now.
    if (this.signedIn() && q.get('submit') === '1' && this.readLocal(this.pendingKey) === '1' && this.initial()) {
      await this.submit(this.initial() as ProfileFormValue);
      return;
    }
    if (q.get('submit')) this.router.navigate([], { queryParams: { token: this.token }, replaceUrl: true });

    this.view.set('form');
    this.serverTimer = setInterval(() => this.flushServer(), SERVER_INTERVAL_MS);
    this.tickTimer = setInterval(() => this.now.set(Date.now()), 20_000);
  }

  ngOnDestroy() {
    clearTimeout(this.localTimer);
    clearInterval(this.serverTimer);
    clearInterval(this.tickTimer);
    window.removeEventListener('online', this.onlineHandler);
    window.removeEventListener('offline', this.onlineHandler);
    document.removeEventListener('visibilitychange', this.hideHandler);
    window.removeEventListener('pagehide', this.hideHandler);
  }

  // ---------------------------------------------------------------- drafts
  private readLocal(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  private writeLocal(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage full / private mode — server draft still works */
    }
  }
  private clearLocal() {
    try {
      localStorage.removeItem(this.localKey);
      localStorage.removeItem(this.pendingKey);
    } catch {
      /* ignore */
    }
  }

  /** Layer 3: restore from localStorage first, then the server draft if newer. */
  private async restoreDraft() {
    let local: LocalDraft | null = null;
    try {
      local = JSON.parse(this.readLocal(this.localKey) ?? 'null');
    } catch {
      local = null;
    }
    this.draftId = local?.draftId ?? crypto.randomUUID();
    let best = local ? { step: local.step, data: local.formData, savedAt: local.savedAt } : null;

    try {
      const server = await this.api.getDraft(this.draftId, this.token);
      if (!best || new Date(server.savedAt) > new Date(best.savedAt)) {
        best = { step: server.step, data: { ...best?.data, ...server.data }, savedAt: server.savedAt };
      }
    } catch {
      /* no server draft yet */
    }

    if (best) {
      this.initial.set({ ...EMPTY_PROFILE, ...best.data });
      this.step.set(Math.min(3, Math.max(1, best.step || 1)));
      this.savedAt.set(best.savedAt);
    }
  }

  protected onChanged(value: ProfileFormValue, step: number) {
    const stepChanged = this.latest !== null && this.latest.step !== step;
    this.latest = { value, step };
    this.serverDirty = true;
    clearTimeout(this.localTimer);
    // Step changes save at once; typing is debounced.
    if (stepChanged) this.flushLocal();
    else this.localTimer = setTimeout(() => this.flushLocal(), LOCAL_DEBOUNCE_MS);
  }

  /** Phone locked / tab closed / app switched: save immediately. */
  private hideHandler = () => {
    if (document.visibilityState === 'hidden' || !document.visibilityState) {
      clearTimeout(this.localTimer);
      this.flushLocal();
    }
  };

  /** Layer 1: localStorage, debounced 2s. */
  private flushLocal() {
    if (!this.latest) return;
    const savedAt = new Date().toISOString();
    const draft: LocalDraft = { draftId: this.draftId, step: this.latest.step, formData: this.latest.value, savedAt };
    this.writeLocal(this.localKey, JSON.stringify(draft));
    this.savedAt.set(savedAt);
  }

  /** Layer 2: server draft every 30s when something changed and we're online. */
  private async flushServer() {
    if (!this.serverDirty || !this.latest || !navigator.onLine) return;
    this.serverDirty = false;
    try {
      const { consentEnroll, consentConfidentiality, ...data } = this.latest.value;
      const res = await this.api.saveDraft({ draftId: this.draftId, token: this.token, step: this.latest.step, data });
      this.savedAt.set(res.savedAt);
    } catch {
      this.serverDirty = true; // retry next tick
    }
  }

  // ---------------------------------------------------------------- submit
  protected async onCompleted(value: ProfileFormValue) {
    this.latest = { value, step: 3 };
    this.flushLocal();
    this.submitError.set(null);
    if (!this.signedIn()) {
      // Save, sign in with Google, then come back here and submit automatically.
      this.writeLocal(this.pendingKey, '1');
      await this.flushServer();
      window.location.href = signInUrl(`/join?token=${encodeURIComponent(this.token)}&submit=1`);
      return;
    }
    await this.submit(value);
  }

  private async submit(value: ProfileFormValue) {
    this.view.set('submitting');
    try {
      await this.api.submitEnrollment({ ...value, token: this.token, draftId: this.draftId });
      this.clearLocal();
      clearInterval(this.serverTimer);
      this.router.navigate([], { queryParams: {}, replaceUrl: true });
      this.view.set('success');
    } catch (e) {
      try {
        localStorage.removeItem(this.pendingKey);
      } catch {
        /* ignore */
      }
      const status = e instanceof HttpErrorResponse ? e.status : 0;
      if (status === 409) {
        this.clearLocal();
        this.view.set('already');
      } else if (status === 410) {
        this.view.set('expired');
      } else {
        this.submitError.set(errorMessage(e));
        this.initial.set(value);
        this.step.set(3);
        this.view.set('form');
        if (!this.serverTimer) this.serverTimer = setInterval(() => this.flushServer(), SERVER_INTERVAL_MS);
      }
    }
  }
}
