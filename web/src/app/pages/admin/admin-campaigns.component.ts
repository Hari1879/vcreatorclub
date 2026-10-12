import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ApiService, errorMessage } from '../../core/api.service';
import { CAMPAIGN_TIER_OPTIONS, TIER_META } from '../../core/constants';
import { AssignmentStatus, Campaign, CampaignDetail, CampaignStatus, CampaignType, Tier } from '../../core/models';
import { I } from '../../shared/icons';
import { SpinnerComponent, TierBadgeComponent } from '../../shared/ui.components';
import { ModalComponent } from './admin-ui';
import { AdminStore } from './admin.store';

const STATUS_CLS: Record<CampaignStatus, string> = {
  draft: 'bg-slate-200 text-slate-700',
  open: 'bg-green-100 text-green-800',
  closed: 'bg-amber-100 text-amber-800',
  completed: 'bg-blue-100 text-blue-800',
};

interface Draft {
  title: string;
  product: string;
  description: string;
  campaignType: CampaignType;
  budgetInr: number | null;
  deliverables: string[];
  deadline: string; // yyyy-mm-dd
  eligibleTiers: Tier[];
  maxCreators: number | null;
}

const emptyDraft = (): Draft => ({
  title: '',
  product: '',
  description: '',
  campaignType: 'paid',
  budgetInr: null,
  deliverables: [],
  deadline: '',
  eligibleTiers: ['core_creator', 'campaign_creator', 'vcc_community'],
  maxCreators: null,
});

