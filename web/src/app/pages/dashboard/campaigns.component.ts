import { RouterLink } from '@angular/router';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ApiService, errorMessage } from '../../core/api.service';
import { Campaign } from '../../core/models';
import { SpinnerComponent } from '../../shared/ui.components';
import { CampaignCardComponent } from './campaign-card.component';

@Component({
  selector: 'vcc-creator-campaigns',
  standalone: true,
  imports: [RouterLink, CampaignCardComponent, SpinnerComponent],
  template: `
    <div class="mb-5 flex items-center justify-between gap-3">
      <h1 class="text-4xl font-bold">Campaigns</h1>
      <a routerLink="/co-create" class="btn-primary px-4 py-2 text-sm">Co-Create</a>
    </div>
    @if (loading()) {
      <div class="grid place-items-center py-16"><vcc-spinner [size]="30" /></div>
    } @else if (error()) {
      <p class="card-dark p-5 text-center text-sm text-red-300">{{ error() }}</p>
    } @else {
      @for (c of campaigns(); track c.id) {
        <vcc-campaign-card [campaign]="c" class="mb-4 block" />
      } @empty {
        <p class="card-dark p-6 text-center text-vcc-gray-light">No campaigns available right now. Check back soon.</p>
      }
    }
  `,
})
export class CreatorCampaignsComponent implements OnInit {
  private api = inject(ApiService);
  protected campaigns = signal<Campaign[]>([]);
  protected loading = signal(true);
  protected error = signal<string | null>(null);

  async ngOnInit() {
    try {
      this.campaigns.set(await this.api.myCampaigns());
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
}
