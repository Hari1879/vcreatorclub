import { Injectable, computed, signal } from '@angular/core';
import { AdminRole } from '../../core/models';

@Injectable()
export class AdminStore {
  readonly admin = signal<{ name: string; email: string; role: AdminRole } | null>(null);
  readonly canWrite = computed(() => !!this.admin() && this.admin()!.role !== 'viewer');
}
