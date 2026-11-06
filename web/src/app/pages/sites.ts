import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService, SiteSummary, errMsg } from '../core/api';
import { AuthService } from '../core/auth';
import { TEMPLATES } from '../builder/templates';

@Component({
  selector: 'sw-sites',
  imports: [FormsModule, RouterLink, DatePipe],
  template: `
    <header class="top">
      <div class="logo"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4H5v16h3M16 4h3v16h-3"/><path d="M10 9h4M10 15h4"/></svg>Sitewright</div>
      <span class="sp"></span>
      <span class="mute">{{ auth.user()?.displayName }}</span>
      @if (auth.isAdmin()) { <a routerLink="/users" class="btn">Users</a> }
      <button type="button" class="btn" (click)="pwOpen.set(true)">Password</button>
      <button type="button" class="btn" (click)="auth.logout()">Sign out</button>
    </header>
    <main class="page">
      <div class="page-h">
        <h1>Your sites</h1>
        <button type="button" class="btn pri" (click)="newOpen.set(true)">New site</button>
      </div>
      @if (loading()) { <p class="mute">Loading…</p> }
      @else if (error()) { <p class="err" role="alert">{{ error() }}</p> }
      @else if (!sites().length) {
        <div class="empty-state">
          <h2>No sites yet</h2>
          <p>Start from a template with a few pages already wired up, or from a blank page.</p>
          <button type="button" class="btn pri" (click)="newOpen.set(true)">Create your first site</button>
        </div>
      } @else {
        <ul class="site-grid">
          @for (s of sites(); track s.id) {
            <li class="site-card">
              <a [routerLink]="['/sites', s.id]" class="site-open">
                <b>{{ s.name }}</b>
                <span class="mute">/{{ s.slug }}</span>
              </a>
              <div class="site-meta">
                <span class="pill" [class.live]="s.published">{{ s.published ? 'Published' : 'Draft' }}</span>
                <span class="mute">Edited {{ s.updatedAt | date: 'mediumDate' }}</span>
                @if (s.role === 'editor') { <span class="mute">Editor</span> }
              </div>
              @if (s.url) { <a [href]="s.url" target="_blank" rel="noopener" class="site-url">{{ s.url }}</a> }
            </li>
          }
        </ul>
      }
    </main>

    @if (newOpen()) {
      <div class="scrim" (click)="newOpen.set(false)"></div>
      <form class="dlg wide" (ngSubmit)="create()" role="dialog" aria-modal="true" aria-label="New site">
        <h2>New site</h2>
        <div class="fld"><label for="nn">Site name</label><input id="nn" name="nn" type="text" [(ngModel)]="newName" required maxlength="120" placeholder="Northlight Studio"></div>
        <div class="fld"><span class="lbl">Start from</span>
          <div class="tpl-grid">
            @for (t of templates; track t.k) {
              <label class="tpl" [class.on]="tpl === t.k"><input type="radio" name="tpl" class="vh" [value]="t.k" [(ngModel)]="tpl"><b>{{ t.n }}</b><span>{{ t.d }}</span></label>
            }
          </div>
        </div>
        @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
        <div class="dlg-f"><button type="button" class="btn" (click)="newOpen.set(false)">Cancel</button><button type="submit" class="btn pri" [disabled]="busy() || !newName.trim()">{{ busy() ? 'Creating…' : 'Create site' }}</button></div>
      </form>
    }

    @if (pwOpen()) {
      <div class="scrim" (click)="pwOpen.set(false)"></div>
      <form class="dlg" (ngSubmit)="changePw()" role="dialog" aria-modal="true" aria-label="Change password">
        <h2>Change password</h2>
        <div class="fld"><label for="cp">Current password</label><input id="cp" name="cp" type="password" [(ngModel)]="cur" required autocomplete="current-password"></div>
        <div class="fld"><label for="np">New password</label><input id="np" name="np" type="password" [(ngModel)]="next" required minlength="10" autocomplete="new-password"><p class="help">At least 10 characters.</p></div>
        @if (pwMsg()) { <p [class]="pwOk() ? 'note' : 'err'" role="alert">{{ pwMsg() }}</p> }
        <div class="dlg-f"><button type="button" class="btn" (click)="pwOpen.set(false)">Close</button><button type="submit" class="btn pri" [disabled]="busy()">Change password</button></div>
      </form>
    }
  `,
})
export class SitesPage {
  private api = inject(ApiService);
  private router = inject(Router);
  auth = inject(AuthService);
  templates = TEMPLATES;
  sites = signal<SiteSummary[]>([]);
  loading = signal(true); error = signal(''); busy = signal(false);
  newOpen = signal(false); newName = ''; tpl = 'portfolio';
  pwOpen = signal(false); pwMsg = signal(''); pwOk = signal(false); cur = ''; next = '';

  constructor() {
    firstValueFrom(this.api.sites()).then(s => this.sites.set(s)).catch(e => this.error.set(errMsg(e))).finally(() => this.loading.set(false));
  }

  async create() {
    this.busy.set(true); this.error.set('');
    try {
      const name = this.newName.trim();
      const doc = TEMPLATES.find(t => t.k === this.tpl)!.make();
      doc.name = name;
      if (doc.pages[0]) doc.pages[0].blocks.forEach(b => { if (b.type === 'navbar' && this.tpl === 'blank') b.p['brand'] = name; });
      const s = await firstValueFrom(this.api.createSite(name, doc));
      await this.router.navigate(['/sites', s.id]);
    } catch (e) { this.error.set(errMsg(e, 'The site could not be created.')); }
    finally { this.busy.set(false); }
  }

  async changePw() {
    this.busy.set(true); this.pwMsg.set('');
    try { await firstValueFrom(this.api.changePassword(this.cur, this.next)); this.pwOk.set(true); this.pwMsg.set('Password changed.'); this.cur = this.next = ''; }
    catch (e) { this.pwOk.set(false); this.pwMsg.set(errMsg(e, 'The password could not be changed.')); }
    finally { this.busy.set(false); }
  }
}
