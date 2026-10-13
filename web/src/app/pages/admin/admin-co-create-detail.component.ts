import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { errorMessage } from '../../core/api.service';
import { CoCreateApi } from '../../core/co-create.api';
import { CoCreateDecision, CoCreateDetail, FLAG_META, STATUS_CLS, STATUS_LABEL } from '../../core/co-create.models';
import { ToastService } from '../../core/toast.service';
import { I } from '../../shared/icons';
import { SpinnerComponent } from '../../shared/ui.components';
import {
  ACCOUNT_TYPE_OPTIONS,
  CONTENT_TYPE_OPTIONS,
  COVER_OPTIONS,
  DURATION_OPTIONS,
  FEATURED_OPTIONS,
  LOCATION_OPTIONS,
  MILESTONE_OPTIONS,
  PLATFORM_OPTIONS,
  REVIEW_DAY_OPTIONS,
  SUPPORT_OPTIONS,
  YES_NO,
  displayDate,
  labelOf,
} from '../co-create/co-create.logic';
import { ModalComponent } from './admin-ui';
import { AdminStore } from './admin.store';

const DECISION_LABEL: Record<CoCreateDecision, string> = {
  approve: 'Approve',
  approve_with_changes: 'Approve with changes',
  decline: 'Decline',
};

