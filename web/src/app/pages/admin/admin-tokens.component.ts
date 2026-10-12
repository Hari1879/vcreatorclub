import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { QRCodeModule } from 'angularx-qrcode';
import { LucideAngularModule } from 'lucide-angular';
import { ApiService, errorMessage } from '../../core/api.service';
import { EnrollmentToken } from '../../core/models';
import { I } from '../../shared/icons';
import { SpinnerComponent } from '../../shared/ui.components';
import { AdminStore } from './admin.store';

const STATE_CLS: Record<EnrollmentToken['state'], string> = {
  active: 'bg-green-100 text-green-800',
  expired: 'bg-slate-200 text-slate-700',
  exhausted: 'bg-amber-100 text-amber-800',
  inactive: 'bg-red-100 text-red-700',
};

/** India-time date string N days from today (yyyy-mm-dd). */
function daysFromNow(n: number) {
  return new Date(Date.now() + n * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

@Component({
  selector: 'vcc-admin-tokens',
  standalone: true,
  imports: [DatePipe, NgClass, FormsModule, QRCodeModule, LucideAngularModule, SpinnerComponent],
  template: `
    <div class="flex items-center justify-between">
      <h1 class="text-5xl font-bold text-vcc-navy">QR Tokens</h1>
      @if (store.canWrite() && !formOpen()) {
        <button class="btn-primary px-6 py-3 text-lg" (click)="formOpen.set(true)"><lucide-icon [img]="I.Plus" [size]="20" /> Generate token</button>
      }
    </div>
    @if (error()) { <p class="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{{ error() }}</p> }

    <div class="mt-7 grid gap-6 xl:grid-cols-[1fr_380px]">
      <div class="space-y-6">
        <!-- Generate form -->
        @if (formOpen() && store.canWrite()) {
          <section class="card-light p-6">
            <div class="flex items-center justify-between">
              <h2 class="text-2xl font-bold text-vcc-navy">Generate token</h2>
              <button class="text-sm font-semibold text-vcc-blue hover:underline" (click)="eventPreset()">Use Oct 13 event preset</button>
            </div>
            <div class="mt-4 grid grid-cols-2 gap-4">
              <label class="col-span-2"><span class="field-label-light">Label</span>
                <input class="input" [(ngModel)]="label" maxlength="120" placeholder="e.g. Oct 13 Event QR" />
              </label>
              <div>
                <span class="field-label-light">Event token</span>
                <div class="flex gap-2">
                  @for (o of [true, false]; track o) {
                    <button type="button" class="flex-1 rounded-lg border px-4 py-3 font-medium"
                            [ngClass]="isEvent === o ? 'border-vcc-blue bg-blue-50 text-vcc-blue' : 'border-gray-300 text-gray-600'"
                            (click)="setEvent(o)">{{ o ? 'Yes' : 'No' }}</button>
                  }
                </div>
              </div>
              <label><span class="field-label-light">Max uses</span>
                <input class="input" type="number" min="1" max="10000" [(ngModel)]="maxUses" />
              </label>
              <label><span class="field-label-light">Expiry date</span>
                <input class="input" type="date" [(ngModel)]="expiryDate" [min]="today" />
              </label>
              <p class="self-end pb-3 text-sm text-gray-500">Expires at 11:59 PM India time.</p>
            </div>
            <div class="mt-5 flex justify-end gap-3">
              <button class="btn-ghost" (click)="formOpen.set(false)">Cancel</button>
              <button class="btn-primary" [disabled]="busy()" (click)="generate()">
                @if (busy()) { <vcc-spinner [size]="18" /> } Generate
              </button>
            </div>
          </section>
        }

        <!-- Token list -->
        <section class="card-light overflow-hidden">
          <h2 class="px-6 pt-5 text-2xl font-bold text-vcc-navy">All tokens</h2>
          @if (loading()) {
            <div class="grid place-items-center py-12 text-vcc-blue"><vcc-spinner [size]="26" /></div>
          } @else {
            <table class="mt-3 w-full text-left text-sm">
              <thead class="heading bg-slate-50 text-xs text-gray-600">
                <tr><th class="px-6 py-3">Label</th><th class="px-3 py-3">Type</th><th class="px-3 py-3">Used</th><th class="px-3 py-3">Expires</th><th class="px-3 py-3">Status</th><th class="px-3 py-3"></th></tr>
              </thead>
              <tbody>
                @for (t of tokens(); track t.id) {
                  <tr class="cursor-pointer border-t border-gray-100 hover:bg-slate-50" [class.bg-blue-50]="selected()?.id === t.id" (click)="selected.set(t)">
                    <td class="px-6 py-3 font-semibold text-gray-900">{{ t.label || 'Untitled' }}</td>
                    <td class="px-3 py-3">{{ t.isEventToken ? 'Event' : 'Individual' }}</td>
                    <td class="px-3 py-3">{{ t.usedCount }} / {{ t.maxUses }}</td>
                    <td class="px-3 py-3">{{ t.expiresAt | date: 'd MMM y, h:mm a' }}</td>
                    <td class="px-3 py-3"><span class="pill capitalize" [ngClass]="stateCls(t.state)">{{ t.state }}</span></td>
                    <td class="px-3 py-3 text-right">
                      @if (store.canWrite()) {
                        <button class="text-sm font-semibold hover:underline" [class.text-vcc-danger]="t.isActive" [class.text-vcc-blue]="!t.isActive"
                                (click)="$event.stopPropagation(); toggleActive(t)">{{ t.isActive ? 'Deactivate' : 'Activate' }}</button>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="6" class="px-6 py-10 text-center text-gray-500">No tokens yet. Generate one for your event.</td></tr>
                }
              </tbody>
            </table>
          }
        </section>
      </div>

      <!-- Selected token: QR card -->
      <aside>
        @if (selected(); as t) {
          <section class="card-light sticky top-24 p-6">
            <p class="text-xs uppercase tracking-wider text-gray-500">{{ t.isEventToken ? 'Event token' : 'Individual token' }}</p>
            <h2 class="text-2xl font-bold text-vcc-navy">{{ t.label || 'Untitled' }}</h2>
            <div #qrBox class="vcc-qr mx-auto mt-4 w-64 rounded-xl border border-gray-200 bg-white p-2">
              <qrcode [qrdata]="url()" [width]="1024" [margin]="2" errorCorrectionLevel="M" elementType="canvas" />
            </div>
            <div class="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 p-2">
              <code class="min-w-0 flex-1 truncate px-2 text-xs text-gray-700" [title]="url()">{{ url() }}</code>
              <button class="btn-ghost btn-sm" (click)="copy()"><lucide-icon [img]="copied() ? I.Check : I.Copy" [size]="16" /> {{ copied() ? 'Copied' : 'Copy' }}</button>
            </div>
            <button class="btn-primary mt-3 w-full py-3" (click)="download(t)"><lucide-icon [img]="I.Download" [size]="18" /> Download QR as PNG</button>
            <dl class="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><dt class="text-gray-500">Used</dt><dd class="font-semibold">{{ t.usedCount }} / {{ t.maxUses }}</dd></div>
              <div><dt class="text-gray-500">Status</dt><dd><span class="pill capitalize" [ngClass]="stateCls(t.state)">{{ t.state }}</span></dd></div>
              <div class="col-span-2"><dt class="text-gray-500">Expires</dt><dd class="font-semibold">{{ t.expiresAt | date: 'EEE, d MMM y, h:mm a' }}</dd></div>
            </dl>
            @if (!isProdOrigin) {
              <p class="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                This QR points to {{ origin }}. Generate your printed QR from https://vcreatorclub.in so it links to the live site.
              </p>
            }
          </section>
        } @else {
          <p class="card-light p-8 text-center text-sm text-gray-500">Select a token to see its QR code.</p>
        }
      </aside>
    </div>
  `,
})
export class AdminTokensComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  protected store = inject(AdminStore);
  protected readonly I = I;
  protected qrBox = viewChild<ElementRef<HTMLDivElement>>('qrBox');

  protected tokens = signal<EnrollmentToken[]>([]);
  protected selected = signal<EnrollmentToken | null>(null);
  protected loading = signal(true);
  protected busy = signal(false);
  protected error = signal<string | null>(null);
  protected copied = signal(false);
  protected formOpen = signal(false);

  protected label = '';
  protected isEvent = false;
  protected maxUses = 1;
  protected readonly today = daysFromNow(0);
  protected expiryDate = daysFromNow(7);

  protected readonly origin = window.location.origin;
  protected readonly isProdOrigin = this.origin === 'https://vcreatorclub.in';
  protected url = computed(() => `${this.origin}/join?token=${this.selected()?.token ?? ''}`);
  protected stateCls = (s: EnrollmentToken['state']) => STATE_CLS[s];

  async ngOnInit() {
    await this.load();
    if (this.route.snapshot.queryParamMap.get('new') && this.store.canWrite()) this.formOpen.set(true);
  }

  private async load() {
    try {
      const list = await this.api.tokens();
      this.tokens.set(list);
      const sel = this.selected();
      this.selected.set(list.find((t) => t.id === sel?.id) ?? list[0] ?? null);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  protected setEvent(v: boolean) {
    this.isEvent = v;
    this.maxUses = v ? 50 : 1;
  }

  protected eventPreset() {
    this.label = 'Oct 13 Event — Sage & Lavender';
    this.setEvent(true);
    this.expiryDate = '2026-10-14';
  }

  protected async generate() {
    this.error.set(null);
    if (this.label.trim().length < 2) return this.error.set('Add a label for this token.');
    if (!this.expiryDate) return this.error.set('Choose an expiry date.');
    this.busy.set(true);
    try {
      const t = await this.api.createToken({
        label: this.label.trim(),
        isEventToken: this.isEvent,
        maxUses: Math.max(1, Math.floor(Number(this.maxUses) || 1)),
        expiresAt: new Date(`${this.expiryDate}T23:59:00+05:30`).toISOString(),
      });
      this.selected.set(t);
      this.formOpen.set(false);
      this.label = '';
      this.setEvent(false);
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async toggleActive(t: EnrollmentToken) {
    try {
      await this.api.setTokenActive(t.id, !t.isActive);
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  protected async copy() {
    try {
      await navigator.clipboard.writeText(this.url());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1800);
    } catch {
      this.error.set('Could not copy — select the link and copy it manually.');
    }
  }

  /** Print-ready PNG with the V Creator Club logo, QR, label, URL and FTPL credit. */
  protected async download(t: EnrollmentToken) {
    const qr = this.qrBox()?.nativeElement.querySelector('canvas');
    if (!qr) return;
    await document.fonts?.ready;
    const logo = new Image();
    logo.src = '/brand/logo-copper.png';
    try {
      await logo.decode();
    } catch {
      this.error.set('Could not load the V Creator Club logo for the QR poster.');
      return;
    }
    const W = 1200;
    const H = 1640;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    g.fillStyle = '#0D1B3E';
    g.fillRect(0, 0, W, H);

    g.drawImage(logo, 250, 70, 700, 122);

    g.textAlign = 'center';
    g.fillStyle = '#90CAF9';
    g.font = '600 46px "Barlow Condensed", Arial, sans-serif';
    g.fillText('SCAN TO ENROL', W / 2, 300);

    // QR on white tile
    const size = 820;
    const x = (W - size) / 2;
    const y = 350;
    g.fillStyle = '#FFFFFF';
    g.beginPath();
    g.roundRect(x - 30, y - 30, size + 60, size + 60, 36);
    g.fill();
    g.imageSmoothingEnabled = false;
    g.drawImage(qr, x, y, size, size);

    g.fillStyle = '#FFFFFF';
    g.font = '600 44px "Barlow Condensed", Arial, sans-serif';
    g.fillText((t.label ?? '').toUpperCase(), W / 2, y + size + 110, W - 120);
    g.fillStyle = '#B0BEC5';
    g.font = '400 30px Inter, Arial, sans-serif';
    g.fillText('A Creator Initiative by FTPL · Tamil Nadu', W / 2, H - 70);

    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = `vcc-qr-${(t.label || 'token').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.png`;
    a.click();
  }
}
