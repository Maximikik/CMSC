import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService, SiteDetail, errMsg } from '../core/api';
import { Block, SiteDoc } from './model';
import { exportHTML } from './render';
import { TYPES, blk, blockLabel, newAct } from './types';
import { getPath, setPath, slugify, uid } from './util';
import { TEMPLATES } from './templates';

export type Root = 'b' | 's' | 'g';
export type SaveState = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Everything about the site being edited. One instance per open editor. */
@Injectable()
export class BuilderStore {
  private api = inject(ApiService);

  siteId = '';
  doc!: SiteDoc;
  version = 0;
  meta = signal<SiteDetail | null>(null);
  loaded = signal(false);
  loadError = signal('');

  /** rev changes whenever anything the panels show may have changed; canvasRev only when the canvas must be redrawn. */
  rev = signal(0);
  canvasRev = signal(0);

  pageId = signal('');
  sel = signal<string | null>(null);
  mode = signal<'edit' | 'preview'>('edit');
  device = signal<'desktop' | 'tablet' | 'mobile'>('desktop');
  tab = signal<'content' | 'style' | 'actions'>('content');
  pane = signal<'left' | 'canvas' | 'right'>('canvas');

  save = signal<SaveState>('saved');
  saveMsg = signal('');
  canUndo = signal(false);
  canRedo = signal(false);
  dialog = signal<string | null>(null);
  toastMsg = signal('');
  /** Which field the media library dialog should fill when you pick an image. */
  mediaTarget: { root: Root; path: string } | null = null;
  confirmState = signal<{ title: string; msg: string; ok: string; resolve: (v: boolean) => void } | null>(null);

  canPublish = computed(() => this.meta() !== null);

  private hist: string[] = [];
  private fut: string[] = [];
  private lastKey = '';
  private lastT = 0;
  private dirty = false;
  private inflight = false;
  private timer: any;
  private retry: any;
  private toastTimer: any;

  /* ---------- loading ---------- */
  async load(id: string) {
    this.siteId = id;
    try {
      const s = await firstValueFrom(this.api.site(id));
      this.doc = s.document;
      this.version = s.version;
      this.meta.set(s);
      this.pageId.set(this.doc.pages[0].id);
      this.loaded.set(true);
      this.bump(true);
    } catch (e) {
      this.loadError.set((e as any)?.status === 404 ? 'This site does not exist, or you do not have access to it.' : errMsg(e, 'The site could not be loaded.'));
    }
  }
  hasUnsaved() { return this.dirty || this.inflight; }

  /* ---------- reading ---------- */
  page() { return this.doc.pages.find(p => p.id === this.pageId()) ?? this.doc.pages[0]; }
  selected(): Block | null { const id = this.sel(); return id ? this.page().blocks.find(b => b.id === id) ?? null : null; }
  blockOptions(only?: string): [string, string][] { return this.page().blocks.filter(b => !only || b.type === only).map(b => [b.id, blockLabel(b)]); }
  rootObj(r: Root): any { return r === 'b' ? this.selected() : r === 's' ? this.doc : this.page(); }

  /* ---------- changing ---------- */
  private bump(canvas: boolean) { this.rev.update(v => v + 1); if (canvas) this.canvasRev.update(v => v + 1); }
  touch() { this.rev.update(v => v + 1); }

  /**
   * Every change goes through here: it records an undo step, schedules a save and refreshes the views.
   * Edits with the same key within 1.2 s (typing) collapse into one undo step.
   */
  mutate(fn: () => void, o: { key?: string; canvas?: boolean; silent?: boolean } = {}) {
    const now = Date.now();
    if (!(o.key && o.key === this.lastKey && now - this.lastT < 1200)) {
      this.hist.push(JSON.stringify(this.doc));
      if (this.hist.length > 80) this.hist.shift();
      this.fut = [];
    }
    this.lastKey = o.key ?? '';
    this.lastT = now;
    fn();
    this.canUndo.set(this.hist.length > 0);
    this.canRedo.set(false);
    this.scheduleSave();
    if (!o.silent) this.bump(o.canvas !== false);
  }
  setValue(root: Root, path: string, val: any, key?: string) {
    const o = this.rootObj(root);
    if (!o) return;
    this.mutate(() => setPath(o, path, val), { key: key ?? 'v:' + root + path });
  }
  typeInCanvas(blockId: string, path: string, val: string) {
    const b = this.page().blocks.find(x => x.id === blockId);
    if (!b) return;
    this.mutate(() => setPath(b.p, path, val), { key: 'ed:' + blockId + path, silent: true });
  }
  retypeAction(i: number, type: string) { const b = this.selected(); if (b) this.mutate(() => { b.actions[i] = newAct(type); }); }
  addAction(type: string) { const b = this.selected(); if (b) this.mutate(() => { b.actions.push(newAct(type)); }); }