@Component({
  selector: 'vcc-admin-co-create-detail',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, RouterLink, LucideAngularModule, ModalComponent, SpinnerComponent],
  template: `
    <a routerLink="/admin/co-create" class="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-vcc-navy">
      <lucide-icon [img]="I.ArrowLeft" [size]="16" /> All requests
    </a>

    @if (loading()) {
      <div class="mt-6 space-y-4">
        @for (n of [1, 2, 3]; track n) { <div class="h-28 animate-pulse rounded-xl bg-gray-100"></div> }
      </div>
    } @else if (error()) {
      <p class="card-light mt-6 p-8 text-center text-red-600">{{ error() }}
        <button class="btn-ghost ml-3" (click)="load()">Retry</button></p>
    } @else if (d()) {
      @let r = d()!;
      <div class="mt-3 flex flex-wrap items-center gap-3">
        <h1 class="text-4xl font-bold text-vcc-navy">{{ r.data.s1.title }}</h1>
        <span [class]="'rounded-full px-3 py-1 text-sm font-semibold ' + cls[r.status]">{{ label[r.status] }}</span>
      </div>
      <p class="mt-1 text-gray-600">by {{ r.creator.name }}@if (r.creator.email) { · {{ r.creator.email }} } · submitted {{ r.submittedAt | date: 'dd MMM yyyy, h:mm a' }}</p>

      @if (r.flags.length) {
        <div class="mt-5 space-y-2" role="region" aria-label="Review flags">
          @for (f of r.flags; track f) {
            <div [class]="'flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ' + (meta[f].severity === 'red' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900')">
              <lucide-icon [img]="I.AlertTriangle" [size]="18" class="mt-0.5 shrink-0" />
              <span><strong>{{ meta[f].title }}.</strong> {{ meta[f].text }}</span>
            </div>
          }
        </div>
      }

      <div class="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
        <div class="space-y-6">
          <section class="card-light p-6">
            <h2 class="mb-3 text-xl font-bold text-vcc-navy">1. Idea Brief</h2>
            <dl class="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div class="sm:col-span-2"><dt class="text-gray-500">Idea</dt><dd class="whitespace-pre-line">{{ r.data.s1.idea }}</dd></div>
              <div><dt class="text-gray-500">Vivo product</dt><dd>{{ r.data.s1.product }}</dd></div>
              <div><dt class="text-gray-500">Support type</dt><dd>{{ opt(support, r.data.s1.supportType) }}</dd></div>
              <div>
                <dt class="text-gray-500">Idea document</dt>
                <dd>
                  @if (r.files.ideaDoc; as f) { <button class="inline-flex items-center gap-1.5 text-vcc-blue hover:underline" (click)="openFile(f.id)">
                    <lucide-icon [img]="I.FileText" [size]="14" /> {{ f.name }} <lucide-icon [img]="I.ExternalLink" [size]="12" /></button> } @else { None }
                </dd>
              </div>
            </dl>
          </section>

          <section class="card-light p-6">
            <h2 class="mb-3 text-xl font-bold text-vcc-navy">2. Compensation</h2>
            <div class="space-y-5 text-sm">
              @if (r.data.s2?.a; as a) {
                <dl class="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  <h3 class="font-semibold text-vcc-blue sm:col-span-2">Cash fee</h3>
                  <div><dt class="text-gray-500">Total fee</dt><dd>₹{{ a.fee | number }}</dd></div>
                  <div><dt class="text-gray-500">Payment milestone</dt><dd>{{ opt(milestones, a.milestone) }}</dd></div>
                  <div class="sm:col-span-2"><dt class="text-gray-500">Covers</dt><dd>{{ list(covers, a.covers) }}@if (a.otherCosts) { — {{ a.otherCosts }} }</dd></div>
                  <div class="sm:col-span-2"><dt class="text-gray-500">Fee justification</dt><dd class="whitespace-pre-line">{{ a.why }}</dd></div>
                  <div><dt class="text-gray-500">GST registered</dt><dd>{{ opt(yesNo, a.gstRegistered) }}@if (a.gstNumber) { · {{ a.gstNumber }} }</dd></div>
                </dl>
              }
              @if (r.data.s2?.b; as b) {
                <dl class="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  <h3 class="font-semibold text-vcc-blue sm:col-span-2">Product borrow</h3>
                  <div><dt class="text-gray-500">Product</dt><dd>{{ b.product }}</dd></div>
                  <div><dt class="text-gray-500">Variant</dt><dd>{{ b.variant }}</dd></div>
                  <div><dt class="text-gray-500">Units</dt><dd>{{ b.units }}</dd></div>
                  <div><dt class="text-gray-500">Duration</dt><dd>{{ opt(durations, b.duration) }}</dd></div>
                  <div><dt class="text-gray-500">Location</dt><dd>{{ opt(locations, b.location) }}@if (b.locationDetails) { — {{ b.locationDetails }} }</dd></div>
                  <div><dt class="text-gray-500">Return commitment</dt><dd>{{ b.returnCommitment ? 'Confirmed' : 'Not confirmed' }}</dd></div>
                  <div class="sm:col-span-2"><dt class="text-gray-500">Why this variant</dt><dd class="whitespace-pre-line">{{ b.why }}</dd></div>
                </dl>
              }
              @if (r.data.s2?.c; as c) {
                <dl class="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  <h3 class="font-semibold text-vcc-blue sm:col-span-2">Product to keep</h3>
                  <div><dt class="text-gray-500">Product</dt><dd>{{ c.product }}</dd></div>
                  <div><dt class="text-gray-500">Variant</dt><dd>{{ c.variant }}</dd></div>
                  <div><dt class="text-gray-500">Units</dt><dd>{{ c.units }}</dd></div>
                  @if (c.unitsReason) { <div class="sm:col-span-2"><dt class="text-gray-500">Reason for multiple units</dt><dd class="whitespace-pre-line">{{ c.unitsReason }}</dd></div> }
                  <div class="sm:col-span-2"><dt class="text-gray-500">Why this variant</dt><dd class="whitespace-pre-line">{{ c.why }}</dd></div>
                </dl>
              }
            </div>
          </section>

          <section class="card-light p-6">
            <h2 class="mb-3 text-xl font-bold text-vcc-navy">3. Content Deliverables</h2>
            <dl class="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div class="sm:col-span-2"><dt class="text-gray-500">Content</dt>
                <dd>@for (t of countRows(); track t[0]) { <span class="mr-4 inline-block">{{ t[0] }}: <strong>{{ t[1] }}</strong></span> }
                  @if (r.data.s3.otherType) { <br />Other: {{ r.data.s3.otherType }} }</dd></div>
              <div><dt class="text-gray-500">Product featured</dt><dd>{{ opt(featured, r.data.s3.featured) }}</dd></div>
              <div><dt class="text-gray-500">Tagging Vivo / VCC</dt><dd>{{ opt(yesNo, r.data.s3.tag) }}@if (r.data.s3.noTagReason) { — {{ r.data.s3.noTagReason }} }</dd></div>
              <div class="sm:col-span-2"><dt class="text-gray-500">Concept</dt><dd class="whitespace-pre-line">{{ r.data.s3.concept }}</dd></div>
              <div><dt class="text-gray-500">Shoot date</dt><dd>{{ date(r.data.s3.shootDate) }}</dd></div>
              <div><dt class="text-gray-500">Posting date</dt><dd>{{ date(r.data.s3.postDate) }}</dd></div>
              <div class="sm:col-span-2"><dt class="text-gray-500">Review before posting</dt>
                <dd>{{ opt(yesNo, r.data.s3.reviewBefore) }}
                  @if (r.data.s3.reviewDays) { · {{ opt(reviewDays, r.data.s3.reviewDays) }} }
                  @if (r.data.s3.reviewBefore === 'no') { · {{ r.data.s3.reviewAck ? 'Acknowledged written approval requirement' : 'Not acknowledged' }} }</dd></div>
            </dl>
          </section>

          <section class="card-light p-6">
            <h2 class="mb-3 text-xl font-bold text-vcc-navy">4. Platform &amp; Audience</h2>
            <dl class="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div><dt class="text-gray-500">Primary platform</dt><dd>{{ opt(platforms, r.data.s4.platform) }}</dd></div>
              <div><dt class="text-gray-500">Estimated reach</dt><dd>{{ r.data.s4.reach | number }}</dd></div>
              <div class="sm:col-span-2"><dt class="text-gray-500">Competing brand deals</dt>
                <dd>{{ opt(yesNo, r.data.s4.competing) }}@if (r.data.s4.competingDetails) { — {{ r.data.s4.competingDetails }} }</dd></div>
            </dl>
          </section>

          @if (r.bank; as b) {
            <section class="card-light p-6">
              <h2 class="mb-3 text-xl font-bold text-vcc-navy">5. Payment Details</h2>
              <dl class="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <div><dt class="text-gray-500">Account holder</dt><dd>{{ b.holder }}</dd></div>
                <div><dt class="text-gray-500">Bank</dt><dd>{{ b.bankName }}</dd></div>
                <div><dt class="text-gray-500">Account number</dt>
                  <dd class="flex items-center gap-3">
                    <span class="font-mono">{{ revealed() ?? '•••• •••• ' + b.accountLast4 }}</span>
                    @if (canReveal()) {
                      @if (revealed()) { <span class="text-xs text-gray-500" aria-live="polite">hides in {{ countdown() }}s</span> }
                      @else { <button class="inline-flex items-center gap-1 text-xs text-vcc-blue hover:underline" (click)="revealOpen.set(true)"><lucide-icon [img]="I.Eye" [size]="14" /> Reveal</button> }
                    }
                  </dd></div>
                <div><dt class="text-gray-500">IFSC</dt><dd class="font-mono">{{ b.ifsc }}</dd></div>
                <div><dt class="text-gray-500">Account type</dt><dd>{{ opt(accountTypes, b.accountType) }}</dd></div>
                <div><dt class="text-gray-500">UPI</dt><dd>{{ b.upi || '—' }}</dd></div>
                <div>
                  <dt class="text-gray-500">GST proforma</dt>
                  <dd>@if (r.files.gstProforma; as f) { <button class="inline-flex items-center gap-1.5 text-vcc-blue hover:underline" (click)="openFile(f.id)">
                    <lucide-icon [img]="I.FileText" [size]="14" /> {{ f.name }} <lucide-icon [img]="I.ExternalLink" [size]="12" /></button> } @else { — }</dd>
                </div>
              </dl>
            </section>
          }
        </div>

        <aside class="space-y-6">
          <section class="card-light p-5">
            <h2 class="mb-3 text-lg font-bold text-vcc-navy">Decision</h2>
            @if (r.status !== 'sent_to_v_team') {
              <p class="text-sm text-gray-700">This request was <strong>{{ label[r.status] }}</strong>.@if (r.decisionNote) { <br /><span class="text-gray-600">“{{ r.decisionNote }}”</span> }</p>
            } @else if (!store.canWrite()) {
              <p class="text-sm text-gray-600">You have view-only access.</p>
            } @else {
              <label class="field-label-light" for="note">Note <span class="font-normal text-gray-500">(required for “Approve with changes”)</span></label>
              <textarea id="note" class="input min-h-[96px]" [(ngModel)]="note" maxlength="1000"></textarea>
              @if (noteError()) { <p class="mt-1 text-sm text-red-600" role="alert">{{ noteError() }}</p> }
              <div class="mt-3 flex flex-col gap-2">
                <button class="btn-primary justify-center" (click)="ask('approve')">Approve</button>
                <button class="btn-ghost justify-center" (click)="ask('approve_with_changes')">Approve with changes</button>
                <button class="btn-danger-outline justify-center" (click)="ask('decline')">Decline</button>
              </div>
            }
          </section>

          <section class="card-light p-5">
            <h2 class="mb-3 text-lg font-bold text-vcc-navy">Status history</h2>
            <ol class="space-y-3 border-l-2 border-gray-200 pl-4 text-sm">
              @for (h of r.history; track $index) {
                <li>
                  <p class="font-semibold">{{ label[h.status] }}</p>
                  <p class="text-xs text-gray-500">{{ h.at | date: 'dd MMM yyyy, h:mm a' }}@if (h.by) { · {{ h.by }} }</p>
                  @if (h.note) { <p class="mt-1 text-gray-700">{{ h.note }}</p> }
                </li>
              }
            </ol>
          </section>
        </aside>
      </div>

      @if (pending(); as p) {
        <vcc-modal [title]="decisionLabel[p]" (closed)="pending.set(null)">
          <p class="text-gray-700">{{ confirmText(p) }}</p>
          <div class="mt-5 flex justify-end gap-3">
            <button class="btn-ghost" (click)="pending.set(null)">Cancel</button>
            <button class="btn-primary" [disabled]="saving()" (click)="decide(p)">@if (saving()) { <vcc-spinner [size]="16" /> } Confirm</button>
          </div>
        </vcc-modal>
      }
      @if (revealOpen()) {
        <vcc-modal title="Reveal account number" (closed)="revealOpen.set(false)">
          <p class="text-gray-700">The full account number will be shown for 30 seconds. This action is logged. Continue?</p>
          <div class="mt-5 flex justify-end gap-3">
            <button class="btn-ghost" (click)="revealOpen.set(false)">Cancel</button>
            <button class="btn-primary" (click)="reveal()">Reveal</button>
          </div>
        </vcc-modal>
      }
    }
  `,
})
export class AdminCoCreateDetailComponent implements OnInit, OnDestroy {
  private api = inject(CoCreateApi);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  protected store = inject(AdminStore);
  protected readonly I = I;
  protected meta = FLAG_META;
  protected cls = STATUS_CLS;
  protected label = STATUS_LABEL;
  protected decisionLabel = DECISION_LABEL;
  protected support = SUPPORT_OPTIONS;
  protected milestones = MILESTONE_OPTIONS;
  protected covers = COVER_OPTIONS;
  protected yesNo = YES_NO;
  protected durations = DURATION_OPTIONS;
  protected locations = LOCATION_OPTIONS;
  protected featured = FEATURED_OPTIONS;
  protected reviewDays = REVIEW_DAY_OPTIONS;
  protected platforms = PLATFORM_OPTIONS;
  protected accountTypes = ACCOUNT_TYPE_OPTIONS;
  protected date = displayDate;
  protected opt = (o: { value: string | number; label: string }[], v: unknown) => labelOf(o, v);
  protected list = (o: { value: string; label: string }[], vs: string[] = []) => vs.map((v) => labelOf(o, v)).join(', ') || '—';

