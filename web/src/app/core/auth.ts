import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ApiService, AuthResult, UserDto } from './api';

const KEY = 'sitewright.token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private router = inject(Router);
  token = signal<string | null>(read());
  user = signal<UserDto | null>(null);
  isAdmin = computed(() => !!this.user()?.isAdmin);

  /** Called once before the first protected route: validates a stored token and loads the profile. */
  async init(): Promise<boolean> {
    if (!this.token()) return false;
    if (this.user()) return true;
    try { this.user.set(await firstValueFrom(this.api.me())); return true; }
    catch { this.clear(); return false; }
  }
  accept(r: AuthResult) {
    try { localStorage.setItem(KEY, r.token); } catch { /* private mode: stay signed in for this tab only */ }
    this.token.set(r.token);
    this.user.set(r.user);
  }
  logout() { this.clear(); this.router.navigate(['/login']); }
  clear() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } this.token.set(null); this.user.set(null); }
}
function read() { try { return localStorage.getItem(KEY); } catch { return null; } }

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const t = auth.token();
  const r = t && req.url.startsWith('/api/') ? req.clone({ setHeaders: { Authorization: `Bearer ${t}` } }) : req;
  return next(r).pipe(tap({
    error: (e: unknown) => {
      // An expired or revoked token on a normal call sends you back to the sign-in page.
      if (e instanceof HttpErrorResponse && e.status === 401 && !req.url.includes('/api/auth/login')) auth.logout();
    },
  }));
};

export const authGuard: CanActivateFn = async () => {
  // inject() only works before the first await, so grab everything up front.
  const auth = inject(AuthService), router = inject(Router);
  return (await auth.init()) ? true : router.createUrlTree(['/login']);
};
export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService), router = inject(Router);
  return (await auth.init()) && auth.isAdmin() ? true : router.createUrlTree(['/']);
};