  listArr(root: Root, path: string): any[] { return getPath(this.rootObj(root), path); }
  /** Adds a new row to a list field (links, cards, questions...) using the field's own `make` function. */
  listAdd(path: string, key: string) {
    const b = this.selected();
    if (!b) return;
    const make = TYPES[b.type].fields.find(f => f.k === key)?.make;
    const arr = getPath(b, path);
    if (make && Array.isArray(arr)) this.mutate(() => { arr.push(make(this.doc)); });
  }
  listRemove(root: Root, path: string, i: number) { const a = this.listArr(root, path); this.mutate(() => { a.splice(i, 1); }); }
  listMove(root: Root, path: string, i: number, dir: number) {
    const a = this.listArr(root, path); const j = i + dir;
    if (j < 0 || j >= a.length) return;
    this.mutate(() => { [a[i], a[j]] = [a[j], a[i]]; });
  }

  /* ---------- blocks ---------- */
  select(id: string | null) { this.sel.set(id); }
  addBlock(type: string, idx?: number) {
    const b = blk(type, {}, {}, this.doc);
    this.mutate(() => {
      const a = this.page().blocks;
      const sel = this.sel();
      const i = idx ?? (sel ? a.findIndex(x => x.id === sel) + 1 : a.length);
      a.splice(i, 0, b);
      this.sel.set(b.id);
    });
    this.tab.set('content');
    return b.id;
  }
  deleteBlock(id: string) { this.mutate(() => { const a = this.page().blocks; a.splice(a.findIndex(b => b.id === id), 1); if (this.sel() === id) this.sel.set(null); }); }
  duplicateBlock(id: string) {
    this.mutate(() => {
      const a = this.page().blocks; const i = a.findIndex(b => b.id === id);
      const c: Block = JSON.parse(JSON.stringify(a[i])); c.id = uid();
      a.splice(i + 1, 0, c); this.sel.set(c.id);
    });
  }
  moveBlock(id: string, to: number) {
    this.mutate(() => {
      const a = this.page().blocks; const i = a.findIndex(b => b.id === id);
      if (i < 0) return;
      const [b] = a.splice(i, 1);
      if (to > i) to--;
      a.splice(Math.max(0, Math.min(to, a.length)), 0, b);
    });
  }
  nudge(id: string, d: number) {
    const a = this.page().blocks; const i = a.findIndex(b => b.id === id); const j = i + d;
    if (i < 0 || j < 0 || j >= a.length) return;
    this.mutate(() => { [a[i], a[j]] = [a[j], a[i]]; });
  }

  /* ---------- pages ---------- */
  uniqueSlug(base: string, exceptId?: string) {
    let s = base, n = 2;
    while (this.doc.pages.some(p => p.slug === s && p.id !== exceptId)) s = base + '-' + n++;
    return s;
  }
  switchPage(id: string) { this.pageId.set(id); this.sel.set(null); this.bump(true); }
  addPage() {
    const n = this.doc.pages.length + 1, id = 'pg_' + uid();
    const first = this.doc.pages[0];
    const clone = (b: Block): Block => ({ ...JSON.parse(JSON.stringify(b)), id: uid() });
    const nav = first.blocks.find(b => b.type === 'navbar'), foot = first.blocks.find(b => b.type === 'footer');
    const blocks: Block[] = [];
    if (nav) blocks.push(clone(nav));
    blocks.push(blk('heading', { text: 'Page ' + n, level: '1' }), blk('text'));
    if (foot) blocks.push(clone(foot));
    this.mutate(() => { this.doc.pages.push({ id, name: 'Page ' + n, slug: this.uniqueSlug('page-' + n), title: '', blocks }); this.pageId.set(id); this.sel.set(null); });
  }
  duplicatePage(id: string) {
    this.mutate(() => {
      const src = this.doc.pages.find(p => p.id === id)!;
      const c = JSON.parse(JSON.stringify(src)); const map: Record<string, string> = {};
      c.id = 'pg_' + uid(); c.name = src.name + ' copy'; c.slug = this.uniqueSlug(src.slug + '-copy');
      c.blocks.forEach((b: Block) => { const n = uid(); map[b.id] = n; b.id = n; });
      c.blocks.forEach((b: Block) => b.actions.forEach(a => { if (a['target'] && map[a['target']]) a['target'] = map[a['target']]; }));
      this.doc.pages.splice(this.doc.pages.indexOf(src) + 1, 0, c);
      this.pageId.set(c.id); this.sel.set(null);
    });
  }
  async deletePage(id: string) {
    if (this.doc.pages.length < 2) return;
    const p = this.doc.pages.find(x => x.id === id)!;
    if (!await this.confirm('Delete page?', `"${p.name}" and everything on it will be removed. You can undo this.`, 'Delete page')) return;
    this.mutate(() => {
      this.doc.pages = this.doc.pages.filter(x => x.id !== id);
      const home = this.doc.pages[0].id;
      this.doc.pages.forEach(pg => pg.blocks.forEach(b => {
        (b.p['links'] ?? []).forEach((l: any) => { if (l.page === id) l.page = home; });
        b.actions.forEach(a => { if (a.type === 'goto' && a['page'] === id) a['page'] = home; });
      }));
      if (this.pageId() === id) this.pageId.set(home);
      this.sel.set(null);
    });
  }
  setSlug(value: string) {
    const pg = this.page();
    this.mutate(() => { pg.slug = this.uniqueSlug(slugify(value), pg.id); });
  }
  makeHome() { const p = this.page(); this.mutate(() => { this.doc.pages = [p, ...this.doc.pages.filter(x => x !== p)]; }); }

