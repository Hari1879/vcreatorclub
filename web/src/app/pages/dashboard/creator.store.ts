import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { Summary } from '../../core/models';

/** Shared dashboard state (profile, unread badge). Provided by the shell. */
@Injectable()
export class CreatorStore {
  private api = inject(ApiService);
  readonly summary = signal<Summary | null>(null);
  readonly profile = computed(() => this.summary()?.profile ?? null);
  readonly unread = signal(0);

  async refresh() {
    const s = await this.api.summary();
    this.summary.set(s);
    this.unread.set(s.unreadCount ?? 0);
    return s;
  }
}