@Component({
  selector: 'vcc-admin-campaigns',
  standalone: true,
  imports: [DatePipe, DecimalPipe, NgClass, FormsModule, LucideAngularModule, ModalComponent, SpinnerComponent, TierBadgeComponent],
  template: `
    <div class="flex items-center justify-between">
      <h1 class="text-5xl font-bold text-vcc-navy">Campaigns</h1>
      @if (store.canWrite()) {
        <button class="btn-primary px-6 py-3 text-lg" (click)="openNew()"><lucide-icon [img]="I.Plus" [size]="20" /> New campaign</button>
      }
    </div>
    @if (error()) { <p class="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{{ error() }}</p> }

    @if (loading()) {
      <div class="grid place-items-center py-20 text-vcc-blue"><vcc-spinner [size]="30" /></div>
    } @else {
      <div class="mt-7 grid gap-4 xl:grid-cols-2">
        @for (c of campaigns(); track c.id) {
          <article class="card-light flex flex-col p-5">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-xs uppercase tracking-wider text-gray-500">{{ c.product }}</p>
                <h2 class="truncate text-2xl font-bold text-vcc-navy">{{ c.title }}</h2>
              </div>
              <span class="pill capitalize" [ngClass]="statusCls(c.status)">{{ c.status }}</span>
            </div>
            <div class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-600">
              <span class="capitalize">{{ c.campaignType }}@if (c.campaignType === 'paid' && c.budgetInr) { · ₹{{ c.budgetInr | number }} }</span>
              <span>{{ c.deliverables.length }} deliverable{{ c.deliverables.length === 1 ? '' : 's' }}</span>
              <span>Deadline: {{ c.deadline ? (c.deadline | date: 'd MMM y') : '—' }}</span>
              <span>{{ c.assignmentCount }}@if (c.maxCreators) {/{{ c.maxCreators }}} creators</span>
            </div>
            <div class="mt-3 flex flex-wrap gap-1.5">
              @for (t of c.eligibleTiers; track t) { <vcc-tier-badge [tier]="t" [light]="true" /> }
            </div>
            <div class="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
              <button class="btn-ghost btn-sm" (click)="openDetail(c.id)">Creators</button>
              @if (store.canWrite()) {
                <button class="btn-ghost btn-sm" (click)="openEdit(c)"><lucide-icon [img]="I.Pencil" [size]="14" /> Edit</button>
                @if (c.status === 'draft' || c.status === 'closed') {
                  <button class="btn-primary btn-sm" [disabled]="busy()" (click)="setStatus(c, 'open')">{{ c.status === 'draft' ? 'Publish' : 'Reopen' }}</button>
                }
                @if (c.status === 'open') { <button class="btn btn-sm border border-amber-500 text-amber-700 hover:bg-amber-50" [disabled]="busy()" (click)="setStatus(c, 'closed')">Close</button> }
                @if (c.status === 'closed') { <button class="btn btn-sm border border-blue-500 text-blue-700 hover:bg-blue-50" [disabled]="busy()" (click)="setStatus(c, 'completed')">Mark completed</button> }
                <button class="btn-danger-outline btn-sm ml-auto" [disabled]="busy()" (click)="deleteTarget.set(c)"><lucide-icon [img]="I.Trash2" [size]="14" /> Delete</button>
              }
            </div>
          </article>
        } @empty {
          <p class="card-light col-span-full p-10 text-center text-gray-500">No campaigns yet.</p>
        }
      </div>
    }

    <!-- Create / edit modal -->
    @if (formOpen()) {
      <vcc-modal [title]="editingId() ? 'Edit campaign' : 'New campaign'" [width]="640" (closed)="formOpen.set(false)">
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <label class="col-span-2"><span class="field-label-light">Title *</span><input class="input" [(ngModel)]="d.title" maxlength="150" /></label>
            <label><span class="field-label-light">Product *</span><input class="input" [(ngModel)]="d.product" maxlength="150" placeholder="e.g. Vivo V-series" /></label>
            <label><span class="field-label-light">Type</span>
              <select class="input" [(ngModel)]="d.campaignType"><option value="paid">Paid</option><option value="free">Free</option><option value="gifted">Gifted</option></select>
            </label>
            @if (d.campaignType === 'paid') {
              <label><span class="field-label-light">Budget (₹)</span><input class="input" type="number" min="0" [(ngModel)]="d.budgetInr" /></label>
            }
            <label><span class="field-label-light">Deadline</span><input class="input" type="date" [(ngModel)]="d.deadline" /></label>
            <label><span class="field-label-light">Max creators</span><input class="input" type="number" min="1" [(ngModel)]="d.maxCreators" placeholder="No limit" /></label>
          </div>
          <label class="block"><span class="field-label-light">Description</span>
            <textarea class="input" rows="4" maxlength="5000" [(ngModel)]="d.description" placeholder="Brief, key messages, dos and don'ts"></textarea>
          </label>
          <div>
            <span class="field-label-light">Deliverables</span>
            <div class="flex flex-wrap gap-2 rounded-lg border border-gray-300 p-2 focus-within:ring-2 focus-within:ring-vcc-blue">
              @for (x of d.deliverables; track $index) {
                <span class="pill bg-blue-50 text-blue-800">{{ x }}
                  <button type="button" (click)="d.deliverables.splice($index, 1)" aria-label="Remove"><lucide-icon [img]="I.X" [size]="12" /></button>
                </span>
              }
              <input class="min-w-40 flex-1 px-2 py-1 outline-none" [(ngModel)]="tagInput" (keydown.enter)="addTag($event)" (blur)="addTag()" placeholder="Type and press Enter" />
            </div>
          </div>
          <fieldset>
            <legend class="field-label-light">Eligible tiers</legend>
            <div class="flex flex-wrap gap-4">
              @for (t of tierOptions; track t) {
                <label class="flex items-center gap-2"><input type="checkbox" class="h-4 w-4 accent-vcc-blue" [checked]="d.eligibleTiers.includes(t)" (change)="toggleTier(t)" /> {{ tierLabel(t) }}</label>
              }
            </div>
          </fieldset>
          @if (formError()) { <p class="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{{ formError() }}</p> }
          <div class="flex justify-end gap-3 border-t border-gray-100 pt-4">
            @if (!editingId() || editingStatus() === 'draft') {
              <button class="btn border border-gray-300 text-gray-700 hover:bg-gray-50" [disabled]="busy()" (click)="save('draft')">Save as draft</button>
              <button class="btn-primary" [disabled]="busy()" (click)="save('open')">Publish</button>
            } @else {
              <button class="btn-primary" [disabled]="busy()" (click)="save()">Save changes</button>
            }
          </div>
        </div>
      </vcc-modal>
    }

    <!-- Delete confirm -->
    @if (deleteTarget(); as c) {
      <vcc-modal title="Delete campaign" (closed)="deleteTarget.set(null)">
        <p class="text-gray-700">Delete <strong>{{ c.title }}</strong> and all its creator assignments? This can't be undone.</p>
        <div class="mt-5 flex justify-end gap-3">
          <button class="btn-ghost" (click)="deleteTarget.set(null)">Cancel</button>
          <button class="btn bg-vcc-danger text-white hover:bg-red-700" [disabled]="busy()" (click)="remove(c)">Delete</button>
        </div>
      </vcc-modal>
    }

    <!-- Assigned creators -->
    @if (detailOpen()) {
      <vcc-modal [title]="detail()?.title ?? 'Campaign'" [width]="760" (closed)="detailOpen.set(false)">
        @if (!detail()) {
          <div class="grid place-items-center py-10 text-vcc-blue"><vcc-spinner [size]="26" /></div>
        } @else {
          <table class="w-full text-left text-sm">
            <thead class="heading text-xs text-gray-500"><tr><th class="py-2">Creator</th><th>City</th><th>Tier</th><th>Since</th><th>Status</th></tr></thead>
            <tbody>
              @for (a of detail()!.assignments; track a.id) {
                <tr class="border-t border-gray-100">
                  <td class="py-2.5"><span class="font-semibold">{{ a.fullName }}</span><span class="block text-xs text-gray-500">{{ a.instagramHandle }}</span><span class="block text-xs text-gray-500">+91 {{ a.phone }}</span></td>
                  <td>{{ a.city }}</td>
                  <td><vcc-tier-badge [tier]="a.tier" [light]="true" /></td>
                  <td class="text-gray-500">{{ a.createdAt | date: 'd MMM' }}</td>
                  <td>
                    @if (store.canWrite()) {
                      <select class="rounded-lg border border-gray-300 px-2 py-1.5" [ngModel]="a.status" (ngModelChange)="setAssignment(a.id, $event)">
                        @for (s of assignmentStatuses; track s) { <option [value]="s">{{ s }}</option> }
                      </select>
                    } @else { <span class="capitalize">{{ a.status }}</span> }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="py-8 text-center text-gray-500">No creators have shown interest yet.</td></tr>
              }
            </tbody>
          </table>
          <p class="mt-3 text-xs text-gray-500">Changing to accepted, declined, completed or cancelled sends the creator a notification.</p>
        }
      </vcc-modal>
    }
  `,
})
export class AdminCampaignsComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  protected store = inject(AdminStore);
  protected readonly I = I;
  protected readonly tierOptions = CAMPAIGN_TIER_OPTIONS;
  protected readonly assignmentStatuses: AssignmentStatus[] = ['invited', 'accepted', 'declined', 'submitted', 'completed', 'cancelled'];
  protected tierLabel = (t: Tier) => TIER_META[t].label;
  protected statusCls = (s: CampaignStatus) => STATUS_CLS[s];

  protected campaigns = signal<Campaign[]>([]);
  protected loading = signal(true);
  protected busy = signal(false);
  protected error = signal<string | null>(null);

  protected formOpen = signal(false);
  protected editingId = signal<string | null>(null);
  protected editingStatus = signal<CampaignStatus>('draft');
  protected formError = signal<string | null>(null);
  protected d: Draft = emptyDraft();
  protected tagInput = '';

  protected deleteTarget = signal<Campaign | null>(null);
  protected detailOpen = signal(false);
  protected detail = signal<CampaignDetail | null>(null);

  async ngOnInit() {
    await this.load();
    if (this.route.snapshot.queryParamMap.get('new') && this.store.canWrite()) this.openNew();
  }

  private async load() {
    try {
      this.campaigns.set(await this.api.campaigns());
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected openNew() {
    this.d = emptyDraft();
    this.editingId.set(null);
    this.editingStatus.set('draft');
    this.formError.set(null);
    this.formOpen.set(true);
  }

  protected openEdit(c: Campaign) {
    this.d = {
      title: c.title,
      product: c.product ?? '',
      description: c.description ?? '',
      campaignType: c.campaignType,
      budgetInr: c.budgetInr,
      deliverables: [...c.deliverables],
      deadline: c.deadline ? toLocalDate(c.deadline) : '',
      eligibleTiers: [...c.eligibleTiers],
      maxCreators: c.maxCreators,
    };
    this.editingId.set(c.id);
    this.editingStatus.set(c.status);
    this.formError.set(null);
    this.formOpen.set(true);
  }

  protected addTag(ev?: Event) {
    ev?.preventDefault();
    const v = this.tagInput.trim();
    if (v && this.d.deliverables.length < 30) this.d.deliverables.push(v.slice(0, 200));
    this.tagInput = '';
  }

  protected toggleTier(t: Tier) {
    const has = this.d.eligibleTiers.includes(t);
    this.d.eligibleTiers = has ? this.d.eligibleTiers.filter((x) => x !== t) : [...this.d.eligibleTiers, t];
  }

  protected async save(status?: 'draft' | 'open') {
    this.addTag();
    if (this.d.title.trim().length < 2) return this.formError.set('Add a title.');
    if (!this.d.product.trim()) return this.formError.set('Add the product.');
    if (!this.d.eligibleTiers.length) return this.formError.set('Choose at least one eligible tier.');
    const body = {
      title: this.d.title.trim(),
      product: this.d.product.trim(),
      description: this.d.description.trim() || null,
      campaignType: this.d.campaignType,
      budgetInr: this.d.campaignType === 'paid' && this.d.budgetInr !== null && `${this.d.budgetInr}` !== '' ? Number(this.d.budgetInr) : null,
      deliverables: this.d.deliverables,
      // Deadline = end of the chosen day, India time.
      deadline: this.d.deadline ? new Date(`${this.d.deadline}T23:59:00+05:30`).toISOString() : null,
      eligibleTiers: this.d.eligibleTiers,
      maxCreators: this.d.maxCreators ? Number(this.d.maxCreators) : null,
      ...(status ? { status } : {}),
    };
    this.busy.set(true);
    this.formError.set(null);
    try {
      const id = this.editingId();
      if (id) await this.api.updateCampaign(id, body);
      else await this.api.createCampaign(body);
      this.formOpen.set(false);
      await this.load();
    } catch (e) {
      this.formError.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async setStatus(c: Campaign, status: CampaignStatus) {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.api.campaignStatus(c.id, status);
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(c: Campaign) {
    this.busy.set(true);
    try {
      await this.api.deleteCampaign(c.id);
      this.deleteTarget.set(null);
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
      this.deleteTarget.set(null);
    } finally {
      this.busy.set(false);
    }
  }

  protected async openDetail(id: string) {
    this.detail.set(null);
    this.detailOpen.set(true);
    try {
      this.detail.set(await this.api.campaign(id));
    } catch (e) {
      this.error.set(errorMessage(e));
      this.detailOpen.set(false);
    }
  }

  protected async setAssignment(id: string, status: string) {
    try {
      await this.api.updateAssignment(id, { status });
      this.detail.update((d) =>
        d ? { ...d, assignments: d.assignments.map((a) => (a.id === id ? { ...a, status: status as AssignmentStatus } : a)) } : d,
      );
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}

/** ISO timestamp → yyyy-mm-dd in India time. */
function toLocalDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}
