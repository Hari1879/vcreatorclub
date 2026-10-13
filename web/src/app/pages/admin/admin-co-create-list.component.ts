import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { errorMessage } from '../../core/api.service';
import { CoCreateApi } from '../../core/co-create.api';
import { ALL_FLAGS, CoCreateListPage, FLAG_META, STATUS_CLS, STATUS_LABEL } from '../../core/co-create.models';
import { ToastService } from '../../core/toast.service';
import { I } from '../../shared/icons';
import { SUPPORT_OPTIONS } from '../co-create/co-create.logic';
import { AdminStore } from './admin.store';

const PAGE_SIZE = 20;

@Component({
  selector: 'vcc-admin-co-create-list',
  standalone: true,
  imports: [FormsModule, DatePipe, LucideAngularModule],
  template: `
    <h1 class="text-5xl font-bold text-vcc-navy">CO-CREATE REQUESTS</h1>
    <p class="mt-2 text-gray-600">Ideas pitched by creators. Pending requests are listed first, oldest first.</p>

    <section class="card-light mt-7 overflow-hidden">
      <div class="flex flex-wrap gap-3 p-4">
        <label class="relative min-w-[220px] flex-1">
          <span class="pointer-events-none absolute inset-y-0 left-4 flex items-center text-gray-400"><lucide-icon [img]="I.Search" [size]="18" /></span>
          <input class="input pl-11" [(ngModel)]="search" (ngModelChange)="onSearch()" placeholder="Search by creator or title…" aria-label="Search" />
        </label>
        <select class="input w-44" [(ngModel)]="status" (ngModelChange)="reload(1)" aria-label="Status">
          <option value="">All statuses</option>
          @for (s of statuses; track s[0]) { <option [value]="s[0]">{{ s[1] }}</option> }
        </select>
        <select class="input w-52" [(ngModel)]="supportType" (ngModelChange)="reload(1)" aria-label="Support type">
          <option value="">All support types</option>
          @for (o of supportOptions; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
        </select>
        <select class="input w-48" [(ngModel)]="flag" (ngModelChange)="reload(1)" aria-label="Flag">
          <option value="">All flags</option>
          @for (f of flags; track f) { <option [value]="f">{{ meta[f].short }}</option> }
        </select>
        <label class="flex items-center gap-2 text-sm text-gray-600">From
          <input type="date" class="input w-40" [(ngModel)]="from" (ngModelChange)="reload(1)" /></label>
        <label class="flex items-center gap-2 text-sm text-gray-600">To
          <input type="date" class="input w-40" [(ngModel)]="to" (ngModelChange)="reload(1)" /></label>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="heading bg-slate-50 text-xs text-gray-600">
            <tr>
              <th class="px-6 py-3">Creator</th><th class="px-3 py-3">Title</th><th class="px-3 py-3">Support</th>
              <th class="px-3 py-3">Product</th><th class="px-3 py-3">Flags</th><th class="px-3 py-3">Status</th><th class="px-3 py-3">Submitted</th>
            </tr>
          </thead>
          <tbody>
            @if (loading()) {
              @for (n of [1, 2, 3, 4, 5]; track n) {
                <tr class="border-t border-gray-100"><td colspan="7" class="px-6 py-4"><div class="h-5 animate-pulse rounded bg-gray-100"></div></td></tr>
              }
            } @else if (loadError()) {
              <tr><td colspan="7" class="px-6 py-10 text-center text-red-600">{{ loadError() }}
                <button class="btn-ghost ml-3" (click)="reload(pageNo())">Retry</button></td></tr>
            } @else {
              @for (r of page()?.items ?? []; track r.id) {
                <tr class="cursor-pointer border-t border-gray-100 hover:bg-slate-50" tabindex="0" (click)="open(r.id)" (keydown.enter)="open(r.id)">
                  <td class="px-6 py-3 font-semibold text-vcc-navy">{{ r.creatorName }}</td>
                  <td class="px-3 py-3">{{ r.title }}</td>
                  <td class="px-3 py-3 capitalize">{{ r.supportType }}</td>
                  <td class="px-3 py-3">{{ r.product }}</td>
                  <td class="px-3 py-3">
                    <span class="flex flex-wrap gap-1">
                      @for (f of r.flags; track f) {
                        <span [class]="'rounded-full px-2 py-0.5 text-xs font-semibold ' + (meta[f].severity === 'red' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800')">{{ meta[f].short }}</span>
                      }
                    </span>
                  </td>
                  <td class="px-3 py-3"><span [class]="'rounded-full px-2.5 py-0.5 text-xs font-semibold ' + cls[r.status]">{{ label[r.status] }}</span></td>
                  <td class="px-3 py-3 text-gray-600">{{ r.submittedAt | date: 'dd MMM yyyy' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="px-6 py-12 text-center text-gray-500">No co-create requests match these filters.</td></tr>
              }
            }
          </tbody>
        </table>
      </div>

      <div class="flex items-center justify-between border-t border-gray-100 px-6 py-4 text-sm text-gray-600">
        <span>Showing {{ rangeLabel() }} requests</span>
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
  `,
})
export class AdminCoCreateListComponent implements OnInit, OnDestroy {
  private api = inject(CoCreateApi);
  private router = inject(Router);
  private toast = inject(ToastService);
  private store = inject(AdminStore);
  protected readonly I = I;
  protected meta = FLAG_META;
  protected cls = STATUS_CLS;
  protected label = STATUS_LABEL;
  protected flags = ALL_FLAGS;
  protected supportOptions = SUPPORT_OPTIONS;
  protected statuses = Object.entries(STATUS_LABEL);

