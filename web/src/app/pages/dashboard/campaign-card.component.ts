import { Component, computed, inject, input, output, signal } from '@angular/core';
import { DatePipe, DecimalPipe, NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { I } from '../../shared/icons';
import { SpinnerComponent } from '../../shared/ui.components';
import { ApiService, errorMessage } from '../../core/api.service';
import { Campaign } from '../../core/models';

const TYPE_CLS: Record<string, string> = {
  paid: 'bg-vcc-blue/25 text-vcc-blue-light border-vcc-blue/60',
  free: 'bg-vcc-teal/20 text-teal-300 border-vcc-teal/60',
  gifted: 'bg-vcc-gold/15 text-vcc-gold border-vcc-gold/50',
};

@Component({
  selector: 'vcc-campaign-card',
  standalone: true,
  imports: [NgClass, DatePipe, DecimalPipe, LucideAngularModule, SpinnerComponent, RouterLink],
  template: `
    @let c = campaign();
    <article class="card-dark overflow-hidden">
      <div class="flex gap-4 p-4">
        <span class="hidden h-20 w-20 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-vcc-blue-dark to-vcc-navy text-vcc-blue-light xs:grid">
          <lucide-icon [img]="I.Megaphone" [size]="34" />
        </span>
        <div class="min-w-0 flex-1">
          @if (c.product) { <p class="text-xs uppercase tracking-wider text-vcc-gray-light">{{ c.product }}</p> }
          <h3 class="text-xl font-bold leading-tight">{{ c.title }}</h3>
          <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span class="pill border capitalize" [ngClass]="typeCls()">{{ c.campaignType }}</span>
            @if (c.deadline) {
              <span class="pill border border-vcc-gray-light/30 text-vcc-gray-light">
                <lucide-icon [img]="I.CalendarDays" [size]="13" /> Deadline {{ c.deadline | date: 'MMM d' }}
              </span>
            }
            <span class="pill border border-vcc-gray-light/30 text-vcc-gray-light">{{ c.deliverables.length }} deliverable{{ c.deliverables.length === 1 ? '' : 's' }}</span>
          </div>
        </div>
      </div>

      @if (compact()) {
        <div class="px-4 pb-4">
          <a routerLink="/dashboard/campaigns" class="btn-primary px-6">View <lucide-icon [img]="I.ArrowRight" [size]="18" /></a>
        </div>
      } @else {
        @if (!open()) {
          <div class="px-4 pb-4">
            <button class="btn-primary px-6" (click)="open.set(true)">View <lucide-icon [img]="I.ArrowRight" [size]="18" /></button>
          </div>
        } @else {
          <div class="space-y-4 border-t border-vcc-blue/20 p-4">
            @if (c.description) { <p class="whitespace-pre-line text-sm text-vcc-gray-light">{{ c.description }}</p> }
            @if (c.campaignType === 'paid' && c.budgetInr) {
              <p class="text-sm"><span class="text-vcc-gray-light">Indicative budget:</span> ₹{{ c.budgetInr | number }}</p>
            }
            @if (c.deliverables.length) {
              <div>
                <p class="heading mb-2 text-sm font-bold">Deliverables</p>
                <ul class="space-y-1.5 text-sm">
                  @for (d of c.deliverables; track $index) {
                    <li class="flex gap-2"><lucide-icon [img]="I.Check" [size]="16" class="mt-0.5 text-vcc-blue-light" />{{ d }}</li>
                  }
                </ul>
              </div>
            }
            @if (error()) { <p class="text-sm text-red-300">{{ error() }}</p> }
            @if (status()) {
              <p class="flex items-center gap-2 rounded-lg bg-vcc-success/15 px-4 py-3 text-sm text-green-300">
                <lucide-icon [img]="I.CheckCircle2" [size]="18" />
                {{ status() === 'invited' ? "Interest received — the VCC team will be in touch." : 'Status: ' + status() }}
              </p>
            } @else {
              <button class="btn-primary w-full py-3" [disabled]="busy()" (click)="interested()">
                @if (busy()) { <vcc-spinner /> } @else { I'm interested }
              </button>
            }
          </div>
        }
      }
    </article>
  `,
})
export class CampaignCardComponent {
  private api = inject(ApiService);
  campaign = input.required<Campaign>();
  compact = input(false);
  interestChanged = output<void>();
  protected readonly I = I;
  protected open = signal(false);
  protected busy = signal(false);
  protected error = signal<string | null>(null);
  private localStatus = signal<string | null>(null);
  protected status = computed(() => this.localStatus() ?? this.campaign().myAssignmentStatus ?? null);
  protected typeCls = computed(() => TYPE_CLS[this.campaign().campaignType] ?? TYPE_CLS['free']);

  protected async interested() {
    this.busy.set(true);
    this.error.set(null);
    try {
      const r = await this.api.interest(this.campaign().id);
      this.localStatus.set(r.status);
      this.interestChanged.emit();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
