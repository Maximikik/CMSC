import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService, errMsg } from '../core/api';
import { AuthService } from '../core/auth';

@Component({
  selector: 'sw-login',
  imports: [FormsModule],
  template: `
    <main class="auth">
      <form class="auth-card" (ngSubmit)="submit()" #f="ngForm">
        <div class="logo big"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4H5v16h3M16 4h3v16h-3"/><path d="M10 9h4M10 15h4"/></svg>Sitewright</div>
        @if (loading()) { <p class="mute">Checking the server…</p> }
        @else {
          <h1>{{ first() ? 'Create the administrator account' : creating() ? 'Create your account' : 'Sign in' }}</h1>
          @if (first()) { <p class="mute">This is the first start. The account you create now can manage sites and other users.</p> }
          @if (first() || creating()) {
            <div class="fld"><label for="dn">Your name</label><input id="dn" name="dn" type="text" [(ngModel)]="displayName" autocomplete="name"></div>
          }
          <div class="fld"><label for="em">Email</label><input id="em" name="em" type="email" [(ngModel)]="email" required autocomplete="username"></div>
          <div class="fld"><label for="pw">Password</label><input id="pw" name="pw" type="password" [(ngModel)]="password" required [minlength]="first() || creating() ? 10 : 1" [autocomplete]="first() || creating() ? 'new-password' : 'current-password'">
            @if (first() || creating()) { <p class="help">At least 10 characters. A few words in a row works well.</p> }</div>
          @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
          <button type="submit" class="btn pri wide" [disabled]="busy() || f.invalid">{{ busy() ? 'One moment…' : first() || creating() ? 'Create account' : 'Sign in' }}</button>
          @if (!first() && allowReg()) {
            <button type="button" class="link" (click)="creating.set(!creating())">{{ creating() ? 'I already have an account' : 'Create an account' }}</button>
          }
        }
      </form>
    </main>
  `,
})
export class LoginPage {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);
  email = ''; password = ''; displayName = '';
  loading = signal(true); first = signal(false); allowReg = signal(false); creating = signal(false);
  busy = signal(false); error = signal('');

  constructor() {
    firstValueFrom(this.api.status())
      .then(s => { this.first.set(!s.hasUsers); this.allowReg.set(s.allowRegistration); })
      .catch(e => this.error.set(errMsg(e, 'The server is not answering.')))
      .finally(() => this.loading.set(false));
  }

  async submit() {
    this.busy.set(true); this.error.set('');
    try {
      const reg = this.first() || this.creating();
      const r = await firstValueFrom(reg ? this.api.register(this.email, this.password, this.displayName) : this.api.login(this.email, this.password));
      this.auth.accept(r);
      await this.router.navigate(['/']);
    } catch (e) { this.error.set(errMsg(e, 'Could not sign in.')); }
    finally { this.busy.set(false); }
  }
}