  protected page = signal<CoCreateListPage | null>(null);
  protected pageNo = signal(1);
  protected loading = signal(true);
  protected loadError = signal<string | null>(null);
  protected search = '';
  protected status = '';
  protected supportType = '';
  protected flag = '';
  protected from = '';
  protected to = '';

  private timer?: ReturnType<typeof setTimeout>;
  private seq = 0;

  protected totalPages = computed(() => Math.max(1, Math.ceil((this.page()?.total ?? 0) / PAGE_SIZE)));
  protected pageNumbers = computed(() => {
    const total = this.totalPages();
    const start = Math.max(1, Math.min(this.pageNo() - 2, total - 4));
    return Array.from({ length: Math.min(5, total) }, (_, i) => start + i);
  });
  protected rangeLabel = computed(() => {
    const p = this.page();
    if (!p || !p.total) return '0 of 0';
    const from = (p.page - 1) * p.pageSize + 1;
    return `${from}–${from + p.items.length - 1} of ${p.total}`;
  });

  ngOnInit() {
    this.reload(1);
  }
  ngOnDestroy() {
    clearTimeout(this.timer);
  }

  protected onSearch() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.reload(1), 300);
  }
  protected open(id: string) {
    this.router.navigate(['/admin/co-create', id]);
  }

  async reload(page: number) {
    const seq = ++this.seq;
    this.pageNo.set(page);
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const res = await this.api.adminList({
        search: this.search.trim(),
        status: this.status,
        supportType: this.supportType,
        flag: this.flag,
        from: this.from,
        to: this.to,
        page,
        pageSize: PAGE_SIZE,
      });
      if (seq !== this.seq) return;
      this.page.set(res);
      if (!this.status && !this.supportType && !this.flag && !this.search && !this.from && !this.to) {
        this.api.summary().then((s) => this.store.coCreatePending.set(s.pending)).catch(() => undefined);
      }
    } catch (e) {
      if (seq !== this.seq) return;
      this.loadError.set(errorMessage(e));
      this.toast.error(errorMessage(e));
    } finally {
      if (seq === this.seq) this.loading.set(false);
    }
  }
}
