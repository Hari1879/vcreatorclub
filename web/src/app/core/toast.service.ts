import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  kind: 'error' | 'success';
  text: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;

  error = (text: string) => this.push('error', text);
  success = (text: string) => this.push('success', text);
  dismiss = (id: number) => this.toasts.update((t) => t.filter((x) => x.id !== id));

  private push(kind: Toast['kind'], text: string) {
    const id = ++this.seq;
    this.toasts.update((t) => [...t, { id, kind, text }]);
    setTimeout(() => this.dismiss(id), 6000);
  }
}
