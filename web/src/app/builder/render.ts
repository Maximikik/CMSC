import { Block, RenderCtx, SiteDoc, Theme } from './model';
import { RUNTIME_SOURCE } from './runtime-source';
import { SITE_CSS } from './site-css';
import { TYPES } from './types';
import { esc, fontURL, onColor } from './util';

export function siteVars(t: Theme): string {
  const font = String(t.font).replace(/[^A-Za-z0-9 ]/g, '');
  const color = (v: string) => (/^#[0-9a-f]{3,8}$/i.test(v) ? v : '#000000');
  return `--primary:${color(t.primary)};--bg-l:${color(t.bg)};--text-l:${color(t.text)};--font:'${font}',system-ui,sans-serif;--radius:${Math.min(60, Math.max(0, +t.radius || 0))}px;--on-primary:${onColor(t.primary)}`;
}

export function blockHTML(b: Block, c: RenderCtx): string {
  const s = b.s ?? {};
  const st: string[] = [];
  const col = (v: string) => (/^#[0-9a-f]{3,8}$/i.test(v) ? v : '');
  if (col(s['bg'])) st.push('background:' + s['bg']);
  if (col(s['color'])) st.push('color:' + s['color']);
  if (s['py'] !== '' && s['py'] != null && !isNaN(+s['py'])) st.push('--py:' + +s['py'] + 'px');
  if (s['fs'] && !isNaN(+s['fs'])) st.push('--fs:' + +s['fs'] + 'px');
  if (['left', 'center', 'right'].includes(s['align'])) {
    st.push('text-align:' + s['align']);
    st.push(s['align'] === 'center' ? '--ml:auto;--mr:auto' : s['align'] === 'right' ? '--ml:auto;--mr:0' : '--ml:0;--mr:auto');
  }
  const pop = b.type === 'popup';
  const cls = ['s-b', 's-' + b.type];
  if (b.hidden || pop) cls.push('is-hidden');
  return `<section class="${cls.join(' ')}" data-bid="${esc(b.id)}" data-hint="${pop ? 'Popup, opened by an action' : 'Hidden until an action shows it'}"${b.type === 'navbar' && b.p['sticky'] ? ' data-sticky' : ''} style="${st.join(';')}">${TYPES[b.type].html(b, c)}</section>`;
}

export const pageHTML = (doc: SiteDoc, pageId: string, edit: boolean) => {
  const pg = doc.pages.find(p => p.id === pageId)!;
  return pg.blocks.map(b => blockHTML(b, { edit, doc })).join('');
};
export const pageWrap = (doc: SiteDoc, pageId: string, edit = false) =>
  `<div class="s-page" data-page="${esc(pageId)}">${pageHTML(doc, pageId, edit)}</div>`;

/** The complete, self-contained website: every page, the CSS and the runtime in one HTML file. */
export function exportHTML(doc: SiteDoc, opts: { start?: string } = {}): string {
  // Keep the JSON safe inside a <script>: no raw "<" (blocks </script>) and no line separators.
  const data = JSON.stringify(doc).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const start = opts.start ? `,start:${JSON.stringify(opts.start)}` : '';
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(doc.name)}</title><link rel="stylesheet" href="${esc(fontURL(doc.theme.font))}"><style>html,body{margin:0}.site:not(.ov){min-height:100vh}${SITE_CSS}</style></head><body><div class="site" id="site" style="${siteVars(doc.theme)}">${doc.pages.map(p => pageWrap(doc, p.id)).join('')}</div><script>(${RUNTIME_SOURCE})(${data},{root:document.getElementById('site'),hash:true${start}});</script></body></html>`;
}
