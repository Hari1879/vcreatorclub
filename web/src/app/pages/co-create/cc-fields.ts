import { Component, input } from '@angular/core';
import { AbstractControl, FormControl, ReactiveFormsModule } from '@angular/forms';
import { Option, displayDate } from './co-create.logic';

/** Message to show for a control, or null. Errors appear once the field is touched/dirty (or the server flagged it). */
export function controlError(c: AbstractControl | null | undefined): string | null {
  if (!c || c.valid || c.disabled || !(c.touched || c.dirty || c.errors?.['server'])) return null;
  const e = c.errors ?? {};
  if (e['server']) return e['server'];
  if (e['msg']) return e['msg'];
  if (e['required']) return 'This field is required';
  if (e['maxlength']) return `Maximum ${e['maxlength'].requiredLength} characters`;
  return 'Please check this value';
}

@Component({
  selector: 'cc-text',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="mb-5">
      <label class="field-label" [for]="'f-' + id()">{{ label() }}@if (optional()) { <span class="font-normal text-vcc-gray-light"> (optional)</span> }</label>
      @if (hint()) { <p class="mb-1.5 text-xs text-vcc-gray-light" [id]="'h-' + id()">{{ hint() }}</p> }
      @switch (kind()) {
        @case ('textarea') {
          <textarea class="input-dark min-h-[96px]" [id]="'f-' + id()" [formControl]="control()" [attr.maxlength]="max()" rows="3"
            [attr.aria-invalid]="!!error()" [attr.aria-describedby]="'e-' + id()" (blur)="control().markAsTouched()"></textarea>
        }
        @case ('date') {
          <input class="input-dark" type="date" [id]="'f-' + id()" [formControl]="control()" [attr.min]="min()"
            [attr.aria-invalid]="!!error()" [attr.aria-describedby]="'e-' + id()" (blur)="control().markAsTouched()" />
          @if (control().value) { <p class="mt-1 text-xs text-vcc-gray-light">{{ dateText() }}</p> }
        }
        @case ('number') {
          <input class="input-dark" type="number" inputmode="numeric" min="0" step="1" [id]="'f-' + id()" [formControl]="control()"
            [attr.aria-invalid]="!!error()" [attr.aria-describedby]="'e-' + id()" (blur)="control().markAsTouched()" />
        }
        @default {
          <input class="input-dark" [class.uppercase]="upper()" [id]="'f-' + id()" [formControl]="control()" [attr.maxlength]="max()"
            [type]="kind() === 'password' ? 'password' : 'text'" [attr.inputmode]="digits() ? 'numeric' : null" autocomplete="off"
            [attr.aria-invalid]="!!error()" [attr.aria-describedby]="'e-' + id()" (input)="clean($event)" (blur)="control().markAsTouched()" />
        }
      }
      <div class="flex justify-between gap-3">
        <p class="field-error" [id]="'e-' + id()" role="alert">{{ error() }}</p>
        @if (max() && (kind() === 'textarea' || kind() === 'text')) {
          <p class="mt-1 shrink-0 text-xs text-vcc-gray-light" aria-live="polite">{{ (control().value ?? '').length }} / {{ max() }}</p>
        }
      </div>
    </div>
  `,
})
export class CcTextComponent {
  id = input.required<string>();
  label = input.required<string>();
  control = input.required<FormControl<any>>();
  kind = input<'text' | 'textarea' | 'number' | 'date' | 'password'>('text');
  max = input<number | null>(null);
  hint = input('');
  min = input<string | null>(null);
  optional = input(false);
  digits = input(false);
  upper = input(false);
  protected error = () => controlError(this.control());
  protected dateText = () => displayDate(this.control().value);

  protected clean(e: Event) {
    const el = e.target as HTMLInputElement;
    let v = el.value;
    if (this.digits()) v = v.replace(/\D/g, '');
    if (this.upper()) v = v.toUpperCase().replace(/\s/g, '');
    if (v !== el.value) {
      el.value = v;
      this.control().setValue(v);
    }
  }
}

@Component({
  selector: 'cc-choice',
  standalone: true,
  template: `
    <fieldset class="mb-5" [attr.aria-describedby]="'e-' + id()" [id]="'f-' + id()" tabindex="-1">
      <legend class="field-label">{{ label() }}</legend>
      @if (hint()) { <p class="mb-1.5 text-xs text-vcc-gray-light">{{ hint() }}</p> }
      <div [class]="options().length > 4 ? 'grid gap-2 sm:grid-cols-2' : 'grid gap-2'">
        @for (o of options(); track o.value) {
          <label [class]="'flex cursor-pointer items-start gap-3 rounded-lg border bg-vcc-navy-deep/40 px-3 py-2.5 text-sm ' + (isOn(o.value) ? 'border-vcc-blue' : 'border-vcc-blue/20') + (isDisabled(o.value) ? ' opacity-50' : '')">
            <input [type]="multi() ? 'checkbox' : 'radio'" class="mt-0.5 h-4 w-4 accent-[#0D6EFD]" [name]="id()" [checked]="isOn(o.value)"
              [disabled]="control().disabled || isDisabled(o.value)" (change)="toggle(o.value, $event)" (blur)="control().markAsTouched()" />
            <span>{{ o.label }}</span>
          </label>
        }
      </div>
      <p class="field-error" [id]="'e-' + id()" role="alert">{{ error() }}</p>
    </fieldset>
  `,
})
export class CcChoiceComponent {
  id = input.required<string>();
  label = input.required<string>();
  control = input.required<FormControl<any>>();
  options = input.required<Option<any>[]>();
  multi = input(false);
  hint = input('');
  disabledValues = input<unknown[]>([]);
  protected error = () => controlError(this.control());
  protected isDisabled = (v: unknown) => this.disabledValues().includes(v);
  protected isOn = (v: unknown) => {
    const cur = this.control().value;
    return this.multi() ? Array.isArray(cur) && cur.includes(v) : cur === v;
  };
  protected toggle(v: unknown, e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    const c = this.control();
    if (this.multi()) {
      const cur: unknown[] = c.value ?? [];
      c.setValue(checked ? [...cur, v] : cur.filter((x) => x !== v));
    } else {
      c.setValue(v);
    }
    c.markAsDirty();
    c.markAsTouched();
  }
}

@Component({
  selector: 'cc-check',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="mb-5">
      <label class="flex cursor-pointer items-start gap-3 text-sm">
        <input type="checkbox" class="mt-0.5 h-4 w-4 accent-[#0D6EFD]" [id]="'f-' + id()" [formControl]="control()"
          [attr.aria-describedby]="'e-' + id()" (blur)="control().markAsTouched()" />
        <span>{{ label() }}</span>
      </label>
      <p class="field-error" [id]="'e-' + id()" role="alert">{{ error() }}</p>
    </div>
  `,
})
export class CcCheckComponent {
  id = input.required<string>();
  label = input.required<string>();
  control = input.required<FormControl<any>>();
  protected error = () => controlError(this.control());
}
