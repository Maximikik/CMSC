import { Component, ElementRef, effect, inject, untracked } from '@angular/core';
import { BuilderStore } from './store';
import { exportHTML, pageHTML, siteVars } from './render';
import { EDIT_CSS, SITE_CSS } from './site-css';
import { TYPES } from './types';
import { ico } from './icons';

let stylesInjected = false;
function injectSiteStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const s = document.createElement('style');
  s.id = 'sw-site-css';
  s.textContent = SITE_CSS + EDIT_CSS;
  document.head.appendChild(s);
}

/**
 * The page being built. In Edit mode it draws the real site HTML and lets you click, type and drag in it.
 * In Preview mode it shows the exported site inside a sandboxed iframe, so what you see is what visitors get
 * and nothing in the site (custom HTML included) can touch the editor.
 */
@Component({
  selector: 'sw-canvas',
  template: '',
  host: { class: 'frame', '[attr.data-dev]': 'store.device()' },
})
export class CanvasComponent {
  store = inject(BuilderStore);
  private host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private canvas: HTMLElement | null = null;
  private frame: HTMLIFrameElement | null = null;
  private dropEl: HTMLElement | null = null;
  private dropIdx = 0;

  constructor() {
    injectSiteStyles();
    effect(() => {
      this.store.canvasRev(); this.store.mode(); this.store.pageId();
      untracked(() => this.render());
    });
    effect(() => { this.store.sel(); untracked(() => this.applySel()); });

    this.host.addEventListener('dragover', e => {
      if (this.store.mode() !== 'edit' || !this.canvas) return;
      e.preventDefault();
      const pg = this.canvas.querySelector('.s-page');
      if (!pg) return;
      const secs = [...pg.children].filter(x => (x as HTMLElement).dataset['bid']) as HTMLElement[];
      let idx = secs.length;
      for (let i = 0; i < secs.length; i++) {
        const r = secs[i].getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) { idx = i; break; }
      }
      this.dropIdx = idx;
      if (!this.dropEl) { this.dropEl = document.createElement('div'); this.dropEl.className = 'drop'; }
      if (idx < secs.length) pg.insertBefore(this.dropEl, secs[idx]); else pg.appendChild(this.dropEl);
    });
    this.host.addEventListener('drop', e => {
      if (this.store.mode() !== 'edit') return;
      e.preventDefault();
      const d = e.dataTransfer?.getData('text/plain') ?? '';
      const at = this.dropIdx;
      this.cleanDrop();
      if (d.startsWith('add:') && TYPES[d.slice(4)]) this.store.addBlock(d.slice(4), at);
      else if (d.startsWith('move:')) this.store.moveBlock(d.slice(5), at);
    });
    this.host.addEventListener('dragleave', e => { if (!this.host.contains(e.relatedTarget as Node)) this.cleanDrop(); });
    document.addEventListener('dragend', () => this.cleanDrop());
  }

  private cleanDrop() { this.dropEl?.remove(); }

  private render() {
    const mode = this.store.mode();
    if (mode === 'preview') {
      this.canvas = null;
      this.host.innerHTML = '';
      const f = document.createElement('iframe');
      f.title = 'Site preview';
      f.setAttribute('sandbox', 'allow-scripts allow-popups allow-popups-to-escape-sandbox');
      f.setAttribute('allow', 'clipboard-write');
      f.srcdoc = exportHTML(this.store.doc, { start: this.store.pageId() });
      this.host.appendChild(f);
      this.frame = f;
      return;
    }
    if (!this.canvas) {
      this.host.innerHTML = '';
      this.frame = null;
      const c = document.createElement('div');
      c.id = 'canvas';
      c.className = 'site is-edit';
      this.bind(c);
      this.host.appendChild(c);
      this.canvas = c;
    }
    const doc = this.store.doc, pg = this.store.page();
    this.canvas.setAttribute('style', siteVars(doc.theme));
    this.canvas.innerHTML = `<div class="s-page" data-page="${pg.id}">${pageHTML(doc, pg.id, true)}${pg.blocks.length ? '' : '<div class="empty-page">This page is empty. Click an element on the left, or drag one here.</div>'}</div>`;
    this.applySel();
  }

  private applySel() {
    const c = this.canvas;
    if (!c || this.store.mode() !== 'edit') return;
    c.querySelectorAll('.sel').forEach(e => e.classList.remove('sel'));
    c.querySelectorAll('.tb').forEach(e => e.remove());
    c.querySelectorAll('[contenteditable]').forEach(e => e.removeAttribute('contenteditable'));
    const id = this.store.sel();
    if (!id) return;
    const el = c.querySelector<HTMLElement>(`[data-bid="${CSS.escape(id)}"]`);
    const b = this.store.selected();
    if (!el || !b) return;
    el.classList.add('sel');
    el.querySelectorAll('[data-edit]').forEach(e => e.setAttribute('contenteditable', 'true'));
    const tb = document.createElement('div');
    tb.className = 'tb';
    tb.contentEditable = 'false';
    tb.innerHTML = `<span class="tb-n">${TYPES[b.type].label}</span>`
      + `<button data-tb="grip" draggable="true" title="Drag to move" aria-label="Drag to move">${ico('grip', 15)}</button>`
      + `<button data-tb="up" title="Move up" aria-label="Move up">${ico('up', 15)}</button>`
      + `<button data-tb="down" title="Move down" aria-label="Move down">${ico('down', 15)}</button>`
      + `<button data-tb="dup" title="Duplicate" aria-label="Duplicate">${ico('copy', 15)}</button>`
      + `<button data-tb="del" title="Delete" aria-label="Delete">${ico('trash', 15)}</button>`;
    el.appendChild(tb);
  }

  private bind(c: HTMLElement) {
    const st = this.store;
    c.addEventListener('click', e => {
      const t = e.target as HTMLElement;
      const tb = t.closest<HTMLElement>('[data-tb]');
      if (tb) {
        const k = tb.dataset['tb'], id = st.sel();
        if (!id) return;
        if (k === 'up') st.nudge(id, -1); else if (k === 'down') st.nudge(id, 1);
        else if (k === 'dup') st.duplicateBlock(id); else if (k === 'del') st.deleteBlock(id);
        return;
      }
      e.preventDefault();
      const s = t.closest<HTMLElement>('[data-bid]');
      if (s && s.dataset['bid'] === st.sel()) return;
      st.select(s ? s.dataset['bid']! : null);
    });
    c.addEventListener('input', e => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-edit]');
      const sec = t?.closest<HTMLElement>('[data-bid]');
      if (!t || !sec) return;
      st.typeInCanvas(sec.dataset['bid']!, t.dataset['edit']!, t.hasAttribute('data-ml') ? t.innerText : (t.textContent ?? ''));
    });
    // Refresh the side panel in place when you leave a text field. Redrawing the canvas here would swallow the click that caused the blur.
    c.addEventListener('focusout', e => { if ((e.target as HTMLElement).closest?.('[data-edit]')) st.touch(); });
    c.addEventListener('keydown', e => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-edit]');
      if (!t) return;
      if (e.key === 'Enter' && !t.hasAttribute('data-ml')) { e.preventDefault(); t.blur(); }
      if (e.key === ' ' && t.tagName === 'SUMMARY') { e.preventDefault(); document.execCommand('insertText', false, ' '); }
    });
    c.addEventListener('paste', e => {
      if (!(e.target as HTMLElement).closest?.('[data-edit]')) return;
      e.preventDefault();
      document.execCommand('insertText', false, e.clipboardData?.getData('text/plain') ?? '');
    });
    c.addEventListener('dragstart', e => {
      const g = (e.target as HTMLElement).closest?.('[data-tb="grip"]');
      if (g && st.sel()) { e.dataTransfer?.setData('text/plain', 'move:' + st.sel()); if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'; }
      else e.preventDefault();
    });
  }
}
