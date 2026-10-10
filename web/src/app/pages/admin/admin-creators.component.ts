import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ApiService, errorMessage } from '../../core/api.service';
import { ALL_TIERS, PLATFORMS, TIER_META, formatCount } from '../../core/constants';
import { CreatorDetail, Paged, Profile, ProfileStatus, Tier } from '../../core/models';
import { I } from '../../shared/icons';
import { SpinnerComponent, StatusPillComponent, TierBadgeComponent } from '../../shared/ui.components';
import { KpiComponent, ModalComponent } from './admin-ui';
import { AdminStore } from './admin.store';
import { coreFollowers } from './admin-dashboard.component';

@Component({
  selector: 'vcc-admin-creators',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    TitleCasePipe,
    FormsModule,
    LucideAngularModule,
    KpiComponent,
    ModalComponent,
    StatusPillComponent,
    TierBadgeComponent,
    SpinnerComponent,
  ],
  template: `
    <div class="flex items-center justify-between">
      <h1 class="text-5xl font-bold text-vcc-navy">Creator Roster</h1>
      @if (store.canWrite()) {
        <button class="btn-primary px-6 py-3 text-lg" [disabled]="!selected().size || busy()" (click)="approveSelected()">
          <lucide-icon [img]="I.Check" [size]="20" /> Approve selected @if (selected().size) { ({{ selected().size }}) }
        </button>
      }
    </div>

    <div class="mt-7 grid grid-cols-2 gap-4 xl:grid-cols-4">
      <vcc-kpi label="Total enrolled" [value]="kpi()?.totalEnrolled" [icon]="I.Users" />
      <vcc-kpi label="Pending" [value]="kpi()?.pending" [icon]="I.Hourglass" tone="bg-amber-50 text-amber-600" />
      <vcc-kpi label="Approved" [value]="kpi()?.approved" [icon]="I.Check" tone="bg-green-50 text-vcc-success" />
      <vcc-kpi label="Active campaigns" [value]="kpi()?.activeCampaigns" [icon]="I.Megaphone" />
    </div>

    <section class="card-light mt-7 overflow-hidden">
      <div class="flex gap-3 p-4">
        <label class="relative flex-1">
          <span class="pointer-events-none absolute inset-y-0 left-4 flex items-center text-gray-400"><lucide-icon [img]="I.Search" [size]="18" /></span>
          <input class="input pl-11" [(ngModel)]="search" (ngModelChange)="onSearch()" placeholder="Search creators by name, Instagram or city…" />
        </label>
        <select class="input w-44" [(ngModel)]="status" (ngModelChange)="reload(1)">
          <option value="">All Status</option>
          @for (s of statuses; track s) { <option [value]="s" class="capitalize">{{ s | titlecase }}</option> }
        </select>
        <select class="input w-48" [(ngModel)]="tier" (ngModelChange)="reload(1)">
          <option value="">All Tier</option>
          @for (t of tiers; track t) { <option [value]="t">{{ tierLabel(t) }}</option> }
        </select>
      </div>

      @if (actionError()) { <p class="mx-4 mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{{ actionError() }}</p> }

      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="heading bg-slate-50 text-xs text-gray-600">
            <tr>
              <th class="w-12 px-4 py-3">
                <input type="checkbox" class="h-4 w-4 accent-vcc-blue" [checked]="allSelected()" (change)="toggleAll()" aria-label="Select all" />
              </th>
              <th class="px-3 py-3">Name</th><th class="px-3 py-3">Instagram</th><th class="px-3 py-3">Followers</th>
              <th class="px-3 py-3">City</th><th class="px-3 py-3">Status</th><th class="px-3 py-3">Tier</th><th class="px-3 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            @if (loading()) {
              <tr><td colspan="8" class="py-14 text-center text-vcc-blue"><vcc-spinner [size]="28" /></td></tr>
            } @else {
              @for (p of page()?.items; track p.id) {
                <tr class="border-t border-gray-100 hover:bg-slate-50/70">
                  <td class="px-4 py-3">
                    <input type="checkbox" class="h-4 w-4 accent-vcc-blue" [checked]="selected().has(p.id)" (change)="toggle(p.id)" [attr.aria-label]="'Select ' + p.fullName" />
                  </td>
                  <td class="px-3 py-3">
                    <button class="flex items-center gap-3 text-left" (click)="openDetail(p.id)">
                      <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-vcc-navy text-sm font-bold text-white">{{ initials(p.fullName) }}</span>
                      <span><span class="block font-bold text-gray-900 hover:text-vcc-blue">{{ p.fullName }}</span><span class="text-xs text-gray-500">{{ p.contentCategory }}</span></span>
                    </button>
                  </td>
                  <td class="px-3 py-3">{{ p.instagramHandle || '—' }}</td>
                  <td class="px-3 py-3">{{ fmt(coreFollowers(p)) }} <span class="text-xs capitalize text-gray-400">{{ p.corePlatform }}</span></td>
                  <td class="px-3 py-3">{{ p.city }}</td>
                  <td class="px-3 py-3"><vcc-status-pill [status]="p.status" /></td>
                  <td class="px-3 py-3"><vcc-tier-badge [tier]="p.tier" [light]="true" /></td>
                  <td class="px-3 py-3">
                    @if (store.canWrite()) {
                      <div class="flex gap-2">
                        <button class="btn-primary btn-sm" [disabled]="p.status === 'approved' || busy()" (click)="approve([p.id])">Approve</button>
                        <button class="btn-danger-outline btn-sm" [disabled]="p.status === 'rejected' || busy()" (click)="rejectTarget.set(p); rejectNote = ''">Reject</button>
                      </div>
                    } @else {
                      <button class="btn-ghost btn-sm" (click)="openDetail(p.id)">View</button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="8" class="py-14 text-center text-gray-500">No creators match these filters.</td></tr>
              }
            }
          </tbody>
        </table>
      </div>

      <div class="flex items-center justify-between border-t border-gray-100 px-6 py-4 text-sm text-gray-600">
        <span>Showing {{ rangeLabel() }} creators</span>
        <div class="flex gap-1.5">
          <button class="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 disabled:opacity-40" [disabled]="pageNo() <= 1" (click)="reload(pageNo() - 1)" aria-label="Previous page">
            <lucide-icon [img]="I.ChevronLeft" [size]="18" />
          </button>
          @for (n of pageNumbers(); track n) {
            <button class="h-9 min-w-9 rounded-lg border px-2" [class]="n === pageNo() ? 'border-vcc-blue bg-vcc-blue text-white' : 'border-gray-200'" (click)="reload(n)">{{ n }}</button>
          }
          <button class="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 disabled:opacity-40" [disabled]="pageNo() >= totalPages()" (click)="reload(pageNo() + 1)" aria-label="Next page">
            <lucide-icon [img]="I.ChevronRight" [size]="18" />
          </button>
        </div>
      </div>
    </section>

    <!-- Reject modal -->
    @if (rejectTarget(); as r) {
      <vcc-modal title="Reject application" (closed)="rejectTarget.set(null)">
        <p class="text-gray-700">Reject <strong>{{ r.fullName }}</strong>? They'll receive a notification.</p>
        <label class="field-label-light mt-4" for="rn">Note to creator (optional)</label>
        <textarea id="rn" class="input" rows="3" maxlength="500" [(ngModel)]="rejectNote" placeholder="Optional reason shared with the creator"></textarea>
        <div class="mt-5 flex justify-end gap-3">
          <button class="btn-ghost" (click)="rejectTarget.set(null)">Cancel</button>
          <button class="btn bg-vcc-danger text-white hover:bg-red-700" [disabled]="busy()" (click)="reject()">Reject</button>
        </div>
      </vcc-modal>
    }

    <!-- Detail drawer -->
    @if (detailOpen()) {
      <div class="fixed inset-0 z-40 bg-vcc-navy/50" (click)="detailOpen.set(false)"></div>
      <aside class="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto bg-white shadow-2xl" role="dialog" aria-modal="true">
        @if (!detail()) {
          <div class="grid h-full place-items-center text-vcc-blue"><vcc-spinner [size]="28" /></div>
        } @else {
          @let d = detail()!;
          <div class="sticky top-0 flex items-start justify-between border-b border-gray-100 bg-white px-6 py-5">
            <div>
              <h2 class="text-3xl font-bold text-vcc-navy">{{ d.fullName }}</h2>
              <div class="mt-2 flex gap-2"><vcc-status-pill [status]="d.status" /><vcc-tier-badge [tier]="d.tier" [light]="true" /></div>
            </div>
            <button class="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" (click)="detailOpen.set(false)" aria-label="Close"><lucide-icon [img]="I.X" [size]="22" /></button>
          </div>

          <div class="space-y-6 px-6 py-5 text-sm">
            <dl class="grid grid-cols-2 gap-x-6 gap-y-3">
              <div><dt class="text-gray-500">Email</dt><dd class="break-all">{{ d.email }}</dd></div>
              <div><dt class="text-gray-500">Phone</dt><dd>+91 {{ d.phone }}</dd></div>
              <div><dt class="text-gray-500">City</dt><dd>{{ d.city }}</dd></div>
              <div><dt class="text-gray-500">Coordinate</dt><dd>{{ d.coordinationMode === 'manager' ? 'Via manager' : 'Directly' }}</dd></div>
              @if (d.coordinationMode === 'manager') {
                <div class="col-span-2"><dt class="text-gray-500">Manager</dt><dd>{{ d.managerName }} · {{ d.managerContact }}</dd></div>
              }
              <div><dt class="text-gray-500">Category</dt><dd>{{ d.contentCategory }}</dd></div>
              <div><dt class="text-gray-500">Languages</dt><dd>{{ d.contentLanguages.join(', ') }}</dd></div>
              <div><dt class="text-gray-500">Enrolled</dt><dd>{{ d.enrolledAt | date: 'd MMM y, h:mm a' }}</dd></div>
              <div><dt class="text-gray-500">Approved</dt><dd>{{ d.approvedAt ? (d.approvedAt | date: 'd MMM y') : '—' }}</dd></div>
            </dl>

            <div>
              <h3 class="text-lg font-bold text-vcc-navy">Platforms</h3>
              <ul class="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200">
                @for (pl of detailPlatforms(); track pl.label) {
                  <li class="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span class="min-w-0"><span class="font-semibold">{{ pl.label }}</span>
                      @if (pl.core) { <span class="pill ml-1 bg-blue-100 px-2 py-0 text-[10px] text-blue-800">CORE</span> }
                      <span class="block truncate text-gray-500">{{ pl.link || '—' }}</span>
                    </span>
                    <span class="font-semibold">{{ fmt(pl.count) }}</span>
                  </li>
                }
              </ul>
              @if (d.otherPlatforms) { <p class="mt-2 text-gray-600">Also on: {{ d.otherPlatforms }}</p> }
            </div>

            <div>
              <h3 class="text-lg font-bold text-vcc-navy">Content</h3>
              <p class="mt-1 text-gray-700">{{ d.contentTypes.join(', ') || '—' }}</p>
              @if (d.bio) { <p class="mt-2 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-gray-700">{{ d.bio }}</p> }
              <dl class="mt-3 grid grid-cols-4 gap-3">
                @for (r of [{ l: 'Story', v: d.rateStory }, { l: 'Post', v: d.ratePost }, { l: 'Reel', v: d.rateReel }, { l: 'TVC', v: d.rateTvc }]; track r.l) {
                  <div><dt class="text-gray-500">{{ r.l }}</dt><dd>{{ r.v === null ? '—' : '₹' + (r.v | number) }}</dd></div>
                }
              </dl>
              <p class="mt-3"><span class="text-gray-500">Worked with Vivo:</span> {{ d.workedWithVivo ? 'Yes' : 'No' }} @if (d.vivoWorkDetails) { — {{ d.vivoWorkDetails }} }</p>
            </div>

            @if (d.assignments.length) {
              <div>
                <h3 class="text-lg font-bold text-vcc-navy">Campaigns</h3>
                <ul class="mt-2 space-y-1">
                  @for (a of d.assignments; track a.id) { <li class="flex justify-between"><span>{{ a.title }}</span><span class="capitalize text-gray-500">{{ a.status }}</span></li> }
                </ul>
              </div>
            }

            @if (store.canWrite()) {
              <div class="rounded-xl border border-gray-200 p-4">
                <h3 class="text-lg font-bold text-vcc-navy">Manage</h3>
                <div class="mt-3 grid grid-cols-2 gap-3">
                  <label><span class="field-label-light">Tier</span>
                    <select class="input" [(ngModel)]="editTier">
                      @for (t of tiers; track t) { <option [value]="t">{{ tierLabel(t) }}</option> }
                    </select>
                  </label>
                  <label><span class="field-label-light">Status</span>
                    <select class="input" [(ngModel)]="editStatus">
                      @for (s of statuses; track s) { <option [value]="s">{{ s | titlecase }}</option> }
                    </select>
                  </label>
                </div>
                <label class="mt-3 block"><span class="field-label-light">Internal notes</span>
                  <textarea class="input" rows="3" maxlength="2000" [(ngModel)]="editNotes" placeholder="Visible to the VCC team only"></textarea>
                </label>
                <p class="mt-1 text-xs text-gray-500">To approve with a notification, use the Approve button in the roster.</p>
                <div class="mt-3 flex items-center justify-end gap-3">
                  @if (detailMsg()) { <span class="text-sm text-vcc-success">{{ detailMsg() }}</span> }
                  <button class="btn-primary" [disabled]="busy()" (click)="saveDetail()">Save</button>
                </div>
              </div>

              <div class="rounded-xl border border-gray-200 p-4">
                <h3 class="text-lg font-bold text-vcc-navy">Send notification</h3>
                <input class="input mt-3" [(ngModel)]="notifTitle" maxlength="120" placeholder="Title" />
                <textarea class="input mt-2" rows="3" [(ngModel)]="notifMessage" maxlength="1000" placeholder="Message"></textarea>
                <div class="mt-2 flex items-center gap-3">
                  <select class="input w-40" [(ngModel)]="notifType">
                    <option value="info">Info</option><option value="campaign">Campaign</option><option value="approval">Approval</option><option value="alert">Alert</option>
                  </select>
                  <span class="flex-1 text-sm text-vcc-success">{{ notifMsg() }}</span>
                  <button class="btn-primary" [disabled]="busy() || notifTitle.trim().length < 2 || notifMessage.trim().length < 2" (click)="sendNotif(d.id)">
                    <lucide-icon [img]="I.Send" [size]="16" /> Send
                  </button>
                </div>
              </div>
            }
            @if (detailError()) { <p class="rounded-lg bg-red-50 px-4 py-2 text-red-700">{{ detailError() }}</p> }
          </div>
        }
      </aside>
    }
  `,
})
export class AdminCreatorsComponent implements OnInit {
  private api = inject(ApiService);
  protected store = inject(AdminStore);
  protected readonly I = I;
  protected readonly tiers = ALL_TIERS;
  protected readonly statuses: ProfileStatus[] = ['pending', 'approved', 'rejected', 'inactive'];
  protected fmt = formatCount;
  protected coreFollowers = coreFollowers;
  protected tierLabel = (t: Tier) => TIER_META[t].label;

