import { DatePipe } from '@angular/common';
import { Component, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService, AssetDto, Member, VersionRow, errMsg } from '../core/api';
import { BuilderStore } from './store';
import { TEMPLATES } from './templates';
import { exportHTML } from './render';
import { slugify } from './util';
import { SiteDoc } from './model';

function download(name: string, data: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

@Component({
  selector: 'sw-dialogs',
  imports: [DatePipe],
  template: `
    @let kind = store.dialog();
    @if (store.confirmState(); as c) {
      <div class="scrim" (click)="store.answer(false)"></div>
      <div class="dlg" role="alertdialog" aria-modal="true" [attr.aria-label]="c.title">
        <h2>{{ c.title }}</h2><p>{{ c.msg }}</p>
        <div class="dlg-f"><button type="button" class="btn" (click)="store.answer(false)">Cancel</button><button type="button" class="btn pri" (click)="store.answer(true)">{{ c.ok }}</button></div>
      </div>
    } @else if (kind) {
      <div class="scrim" (click)="close()"></div>
      <div class="dlg" [class.wide]="kind === 'media' || kind === 'versions'" role="dialog" aria-modal="true">
        @switch (kind) {

          @case ('publish') {
            @let m = store.meta()!;
            <h2>Publish</h2>
            @if (m.published) {
              <p>Live now at <a [href]="m.url" target="_blank" rel="noopener">{{ m.url }}</a>@if (m.publishedAt) { <span>, published {{ m.publishedAt | date: 'medium' }}</span> }.</p>
              @if (m.unpublishedChanges) { <p class="note-warn">You have changes that are not live yet.</p> }
              @else { <p>Everything you see in the editor is live.</p> }
            } @else {
              <p>This site is not public yet. Publishing makes it available at <b>{{ publicUrl() }}</b>.</p>
            }
            <div class="fld"><label for="pubnote">Note for the version history (optional)</label><input id="pubnote" type="text" maxlength="300" #note placeholder="What changed?"></div>
            @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
            @if (done()) { <p class="note" role="status">{{ done() }}</p> }
            <div class="dlg-f">
              @if (m.published) { <button type="button" class="btn" [disabled]="busy()" (click)="unpublish()">Unpublish</button> }
              <button type="button" class="btn" (click)="close()">Close</button>
              <button type="button" class="btn pri" [disabled]="busy()" (click)="publish(note.value)">{{ busy() ? 'Publishing…' : (m.published ? 'Publish changes' : 'Publish') }}</button>
            </div>
          }

          @case ('export') {
            <h2>Export and import</h2>
            <button type="button" class="opt" (click)="exportSite()"><span><b>Download the website</b><span>One index.html with every page. Upload it to any static host.</span></span></button>
            <button type="button" class="opt" (click)="exportProject()"><span><b>Download the project file</b><span>A .json backup of this site that you can import into another site.</span></span></button>
            <div class="fld"><label for="imp">Import a project file into this site</label><input id="imp" type="file" accept=".json,application/json" (change)="importProject($event)"></div>
            @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
            @if (done()) { <p class="note" role="status">{{ done() }}</p> }
            <div class="dlg-f"><button type="button" class="btn" (click)="close()">Close</button></div>
          }

          @case ('templates') {
            <h2>Start from a template</h2>
            <p>This replaces the pages on this site. You can undo it afterwards.</p>
            @for (t of templates; track t.k) {
              <button type="button" class="opt" (click)="useTemplate(t.k)"><span><b>{{ t.n }}</b><span>{{ t.d }}</span></span></button>
            }
            <div class="dlg-f"><button type="button" class="btn" (click)="close()">Cancel</button></div>
          }

          @case ('versions') {
            <h2>Version history</h2>
            <p>Each time you publish, the site is saved here. Restoring puts that version in your draft; it does not change the live site until you publish again.</p>
            @if (loading()) { <p>Loading…</p> }
            @else if (!versions().length) { <p>Nothing published yet.</p> }
            <ul class="rows">
              @for (v of versions(); track v.number) {
                <li><span><b>Version {{ v.number }}</b> <span class="mute">{{ v.createdAt | date: 'medium' }} by {{ v.by }}</span>@if (v.note) { <br><span>{{ v.note }}</span> }</span>
                  <button type="button" class="btn sm" [disabled]="busy()" (click)="restore(v.number)">Restore</button></li>
              }
            </ul>
            @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
            <div class="dlg-f"><button type="button" class="btn" (click)="close()">Close</button></div>
          }

          @case ('members') {
            <h2>People with access</h2>
            @if (loading()) { <p>Loading…</p> }
            <ul class="rows">
              @for (m of members(); track m.userId) {
                <li><span><b>{{ m.displayName }}</b> <span class="mute">{{ m.email }}</span></span>
                  <span class="row-gap"><span class="tag">{{ m.role }}</span>
                    @if (isOwner()) { <button type="button" class="btn sm" (click)="removeMember(m)">Remove</button> }</span></li>
              }
            </ul>
            @if (isOwner()) {
              <div class="fld"><label for="mem">Add someone by email</label>
                <div class="up"><input id="mem" type="text" #email placeholder="name@example.com">
                  <select aria-label="Role" #role><option value="editor">Editor</option><option value="owner">Owner</option></select>
                  <button type="button" class="btn sm" [disabled]="busy()" (click)="addMember(email.value, role.value); email.value = ''">Add</button></div>
                <p class="help">They need an account first. Administrators create accounts under Users.</p></div>
            } @else { <p class="help">Only owners can change who has access.</p> }
            @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
            <div class="dlg-f"><button type="button" class="btn" (click)="close()">Close</button></div>
          }

          @case ('settings') {
            @let m = store.meta()!;
            <h2>Site settings</h2>
            <div class="fld"><label for="sname">Site name</label><input id="sname" type="text" [value]="m.name" #sn maxlength="120" [disabled]="m.role !== 'owner'"></div>
            <div class="fld"><label for="sslug">Address</label><input id="sslug" type="text" [value]="m.slug" #ss [disabled]="m.role !== 'owner' || m.published">
              <p class="help">{{ m.published ? 'Unpublish the site before changing its address.' : 'Published at ' + store.meta()!.publicBase + '/' + m.slug + '/' }}</p></div>
            @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
            @if (m.role === 'owner') {
              <div class="dlg-f">
                <button type="button" class="btn danger" [disabled]="busy()" (click)="deleteSite()">Delete site</button>
                <span class="sp"></span>
                <button type="button" class="btn" (click)="close()">Close</button>
                <button type="button" class="btn pri" [disabled]="busy()" (click)="saveSettings(sn.value, ss.value)">Save</button>
              </div>
            } @else { <div class="dlg-f"><button type="button" class="btn" (click)="close()">Close</button></div> }
          }

          @case ('media') {
            <h2>Image library</h2>
            <p>Pictures uploaded to this site. Pick one to use it.</p>
            @if (loading()) { <p>Loading…</p> }
            @else if (!assets().length) { <p>No uploads yet. Use Upload on an image field.</p> }
            <div class="media">
              @for (a of assets(); track a.id) {
                <figure>
                  <button type="button" class="thumb" (click)="pick(a)" [attr.aria-label]="'Use ' + a.name"><img [src]="a.url" [alt]="a.name"></button>
                  <figcaption><span>{{ a.name }}</span><button type="button" class="ib" aria-label="Delete image" (click)="removeAsset(a)">×</button></figcaption>
                </figure>
              }
            </div>
            @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
            <div class="dlg-f"><button type="button" class="btn" (click)="close()">Close</button></div>
          }
        }
      </div>
    }
  `,
})
export class DialogsComponent {
  store = inject(BuilderStore);
  private api = inject(ApiService);
  private router = inject(Router);
  templates = TEMPLATES;

  busy = signal(false);
  loading = signal(false);
  error = signal('');
  done = signal('');
  versions = signal<VersionRow[]>([]);
  members = signal<Member[]>([]);
  assets = signal<AssetDto[]>([]);

  constructor() {
    effect(() => {
      const k = this.store.dialog();
      untracked(() => {
        this.error.set(''); this.done.set('');
        if (k === 'versions') this.load(this.versions, () => firstValueFrom(this.api.versions(this.store.siteId)));
        if (k === 'members') this.load(this.members, () => firstValueFrom(this.api.members(this.store.siteId)));
        if (k === 'media') this.load(this.assets, () => firstValueFrom(this.api.assets(this.store.siteId)));
      });
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (this.store.confirmState()) this.store.answer(false); else this.close(); } });
  }
  private async load<T>(target: { set: (v: T) => void }, fn: () => Promise<T>) {
    this.loading.set(true);
    try { target.set(await fn()); } catch (e) { this.error.set(errMsg(e)); } finally { this.loading.set(false); }
  }
  close() { this.store.dialog.set(null); }
  isOwner() { return this.store.meta()?.role === 'owner'; }
  publicUrl() { const m = this.store.meta()!; return `${m.publicBase}/${m.slug}/`; }

  private async run(fn: () => Promise<void>) {
    this.busy.set(true); this.error.set(''); this.done.set('');
    try { await fn(); } catch (e: any) { this.error.set(e instanceof Error && !(e as any).status ? e.message : errMsg(e)); }
    finally { this.busy.set(false); }
  }

  publish(note: string) { return this.run(async () => { const r = await this.store.publish(note); this.done.set('Published. Visitors see the new version now.'); void r; }); }
  async unpublish() {
    if (!await this.store.confirm('Unpublish this site?', 'Visitors will see a "not found" page until you publish again. Your draft is kept.', 'Unpublish')) return;
    return this.run(async () => { await this.store.unpublish(); this.done.set('The site is no longer public.'); });
  }

  exportSite() { download(slugify(this.store.meta()!.name) + '.html', exportHTML(this.store.doc), 'text/html'); this.done.set('Downloaded the website.'); }
  exportProject() { download(slugify(this.store.meta()!.name) + '.json', JSON.stringify(this.store.doc, null, 1), 'application/json'); this.done.set('Downloaded the project file.'); }
  async importProject(e: Event) {
    const inp = e.target as HTMLInputElement, f = inp.files?.[0];
    if (!f) return;
    this.error.set('');
    try {
      const j = JSON.parse(await f.text()) as SiteDoc;
      if (!j || !Array.isArray(j.pages) || !j.pages.length || !j.theme) throw new Error('bad');
      const name = this.store.doc.name;
      this.store.mutate(() => { this.store.doc = { ...j, name }; this.store.pageId.set(j.pages[0].id); this.store.sel.set(null); });
      this.close();
      this.store.notify('Project imported. You can undo it.');
    } catch { this.error.set('That file is not a Sitewright project.'); }
    finally { inp.value = ''; }
  }
  useTemplate(k: string) { this.store.applyTemplate(k); this.close(); this.store.notify('Template applied. You can undo it.'); }

  async restore(n: number) {
    if (!await this.store.confirm('Restore version ' + n + '?', 'Your current draft will be replaced by this version. The live site does not change until you publish.', 'Restore')) return;
    return this.run(async () => {
      await this.store.saveNow();
      await firstValueFrom(this.api.restore(this.store.siteId, n));
      await this.store.reloadFromServer();
      this.close();
      this.store.notify('Version ' + n + ' restored to your draft.');
    });
  }

  addMember(email: string, role: string) {
    if (!email.trim()) return;
    return this.run(async () => { await firstValueFrom(this.api.addMember(this.store.siteId, email.trim(), role)); this.members.set(await firstValueFrom(this.api.members(this.store.siteId))); });
  }
  async removeMember(m: Member) {
    if (!await this.store.confirm('Remove ' + m.displayName + '?', 'They will no longer be able to open this site.', 'Remove')) return;
    return this.run(async () => { await firstValueFrom(this.api.removeMember(this.store.siteId, m.userId)); this.members.set(await firstValueFrom(this.api.members(this.store.siteId))); });
  }

  saveSettings(name: string, slug: string) {
    return this.run(async () => {
      const m = this.store.meta()!;
      const patch: { name?: string; slug?: string } = {};
      if (name.trim() !== m.name) patch.name = name.trim();
      if (!m.published && slug.trim() !== m.slug) patch.slug = slug.trim();
      if (!patch.name && !patch.slug) { this.close(); return; }
      const r = await firstValueFrom(this.api.renameSite(m.id, patch));
      this.store.meta.update(x => x && { ...x, name: r.name, slug: r.slug });
      this.close();
    });
  }
  async deleteSite() {
    const m = this.store.meta()!;
    if (!await this.store.confirm('Delete "' + m.name + '"?', 'The site, its published copy and its uploaded images are removed for good. This cannot be undone.', 'Delete site')) return;
    return this.run(async () => { await firstValueFrom(this.api.deleteSite(m.id)); this.close(); this.router.navigate(['/']); });
  }

  pick(a: AssetDto) {
    const t = this.store.mediaTarget;
    if (t) this.store.setValue(t.root, t.path, a.url);
    this.close();
  }
  async removeAsset(a: AssetDto) {
    if (!await this.store.confirm('Delete this image?', 'Anywhere it is used will show a broken picture until you pick another.', 'Delete image')) return;
    return this.run(async () => { await firstValueFrom(this.api.deleteAsset(this.store.siteId, a.id)); this.assets.update(l => l.filter(x => x.id !== a.id)); });
  }
}