  protected d = signal<CoCreateDetail | null>(null);
  protected loading = signal(true);
  protected error = signal<string | null>(null);
  protected note = '';
  protected noteError = signal<string | null>(null);
  protected pending = signal<CoCreateDecision | null>(null);
  protected saving = signal(false);
  protected revealOpen = signal(false);
  protected revealed = signal<string | null>(null);
  protected countdown = signal(0);
  private revealTimer?: ReturnType<typeof setInterval>;
  private id = this.route.snapshot.paramMap.get('id')!;

  protected canReveal = computed(() => this.d()?.bank?.canReveal ?? this.store.isSuperAdmin());
  protected countRows = computed(() => {
    const counts = this.d()?.data.s3.counts ?? {};
    return Object.entries(counts).map(([k, v]) => [labelOf(CONTENT_TYPE_OPTIONS, k), v] as const);
  });

  ngOnInit() {
    this.load();
  }
  ngOnDestroy() {
    this.hide();
  }

  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.d.set(await this.api.adminGet(this.id));
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  async openFile(fileId: string) {
    const win = window.open('', '_blank');
    try {
      const { url } = await this.api.fileUrl(this.id, fileId);
      if (win) {
        win.opener = null;
        win.location.href = url;
      } else window.location.href = url;
    } catch (e) {
      win?.close();
      this.toast.error(errorMessage(e, 'Could not open the file.'));
    }
  }