  protected search = '';
  protected status = '';
  protected tier = '';
  protected pageNo = signal(1);
  protected page = signal<Paged<Profile> | null>(null);
  protected kpi = signal<{ totalEnrolled: number; pending: number; approved: number; activeCampaigns: number } | null>(null);
  protected loading = signal(true);
  protected busy = signal(false);
  protected actionError = signal<string | null>(null);
  protected selected = signal<Set<string>>(new Set());

  protected rejectTarget = signal<Profile | null>(null);
  protected rejectNote = '';

  protected detailOpen = signal(false);
  protected detail = signal<CreatorDetail | null>(null);
  protected detailError = signal<string | null>(null);
  protected detailMsg = signal('');
  protected editTier: Tier = 'vcc_community';
  protected editStatus: ProfileStatus = 'pending';
  protected editNotes = '';
  protected notifTitle = '';
  protected notifMessage = '';
  protected notifType = 'info';
  protected notifMsg = signal('');

  private searchTimer?: ReturnType<typeof setTimeout>;

  protected totalPages = computed(() => Math.max(1, Math.ceil((this.page()?.total ?? 0) / 10)));
  protected pageNumbers = computed(() => {
    const total = this.totalPages();
    const cur = this.pageNo();
    const start = Math.max(1, Math.min(cur - 2, total - 4));
    return Array.from({ length: Math.min(5, total) }, (_, i) => start + i);
  });
  protected rangeLabel = computed(() => {
    const p = this.page();
    if (!p || !p.total) return '0 of 0';
    const from = (p.page - 1) * p.pageSize + 1;
    return `${from}–${from + p.items.length - 1} of ${p.total}`;
  });
  protected allSelected = computed(() => {
    const items = this.page()?.items ?? [];
    return items.length > 0 && items.every((i) => this.selected().has(i.id));
  });
  protected detailPlatforms = computed(() => {
    const d = this.detail();
    if (!d) return [];
    const rows = [
      { v: 'instagram', link: d.instagramHandle || d.instagramUrl, count: d.instagramFollowers },
      { v: 'youtube', link: [d.youtubeHandle, d.youtubeUrl].filter(Boolean).join(' · '), count: d.youtubeSubscribers },
      { v: 'facebook', link: d.facebookUrl, count: d.facebookFollowers },
      { v: 'linkedin', link: d.linkedinUrl, count: d.linkedinFollowers },
      { v: 'threads', link: d.threadsHandle || d.threadsUrl, count: d.threadsFollowers },
    ];
    return rows
      .filter((r) => r.link || r.count)
      .map((r) => ({ ...r, label: PLATFORMS.find((x) => x.value === r.v)!.label, core: d.corePlatform === r.v }));
  });

