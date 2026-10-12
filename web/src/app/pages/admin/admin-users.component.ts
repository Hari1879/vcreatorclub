import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ApiService, errorMessage } from '../../core/api.service';
import { timeAgo } from '../../core/constants';
import { AdminUser, AssignableRole, Paged } from '../../core/models';
import { I } from '../../shared/icons';
import { SpinnerComponent } from '../../shared/ui.components';
import { ModalComponent } from './admin-ui';
import { AdminStore } from './admin.store';

const PAGE_SIZE = 20;

const ROLE_OPTIONS: { value: AssignableRole; label: string }[] = [
  { value: 'none', label: 'No access' },
  { value: 'viewer', label: 'Viewer (read-only)' },
  { value: 'admin', label: 'Admin' },
  { value: 'super_admin', label: 'Super Admin' },
];

const ROLE_LABEL: Record<AssignableRole, string> = {
  none: 'No access',
  viewer: 'Viewer',
  admin: 'Admin',
  super_admin: 'Super Admin',
};

const ROLE_PILL: Record<AssignableRole, string> = {
  super_admin: 'bg-amber-100 text-amber-800',
  admin: 'bg-blue-100 text-blue-800',
  viewer: 'bg-slate-200 text-slate-700',
  none: 'bg-gray-100 text-gray-500',
};

