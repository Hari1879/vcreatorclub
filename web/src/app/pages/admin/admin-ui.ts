import { Component, input, output } from '@angular/core';
import { NgClass } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { I } from '../../shared/icons';

@Component({
  selector: 'vcc-kpi',
  standalone: true,
  imports: [LucideAngularModule, NgClass],
  template: `
    <div class="card-light flex items-center gap-4 p-5">
      <span class="grid h-14 w-14 shrink-0 place-items-center rounded-full" [ngClass]="tone()">
        <lucide-icon [img]="icon()" [size]="26" />
      </span>
      <span>
        <span class="heading block text-sm font-bold text-gray-600">{{ label() }}</span>
        <span class="heading block text-4xl font-bold text-vcc-navy">{{ value() ?? '—' }}</span>
      </span>
    </div>
  `,
})
export class KpiComponent {
  label = input.required<string>();
  value = input<number | null | undefined>();
  icon = input.required<any>();
  tone = input('bg-blue-50 text-vcc-blue');
}

/** Simple centred modal. */
@Component({
  selector: 'vcc-modal',
  standalone: true,
  imports: [LucideAngularModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-vcc-navy/60 p-6 backdrop-blur-sm" (click)="closed.emit()">
      <div class="mt-10 w-full rounded-2xl bg-white shadow-2xl" [style.max-width.px]="width()" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
        <div class="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 class="text-2xl font-bold text-vcc-navy">{{ title() }}</h2>
          <button class="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" (click)="closed.emit()" aria-label="Close">
            <lucide-icon [img]="I.X" [size]="22" />
          </button>
        </div>
        <div class="px-6 py-5"><ng-content /></div>
      </div>
    </div>
  `,
  host: { '(document:keydown.escape)': 'closed.emit()' },
})
export class ModalComponent {
  title = input.required<string>();
  width = input(560);
  closed = output<void>();
  protected readonly I = I;
}
