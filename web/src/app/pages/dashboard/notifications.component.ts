import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ApiService, errorMessage } from '../../core/api.service';
import { AppNotification } from '../../core/models';
import { timeAgo } from '../../core/constants';
import { NotifIconComponent, SpinnerComponent } from '../../shared/ui.components';
import { CreatorStore } from './creator.store';

@Component({
  selector: 'vcc-notifications',
  standalone: true,
  imports: [NotifIconComponent, SpinnerComponent],
  template: `
    <div class="mb-5 flex items-end justify-between">
      <h1 class="text-4xl font-bold">Notifications</h1>
      @if (unread() > 0) {
        <button class="text-sm text-vcc-blue-light hover:underline" (click)="readAll()">Mark all as read</button>
      }
    </div>
    @if (loading()) {
      <div class="grid place-items-center py-16"><vcc-spinner [size]="30" /></div>
    } @else if (error()) {
      <p class="card-dark p-5 text-center text-sm text-red-300">{{ error() }}</p>
    } @else {
      @for (n of items(); track n.id) {
        <button type="button" (click)="open(n)" class="card-dark mb-3 flex w-full items-start gap-4 p-4 text-left transition hover:border-vcc-blue/50"
                [class.!border-vcc-blue]="!n.read">
          <vcc-notif-icon [type]="n.type" />
          <span class="min-w-0 flex-1">
            <span class="flex items-start justify-between gap-3">
              <span class="heading" [class.font-bold]="!n.read" [class.text-white]="!n.read" [class.text-vcc-gray-light]="n.read">{{ n.title }}</span>
              <span class="flex shrink-0 items-center gap-2 text-xs text-vcc-gray-light">
                {{ ago(n.createdAt) }}
                @if (!n.read) { <span class="h-2.5 w-2.5 rounded-full bg-vcc-blue-light" aria-label="Unread"></span> }
              </span>
            </span>
            <span class="mt-1 block whitespace-pre-line text-sm" [class.text-white]="!n.read" [class.font-medium]="!n.read" [class.text-vcc-gray-light]="n.read">{{ n.message }}</span>
          </span>
        </button>
      } @empty {
        <p class="card-dark p-6 text-center text-vcc-gray-light">No notifications yet.</p>
      }
    }
  `,
})
export class NotificationsComponent implements OnInit {
  private api = inject(ApiService);
  private store = inject(CreatorStore);
  protected items = signal<AppNotification[]>([]);
  protected loading = signal(true);
  protected error = signal<string | null>(null);
  protected unread = computed(() => this.items().filter((n) => !n.read).length);
  protected ago = timeAgo;

  async ngOnInit() {
    try {
      this.items.set(await this.api.notifications());
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected async open(n: AppNotification) {
    if (n.read) return;
    this.items.update((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    this.store.unread.set(this.unread());
    await this.api.markRead(n.id).catch(() => undefined);
  }

  protected async readAll() {
    this.items.update((list) => list.map((x) => ({ ...x, read: true })));
    this.store.unread.set(0);
    await this.api.markAllRead().catch(() => undefined);
  }
}