@Component({
  selector: 'vcc-admin-users',
  standalone: true,
  imports: [NgClass, FormsModule, LucideAngularModule, ModalComponent, SpinnerComponent],
  template: `
    @if (!store.isSuperAdmin()) {
      <h1 class="text-5xl font-bold text-vcc-navy">Users</h1>
      <p class="card-light mt-7 p-8 text-center text-gray-600">Only super admins can manage users.</p>
    } @else {
      <h1 class="text-5xl font-bold text-vcc-navy">Users</h1>
      <p class="mt-2 max-w-3xl text-gray-600">
        Everyone who has signed in with Google. Ask a new team member to sign in at vcreatorclub.in/admin first, then set their role here.
      </p>

      <section class="card-light mt-7 overflow-hidden">
        <div class="flex gap-3 p-4">
          <label class="relative flex-1">
            <span class="pointer-events-none absolute inset-y-0 left-4 flex items-center text-gray-400"><lucide-icon [img]="I.Search" [size]="18" /></span>
            <input class="input pl-11" [(ngModel)]="search" (ngModelChange)="onSearch()" placeholder="Search users by name or email…" />
          </label>
          <select class="input w-48" [(ngModel)]="roleFilter" aria-label="Filter by role">
            <option value="">All roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="viewer">Viewer</option>
            <option value="none">No access</option>
          </select>
        </div>

        @if (loadError()) { <p class="mx-4 mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{{ loadError() }}</p> }

        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="heading bg-slate-50 text-xs text-gray-600">
              <tr>
                <th class="px-6 py-3">Name</th><th class="px-3 py-3">Email</th><th class="px-3 py-3">Creator?</th>
                <th class="px-3 py-3">Last sign-in</th><th class="px-3 py-3">Role</th><th class="px-3 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              @if (loading()) {
                <tr><td colspan="6" class="py-14 text-center text-vcc-blue"><vcc-spinner [size]="28" /></td></tr>
              } @else {
                @for (u of filtered(); track u.id) {
                  <tr class="border-t border-gray-100 hover:bg-slate-50/70">
                    <td class="px-6 py-3">
                      <span class="flex items-center gap-3">
                        @if (u.avatarUrl) {
                          <img [src]="u.avatarUrl" alt="" referrerpolicy="no-referrer" class="h-10 w-10 shrink-0 rounded-full object-cover" />
                        } @else {
                          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-vcc-navy text-sm font-bold text-white">{{ initial(u) }}</span>
                        }
                        <span class="font-bold text-gray-900">
                          {{ u.name || '—' }}
                          @if (u.isYou) { <span class="font-normal text-gray-500">(you)</span> }
                        </span>
                      </span>
                    </td>
                    <td class="px-3 py-3 text-gray-600">{{ u.email }}</td>
                    <td class="px-3 py-3">
                      @if (u.isCreator) { <span class="pill bg-teal-100 text-teal-800">Creator</span> }
                    </td>
                    <td class="whitespace-nowrap px-3 py-3 text-gray-500">{{ u.lastLoginAt ? ago(u.lastLoginAt) : 'Never' }}</td>
                    <td class="px-3 py-3">
                      <div class="flex items-center gap-2">
                        <select
                          class="input w-48 py-2"
                          [ngModel]="selectedRole(u)"
                          (ngModelChange)="draft(u, $event)"
                          [disabled]="u.isYou || savingId() === u.id"
                          [attr.aria-label]="'Role for ' + (u.name || u.email)"
                        >
                          @for (o of roleOptions; track o.value) { <option [value]="o.value">{{ o.label }}</option> }
                        </select>
                        <span class="pill whitespace-nowrap" [ngClass]="pill(currentRole(u))">{{ label(currentRole(u)) }}</span>
                      </div>
                    </td>
                    <td class="px-3 py-3">
                      @if (isDirty(u)) {
                        <button class="btn-primary btn-sm" [disabled]="savingId() === u.id" (click)="requestSave(u)">
                          @if (savingId() === u.id) { <vcc-spinner [size]="14" /> } Save
                        </button>
                      } @else if (savedId() === u.id) {
                        <span class="flex items-center gap-1 text-sm font-semibold text-vcc-success"><lucide-icon [img]="I.Check" [size]="16" /> Saved</span>
                      }
                    </td>
                  </tr>
                  @if (rowError()?.id === u.id) {
                    <tr><td colspan="6" class="bg-red-50 px-6 py-2 text-sm text-red-700" role="alert">{{ rowError()!.message }}</td></tr>
                  }
                } @empty {
                  <tr><td colspan="6" class="py-14 text-center text-gray-500">No users match these filters.</td></tr>
                }
              }
            </tbody>
          </table>
        </div>

        <div class="flex items-center justify-between border-t border-gray-100 px-6 py-4 text-sm text-gray-600">
          <span>Showing {{ rangeLabel() }} users</span>
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

      @if (confirm(); as c) {
        <vcc-modal [title]="c.role === 'none' ? 'Remove access' : 'Make Super Admin'" (closed)="confirm.set(null)">
          @if (c.role === 'none') {
            <p class="text-gray-700">Remove admin access for <strong>{{ c.user.name || c.user.email }}</strong>?</p>
          } @else {
            <p class="text-gray-700">Make <strong>{{ c.user.name || c.user.email }}</strong> a Super Admin? They'll be able to manage all users.</p>
          }
          <div class="mt-5 flex justify-end gap-3">
            <button class="btn-ghost" (click)="confirm.set(null)">Cancel</button>
            <button class="btn text-white" [ngClass]="c.role === 'none' ? 'bg-vcc-danger hover:bg-red-700' : 'bg-vcc-blue hover:bg-vcc-blue-dark'" (click)="save(c.user, c.role)">
              {{ c.role === 'none' ? 'Remove access' : 'Make Super Admin' }}
            </button>
          </div>
        </vcc-modal>
      }
    }
  `,
})
export class AdminUsersComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  protected store = inject(AdminStore);
  protected readonly I = I;
  protected readonly roleOptions = ROLE_OPTIONS;
  protected ago = timeAgo;

  protected page = signal<Paged<AdminUser> | null>(null);
  protected pageNo = signal(1);
  protected loading = signal(true);
  protected loadError = signal<string | null>(null);
  protected drafts = signal<Record<string, AssignableRole>>({});
  protected savingId = signal<string | null>(null);
  protected savedId = signal<string | null>(null);
  protected rowError = signal<{ id: string; message: string } | null>(null);
  protected confirm = signal<{ user: AdminUser; role: AssignableRole } | null>(null);
  protected search = '';
  protected roleFilter: '' | AssignableRole = '';

  private searchTimer?: ReturnType<typeof setTimeout>;
  private savedTimer?: ReturnType<typeof setTimeout>;
  private requestSeq = 0;

  protected filtered = computed(() => {
    const items = this.page()?.items ?? [];
    return this.roleFilter ? items.filter((u) => (u.role ?? 'none') === this.roleFilter) : items;
  });
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
    if (this.store.isSuperAdmin()) this.reload(1);
  }

  ngOnDestroy() {
    clearTimeout(this.searchTimer);
    clearTimeout(this.savedTimer);
  }

  protected initial(u: AdminUser) {
    return (u.name || u.email).charAt(0).toUpperCase();
  }
  protected currentRole = (u: AdminUser): AssignableRole => u.role ?? 'none';
  protected selectedRole = (u: AdminUser): AssignableRole => this.drafts()[u.id] ?? this.currentRole(u);
  protected isDirty = (u: AdminUser) => this.selectedRole(u) !== this.currentRole(u);
  protected label = (r: AssignableRole) => ROLE_LABEL[r];
  protected pill = (r: AssignableRole) => ROLE_PILL[r];

  protected draft(u: AdminUser, role: AssignableRole) {
    this.drafts.update((d) => ({ ...d, [u.id]: role }));
    if (this.rowError()?.id === u.id) this.rowError.set(null);
    if (this.savedId() === u.id) this.savedId.set(null);
  }

  protected onSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.reload(1), 300);
  }

  async reload(pageNo = this.pageNo()) {
    const seq = ++this.requestSeq;
    this.loading.set(true);
    this.pageNo.set(pageNo);
    this.loadError.set(null);
    try {
      const page = await this.api.adminUsers({ search: this.search.trim(), page: pageNo, pageSize: PAGE_SIZE });
      if (seq !== this.requestSeq) return;
      this.page.set(page);
    } catch (e) {
      if (seq !== this.requestSeq) return;
      this.loadError.set(errorMessage(e));
    } finally {
      if (seq === this.requestSeq) this.loading.set(false);
    }
  }

  protected requestSave(u: AdminUser) {
    const role = this.selectedRole(u);
    if (role === 'super_admin' || (role === 'none' && u.role)) this.confirm.set({ user: u, role });
    else this.save(u, role);
  }

  protected async save(u: AdminUser, role: AssignableRole) {
    this.confirm.set(null);
    this.savingId.set(u.id);
    this.rowError.set(null);
    try {
      await this.api.setUserRole(u.id, role);
      this.drafts.update(({ [u.id]: _, ...rest }) => rest);
      await this.reload();
      this.savedId.set(u.id);
      clearTimeout(this.savedTimer);
      this.savedTimer = setTimeout(() => this.savedId.set(null), 3000);
    } catch (e) {
      this.rowError.set({ id: u.id, message: errorMessage(e) });
    } finally {
      this.savingId.set(null);
    }
  }
}