  ngOnInit() {
    this.reload(1);
  }

  protected initials(name: string) {
    return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
  }

  protected onSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.reload(1), 300);
  }

  async reload(pageNo = this.pageNo()) {
    this.loading.set(true);
    this.pageNo.set(pageNo);
    try {
      const [page, stats] = await Promise.all([
        this.api.creators({ search: this.search, status: this.status, tier: this.tier, page: pageNo, pageSize: 10 }),
        this.api.stats(),
      ]);
      this.page.set(page);
      this.kpi.set(stats);
      this.selected.set(new Set());
    } catch (e) {
      this.actionError.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected toggle(id: string) {
    const s = new Set(this.selected());
    s.has(id) ? s.delete(id) : s.add(id);
    this.selected.set(s);
  }

  protected toggleAll() {
    const items = this.page()?.items ?? [];
    this.selected.set(this.allSelected() ? new Set() : new Set(items.map((i) => i.id)));
  }

  protected approveSelected() {
    return this.approve([...this.selected()]);
  }

  protected async approve(ids: string[]) {
    this.busy.set(true);
    this.actionError.set(null);
    try {
      await this.api.approve(ids);
      await this.reload();
    } catch (e) {
      this.actionError.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async reject() {
    const r = this.rejectTarget();
    if (!r) return;
    this.busy.set(true);
    try {
      await this.api.reject(r.id, this.rejectNote.trim());
      this.rejectTarget.set(null);
      await this.reload();
    } catch (e) {
      this.actionError.set(errorMessage(e));
      this.rejectTarget.set(null);
    } finally {
      this.busy.set(false);
    }
  }

  protected async openDetail(id: string) {
    this.detailOpen.set(true);
    this.detail.set(null);
    this.detailError.set(null);
    this.detailMsg.set('');
    this.notifMsg.set('');
    this.notifTitle = '';
    this.notifMessage = '';
    try {
      const d = await this.api.creator(id);
      this.detail.set(d);
      this.editTier = d.tier;
      this.editStatus = d.status;
      this.editNotes = d.adminNotes ?? '';
    } catch (e) {
      this.detailError.set(errorMessage(e));
    }
  }

  protected async saveDetail() {
    const d = this.detail();
    if (!d) return;
    this.busy.set(true);
    this.detailError.set(null);
    try {
      const body: { tier?: string; status?: string; adminNotes?: string | null } = { adminNotes: this.editNotes.trim() || null };
      if (this.editTier !== d.tier) body.tier = this.editTier;
      if (this.editStatus !== d.status) body.status = this.editStatus;
      const updated = await this.api.updateCreator(d.id, body);
      this.detail.set({ ...d, ...updated });
      this.detailMsg.set('Saved');
      await this.reload();
    } catch (e) {
      this.detailError.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async sendNotif(id: string) {
    this.busy.set(true);
    this.detailError.set(null);
    try {
      await this.api.sendNotification({ creatorIds: [id], title: this.notifTitle, message: this.notifMessage, type: this.notifType });
      this.notifMsg.set('Sent');
      this.notifTitle = '';
      this.notifMessage = '';
    } catch (e) {
      this.detailError.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
