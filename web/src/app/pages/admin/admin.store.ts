import { Injectable, computed, signal } from '@angular/core';
import { AdminRole } from '../../core/models';

@Injectable()
export class AdminStore {
  readonly admin = signal<{ name: string; email: string; role: AdminRole } | null>(null);
  readonly coCreatePending = signal(0);
  readonly isSuperAdmin = computed(() => this.admin()?.role === 'super_admin');
  readonly canWrite = computed(() => !!this.admin() && this.admin()!.role !== 'viewer');
}
