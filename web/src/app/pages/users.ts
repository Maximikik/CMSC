import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService, UserDto, errMsg } from '../core/api';
import { AuthService } from '../core/auth';

@Component({
  selector: 'sw-users',
  imports: [FormsModule, RouterLink],
  template: `
    <header class="top">
      <a routerLink="/" class="btn">Back to sites</a>
      <span class="sp"></span>
      <button type="button" class="btn" (click)="auth.logout()">Sign out</button>
    </header>
    <main class="page">
      <div class="page-h"><h1>Users</h1></div>
      @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
      @if (ok()) { <p class="note" role="status">{{ ok() }}</p> }

      <ul class="rows panel">
        @for (u of users(); track u.id) {
          <li>
            <span><b>{{ u.displayName }}</b> <span class="mute">{{ u.email }}</span> @if (u.isAdmin) { <span class="tag">Admin</span> }</span>
            <span class="row-gap">
              @if (resetFor() === u.id) {
                <input type="password" class="inline" [attr.aria-label]="'New password for ' + u.email" #pw placeholder="New password (10+ characters)" autocomplete="new-password">
                <button type="button" class="btn sm pri" (click)="reset(u, pw.value)">Set</button>
                <button type="button" class="btn sm" (click)="resetFor.set(null)">Cancel</button>
              } @else {
                <button type="button" class="btn sm" (click)="resetFor.set(u.id)">Reset password</button>
                @if (u.id !== auth.user()?.id) { <button type="button" class="btn sm danger" (click)="remove(u)">Delete</button> }
              }
            </span>
          </li>
        }
      </ul>

      <form class="panel form-grid" (ngSubmit)="create()" #f="ngForm">
        <h2>Add a user</h2>
        <div class="fld"><label for="un">Name</label><input id="un" name="un" type="text" [(ngModel)]="name"></div>
        <div class="fld"><label for="ue">Email</label><input id="ue" name="ue" type="email" [(ngModel)]="email" required></div>
        <div class="fld"><label for="up">Temporary password</label><input id="up" name="up" type="password" [(ngModel)]="password" required minlength="10" autocomplete="new-password"><p class="help">At least 10 characters. Ask them to change it after signing in.</p></div>
        <label class="chk"><input type="checkbox" name="ua" [(ngModel)]="isAdmin"> Administrator (can manage users and open every site)</label>
        <div><button type="submit" class="btn pri" [disabled]="busy() || f.invalid">Add user</button></div>
      </form>
    </main>
  `,
})
export class UsersPage {
  private api = inject(ApiService);
  auth = inject(AuthService);
  users = signal<UserDto[]>([]);
  error = signal(''); ok = signal(''); busy = signal(false); resetFor = signal<string | null>(null);
  name = ''; email = ''; password = ''; isAdmin = false;

  constructor() { this.refresh(); }
  private async refresh() { try { this.users.set(await firstValueFrom(this.api.users())); } catch (e) { this.error.set(errMsg(e)); } }

  async create() {
    this.busy.set(true); this.error.set(''); this.ok.set('');
    try {
      await firstValueFrom(this.api.createUser({ email: this.email, password: this.password, displayName: this.name, isAdmin: this.isAdmin }));
      this.ok.set(`Added ${this.email}.`); this.name = this.email = this.password = ''; this.isAdmin = false;
      await this.refresh();
    } catch (e) { this.error.set(errMsg(e)); } finally { this.busy.set(false); }
  }
  async reset(u: UserDto, pw: string) {
    this.error.set(''); this.ok.set('');
    try { await firstValueFrom(this.api.resetPassword(u.id, pw)); this.ok.set(`Password changed for ${u.email}.`); this.resetFor.set(null); }
    catch (e) { this.error.set(errMsg(e)); }
  }
  async remove(u: UserDto) {
    this.error.set(''); this.ok.set('');
    if (!window.confirm(`Delete ${u.email}? Their sites stay if someone else owns them.`)) return;
    try { await firstValueFrom(this.api.deleteUser(u.id)); this.ok.set(`Deleted ${u.email}.`); await this.refresh(); }
    catch (e) { this.error.set(errMsg(e)); }
  }
}