  protected ask(decision: CoCreateDecision) {
    this.noteError.set(null);
    if (decision === 'approve_with_changes' && !this.note.trim()) {
      this.noteError.set('Please describe the changes required.');
      return;
    }
    this.pending.set(decision);
  }

  protected confirmText(d: CoCreateDecision) {
    const who = this.d()?.creator.name ?? 'the creator';
    return d === 'approve'
      ? `Approve this request from ${who}? They will be notified.`
      : d === 'decline'
        ? `Decline this request from ${who}? This cannot be undone.`
        : `Approve with the changes described in your note? ${who} will be notified.`;
  }

  async decide(decision: CoCreateDecision) {
    this.saving.set(true);
    try {
      await this.api.decide(this.id, decision, this.note.trim());
      this.pending.set(null);
      this.note = '';
      this.toast.success('Decision saved.');
      await this.load();
      this.api.summary().then((s) => this.store.coCreatePending.set(s.pending)).catch(() => undefined);
    } catch (e) {
      this.pending.set(null);
      this.toast.error(errorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  async reveal() {
    this.revealOpen.set(false);
    try {
      const { accountNumber } = await this.api.revealAccount(this.id);
      this.revealed.set(accountNumber);
      this.countdown.set(30);
      clearInterval(this.revealTimer);
      this.revealTimer = setInterval(() => {
        this.countdown.update((n) => n - 1);
        if (this.countdown() <= 0) this.hide();
      }, 1000);
    } catch (e) {
      this.toast.error(errorMessage(e, 'Could not reveal the account number.'));
    }
  }

  private hide() {
    clearInterval(this.revealTimer);
    this.revealed.set(null);
  }
}
