import { inject } from '@angular/core';
import { CanActivateFn, CanDeactivateFn, Router } from '@angular/router';
import { ApiService } from './api.service';
import { signInUrl } from './constants';

/** /dashboard: Google sign-in required; no enrollment → /join notice. */
export const creatorGuard: CanActivateFn = async (_route, state) => {
  const api = inject(ApiService);
  const router = inject(Router);
  try {
    const me = await api.me();
    if (!me.signedIn) {
      window.location.href = signInUrl(state.url);
      return false;
    }
    if (!me.profile) return router.createUrlTree(['/join'], { queryParams: { reason: 'no-profile' } });
    return true;
  } catch {
    return router.createUrlTree(['/']);
  }
};

export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (c) =>
  !c.hasUnsavedChanges() || window.confirm('You have unsaved changes. Leave this page?');