  /* ---------- history ---------- */
  undo() {
    if (!this.hist.length) return;
    this.fut.push(JSON.stringify(this.doc));
    this.doc = JSON.parse(this.hist.pop()!);
    this.afterHistory();
  }
  redo() {
    if (!this.fut.length) return;
    this.hist.push(JSON.stringify(this.doc));
    this.doc = JSON.parse(this.fut.pop()!);
    this.afterHistory();
  }
  private afterHistory() {
    this.lastKey = '';
    if (!this.doc.pages.some(p => p.id === this.pageId())) this.pageId.set(this.doc.pages[0].id);
    if (!this.selected()) this.sel.set(null);
    this.canUndo.set(this.hist.length > 0);
    this.canRedo.set(this.fut.length > 0);
    this.scheduleSave();
    this.bump(true);
  }
  applyTemplate(key: string) {
    const t = TEMPLATES.find(x => x.k === key); if (!t) return;
    const name = this.doc.name;
    this.mutate(() => { const d = t.make(); d.name = name; this.doc = d; this.pageId.set(d.pages[0].id); this.sel.set(null); });
  }

  /* ---------- saving ---------- */
  private scheduleSave() {
    this.dirty = true;
    if (this.save() === 'conflict') return;
    this.save.set('dirty');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 700);
  }
  private async flush() {
    if (this.inflight || !this.dirty || this.save() === 'conflict') return;
    this.inflight = true; this.dirty = false; this.save.set('saving');
    try {
      const r = await firstValueFrom(this.api.saveDraft(this.siteId, this.version, this.doc));
      this.version = r.version;
      this.meta.update(m => m && { ...m, unpublishedChanges: m.published });
      this.save.set(this.dirty ? 'dirty' : 'saved');
    } catch (e: any) {
      if (e?.status === 409) { this.save.set('conflict'); this.saveMsg.set(errMsg(e)); }
      else if (e?.status === 400) { this.dirty = true; this.save.set('error'); this.saveMsg.set(errMsg(e)); }
      else { this.dirty = true; this.save.set('error'); this.saveMsg.set(errMsg(e)); clearTimeout(this.retry); this.retry = setTimeout(() => { if (this.save() === 'error') this.flush(); }, 5000); }
    } finally {
      this.inflight = false;
      if (this.dirty && this.save() === 'dirty') { clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 300); }
    }
  }
  retrySave() { if (this.save() === 'error') { this.save.set('dirty'); this.flush(); } }
  /** Waits until the server has the latest edits. Throws with a readable message when it cannot. */
  async saveNow() {
    clearTimeout(this.timer);
    for (let i = 0; i < 100; i++) {
      if (this.save() === 'conflict') throw new Error(this.saveMsg());
      if (!this.inflight && !this.dirty) return;
      if (this.save() === 'error') this.save.set('dirty');
      if (!this.inflight) await this.flush(); else await sleep(80);
      if (this.save() === 'error') throw new Error(this.saveMsg());
    }
    throw new Error('Saving took too long. Try again.');
  }

  /* ---------- publishing ---------- */
  async publish(note: string) {
    await this.saveNow();
    const html = exportHTML(this.doc);
    const r = await firstValueFrom(this.api.publish(this.siteId, this.version, html, note));
    this.meta.update(m => m && { ...m, published: true, url: r.url, publishedAt: r.publishedAt, unpublishedChanges: false });
    return r;
  }
  async unpublish() {
    await firstValueFrom(this.api.unpublish(this.siteId));
    this.meta.update(m => m && { ...m, published: false, url: null, publishedAt: null, unpublishedChanges: false });
  }
  /** After restoring an older version the server draft changed under us, so reload the document. */
  async reloadFromServer() {
    const s = await firstValueFrom(this.api.site(this.siteId));
    this.doc = s.document; this.version = s.version; this.meta.set(s);
    this.dirty = false; this.hist = []; this.fut = []; this.canUndo.set(false); this.canRedo.set(false);
    this.save.set('saved'); this.lastKey = '';
    if (!this.doc.pages.some(p => p.id === this.pageId())) this.pageId.set(this.doc.pages[0].id);
    this.sel.set(null); this.bump(true);
  }

  /* ---------- small UI helpers ---------- */
  confirm(title: string, msg: string, ok: string) {
    return new Promise<boolean>(resolve => this.confirmState.set({ title, msg, ok, resolve }));
  }
  answer(v: boolean) { const c = this.confirmState(); this.confirmState.set(null); c?.resolve(v); }
  notify(msg: string) { this.toastMsg.set(msg); clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => this.toastMsg.set(''), 3200); }
}
