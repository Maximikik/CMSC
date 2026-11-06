import { ActionDef, Block, FieldDef, RenderCtx, SiteDoc } from './model';
import { art, esc, nl, PH, safeImg, safeUrl, uid } from './util';

export interface BlockType {
  label: string;
  icon: string;
  acts: boolean;
  def: (doc?: SiteDoc) => Record<string, any>;
  fields: FieldDef[];
  html: (b: Block, c: RenderCtx) => string;
}

const slugOf = (doc: SiteDoc, id: string) => doc.pages.find(p => p.id === id)?.slug ?? '';
const ed = (k: string, ml = false) => `data-edit="${k}"${ml ? ' data-ml' : ''}`;

const mkLink = (doc: SiteDoc) => ({ label: 'Link', kind: 'page', page: doc.pages[0]?.id ?? '', url: '' });
const LINK_SUB: FieldDef[] = [
  { k: 'label', l: 'Label', t: 'text' },
  { k: 'kind', l: 'Goes to', t: 'select', o: [['page', 'A page of this site'], ['url', 'A web address']] },
  { k: 'page', l: 'Page', t: 'page', when: i => i.kind !== 'url' },
  { k: 'url', l: 'Address', t: 'text', ph: 'https://example.com', when: i => i.kind === 'url' },
];
const VARIANTS: [string, string][] = [['solid', 'Filled'], ['outline', 'Outline'], ['soft', 'Soft']];

const linksHTML = (doc: SiteDoc, ls: any[] | undefined) => (ls ?? []).map((l, i) => l.kind === 'url'
  ? `<a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener" ${ed('links.' + i + '.label')}>${esc(l.label)}</a>`
  : `<a href="#${esc(slugOf(doc, l.page))}" data-go="${esc(l.page)}" ${ed('links.' + i + '.label')}>${esc(l.label)}</a>`).join('');

const btnCls = (p: any) => `s-btn ${p.variant && p.variant !== 'solid' ? p.variant : ''} ${p.size || ''} ${p.full ? 'full' : ''}`;
const btnHTML = (label: string, p: any, key: string) =>
  `<a class="${btnCls(p)}" role="button" tabindex="0" data-act data-t ${ed(key)}>${esc(label)}</a>`;

function formFields(str: string) {
  return String(str ?? '').split('\n').map(s => s.trim()).filter(Boolean).map(s => {
    const req = /\*$/.test(s);
    const label = s.replace(/\*$/, '').trim();
    const k = label.toLowerCase();
    return { label, req, type: /e-?mail/.test(k) ? 'email' : /phone|tel/.test(k) ? 'tel' : /message|comment|detail|question|tell/.test(k) ? 'area' : 'text' };
  });
}

export const TYPES: Record<string, BlockType> = {
  navbar: {
    label: 'Navigation bar', icon: 'nav', acts: false,
    def: doc => ({ brand: 'Brand', sticky: true, links: (doc?.pages ?? []).slice(0, 4).map(p => ({ label: p.name, kind: 'page', page: p.id, url: '' })) }),
    fields: [
      { k: 'brand', l: 'Brand name', t: 'text' },
      { k: 'sticky', l: 'Keep at the top while scrolling', t: 'check' },
      { k: 'links', l: 'Links', t: 'list', sub: LINK_SUB, make: mkLink },
    ],
    html: (b, c) => `<div class="s-in s-nav-in"><a class="s-brand" data-go="${esc(c.doc.pages[0]?.id ?? '')}" ${ed('brand')}>${esc(b.p['brand'])}</a><div class="s-links">${linksHTML(c.doc, b.p['links'])}</div></div>`,
  },
  hero: {
    label: 'Hero', icon: 'hero', acts: true,
    def: () => ({ eyebrow: 'New', title: 'A headline that says what you do', sub: 'One or two sentences about who it is for and why it matters.', button: 'Get started', variant: 'solid', size: '', image: '' }),
    fields: [
      { k: 'eyebrow', l: 'Small label above', t: 'text' },
      { k: 'title', l: 'Headline', t: 'area', rows: 2 },
      { k: 'sub', l: 'Subtitle', t: 'area' },
      { k: 'button', l: 'Button text', t: 'text', help: 'Leave empty to hide the button. The button is what the Actions tab controls.' },
      { k: 'variant', l: 'Button style', t: 'select', o: VARIANTS },
      { k: 'image', l: 'Image', t: 'image' },
    ],
    html: b => {
      const p = b.p;
      const img = safeImg(p['image']);
      return `<div class="s-in s-hero-in ${img ? 'has-img' : ''}"><div>${p['eyebrow'] ? `<p class="s-eyebrow" ${ed('eyebrow')}>${esc(p['eyebrow'])}</p>` : ''}<h1 data-t ${ed('title')}>${esc(p['title'])}</h1>${p['sub'] ? `<p class="s-sub" ${ed('sub', true)}>${nl(p['sub'])}</p>` : ''}${p['button'] ? btnHTML(p['button'], p, 'button') : ''}</div>${img ? `<img class="s-hero-img" src="${esc(img)}" alt="">` : ''}</div>`;
    },
  },
  split: {
    label: 'Text and image', icon: 'split', acts: true,
    def: () => ({ title: 'Tell your story', text: 'Write a few lines next to a picture. Swap the side with the switch below.', button: '', variant: 'solid', image: art('#e7ebf0', '#f2b950', '#4c6a85'), flip: false }),
    fields: [
      { k: 'title', l: 'Heading', t: 'text' },
      { k: 'text', l: 'Text', t: 'area', rows: 4 },
      { k: 'button', l: 'Button text', t: 'text', help: 'Optional.' },
      { k: 'variant', l: 'Button style', t: 'select', o: VARIANTS },
      { k: 'image', l: 'Image', t: 'image' },
      { k: 'flip', l: 'Put the image on the left', t: 'check' },
    ],
    html: b => {
      const p = b.p;
      return `<div class="s-in s-split ${p['flip'] ? 'flip' : ''}"><div><h2 class="s-h" ${ed('title')}>${esc(p['title'])}</h2><p ${ed('text', true)}>${nl(p['text'])}</p>${p['button'] ? btnHTML(p['button'], p, 'button') : ''}</div><img src="${esc(safeImg(p['image']) || PH)}" alt=""></div>`;
    },
  },
  heading: {
    label: 'Heading', icon: 'heading', acts: true,
    def: () => ({ text: 'Section heading', level: '2' }),
    fields: [
      { k: 'text', l: 'Text', t: 'text' },
      { k: 'level', l: 'Level', t: 'select', o: [['1', 'Heading 1 (page title)'], ['2', 'Heading 2'], ['3', 'Heading 3']] },
    ],
    html: b => { const lv = ['1', '2', '3'].includes(String(b.p['level'])) ? b.p['level'] : '2'; return `<div class="s-in"><h${lv} class="s-h" data-t ${ed('text')}>${esc(b.p['text'])}</h${lv}></div>`; },
  },
  text: {
    label: 'Paragraph', icon: 'para', acts: true,
    def: () => ({ text: 'Write something here. Click the text on the canvas to edit it directly.' }),
    fields: [{ k: 'text', l: 'Text', t: 'area', rows: 6 }],
    html: b => `<div class="s-in"><p class="s-p" data-t ${ed('text', true)}>${nl(b.p['text'])}</p></div>`,
  },
  button: {
    label: 'Button', icon: 'btn', acts: true,
    def: () => ({ label: 'Click me', variant: 'solid', size: '', full: false }),
    fields: [
      { k: 'label', l: 'Text', t: 'text' },
      { k: 'variant', l: 'Style', t: 'select', o: VARIANTS },
      { k: 'size', l: 'Size', t: 'select', o: [['sm', 'Small'], ['', 'Medium'], ['lg', 'Large']] },
      { k: 'full', l: 'Stretch to full width', t: 'check' },
    ],
    html: b => `<div class="s-in">${btnHTML(b.p['label'], b.p, 'label')}</div>`,
  },
  image: {
    label: 'Image', icon: 'image', acts: true,
    def: () => ({ src: '', alt: '', caption: '', width: 100 }),
    fields: [
      { k: 'src', l: 'Image', t: 'image' },
      { k: 'alt', l: 'Description for screen readers', t: 'text' },
      { k: 'caption', l: 'Caption', t: 'text' },
      { k: 'width', l: 'Width (%)', t: 'num', min: 10, max: 100 },
    ],
    html: b => `<div class="s-in"><figure class="s-fig" style="--w:${Math.min(100, Math.max(10, +b.p['width'] || 100))}%"><img src="${esc(safeImg(b.p['src']) || PH)}" alt="${esc(b.p['alt'])}">${b.p['caption'] ? `<figcaption ${ed('caption')}>${esc(b.p['caption'])}</figcaption>` : ''}</figure></div>`,
  },
  cards: {
    label: 'Cards', icon: 'grid', acts: true,
    def: () => ({ title: 'Why choose us', cols: 3, items: [{ title: 'Fast', text: 'Describe the first benefit in a sentence or two.' }, { title: 'Simple', text: 'Describe the second benefit in a sentence or two.' }, { title: 'Yours', text: 'Describe the third benefit in a sentence or two.' }] }),
    fields: [
      { k: 'title', l: 'Section heading', t: 'text' },
      { k: 'cols', l: 'Columns', t: 'select', o: [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']] },
      { k: 'items', l: 'Cards', t: 'list', sub: [{ k: 'title', l: 'Title', t: 'text' }, { k: 'text', l: 'Text', t: 'area' }], make: () => ({ title: 'New card', text: 'Card text.' }) },
    ],
    html: b => `<div class="s-in">${b.p['title'] ? `<h2 class="s-h" ${ed('title')}>${esc(b.p['title'])}</h2>` : ''}<div class="s-cards-grid" style="--cols:${Math.min(4, Math.max(1, +b.p['cols'] || 3))}">${(b.p['items'] ?? []).map((it: any, i: number) => `<div class="s-card"><h3 ${ed('items.' + i + '.title')}>${esc(it.title)}</h3><p ${ed('items.' + i + '.text', true)}>${nl(it.text)}</p></div>`).join('')}</div></div>`,
  },
  faq: {
    label: 'Questions list', icon: 'q', acts: false,
    def: () => ({ title: 'Questions', items: [{ q: 'How does it work?', a: 'Explain it in a couple of sentences.' }, { q: 'What does it cost?', a: 'Be specific about prices.' }] }),
    fields: [
      { k: 'title', l: 'Section heading', t: 'text' },
      { k: 'items', l: 'Questions', t: 'list', sub: [{ k: 'q', l: 'Question', t: 'text' }, { k: 'a', l: 'Answer', t: 'area' }], make: () => ({ q: 'New question', a: 'Answer.' }) },
    ],
    html: (b, c) => `<div class="s-in s-faq">${b.p['title'] ? `<h2 class="s-h" ${ed('title')}>${esc(b.p['title'])}</h2>` : ''}<div class="s-faq-list">${(b.p['items'] ?? []).map((it: any, i: number) => `<details ${c.edit ? 'open' : ''}><summary ${ed('items.' + i + '.q')}>${esc(it.q)}</summary><p ${ed('items.' + i + '.a', true)}>${nl(it.a)}</p></details>`).join('')}</div></div>`,
  },
  form: {
    label: 'Form', icon: 'form', acts: true,
    def: () => ({ title: 'Get in touch', fields: 'Name*\nEmail*\nMessage', button: 'Send message', ok: 'Thanks, we got your message.', variant: 'solid' }),
    fields: [
      { k: 'title', l: 'Heading', t: 'text' },
      { k: 'fields', l: 'Fields (one per line, add * if required)', t: 'area', rows: 4 },
      { k: 'button', l: 'Button text', t: 'text' },
      { k: 'ok', l: 'Message after sending', t: 'text' },
      { k: 'variant', l: 'Button style', t: 'select', o: VARIANTS },
    ],
    html: (b, c) => {
      const p = b.p;
      return `<div class="s-in">${p['title'] ? `<h2 class="s-h" ${ed('title')}>${esc(p['title'])}</h2>` : ''}<form class="s-form">${formFields(p['fields']).map(f => `<label>${esc(f.label)}${f.req ? ' *' : ''}${f.type === 'area' ? `<textarea name="${esc(f.label)}" ${f.req ? 'required' : ''}></textarea>` : `<input type="${f.type}" name="${esc(f.label)}" ${f.req ? 'required' : ''}>`}</label>`).join('')}${c.edit ? `<span class="${btnCls(p)}" ${ed('button')}>${esc(p['button'])}</span>` : `<button type="submit" class="${btnCls(p)}">${esc(p['button'])}</button>`}</form><p class="s-form-ok is-hidden">${esc(p['ok'])}</p></div>`;
    },
  },
  divider: { label: 'Divider line', icon: 'hr', acts: false, def: () => ({}), fields: [], html: () => `<div class="s-in"><hr class="s-hr"></div>` },
  spacer: {
    label: 'Spacer', icon: 'space', acts: false, def: () => ({ h: 48 }),
    fields: [{ k: 'h', l: 'Height (px)', t: 'num', min: 0, max: 400 }],
    html: b => `<div style="height:${Math.min(400, Math.max(0, +b.p['h'] || 0))}px"></div>`,
  },
  popup: {
    label: 'Popup window', icon: 'pop', acts: true,
    def: () => ({ title: 'Hello!', text: 'This window opens when a button tells it to.', button: 'Got it' }),
    fields: [
      { k: 'title', l: 'Title', t: 'text' },
      { k: 'text', l: 'Text', t: 'area' },
      { k: 'button', l: 'Button text', t: 'text', help: 'The button closes the popup. Add actions to make it do more, for example copy text or go to a page.' },
    ],
    html: b => `<div class="s-pop-card"><button class="s-x" data-close aria-label="Close">&times;</button><h3 class="s-h" ${ed('title')}>${esc(b.p['title'])}</h3><p class="s-p" ${ed('text', true)}>${nl(b.p['text'])}</p>${b.p['button'] ? `<a class="s-btn" role="button" tabindex="0" data-act data-close data-t ${ed('button')}>${esc(b.p['button'])}</a>` : ''}</div>`,
  },
  html: {
    label: 'Custom HTML', icon: 'code', acts: false,
    def: () => ({ code: '<p>Paste your own HTML here.</p>' }),
    fields: [{ k: 'code', l: 'HTML', t: 'area', rows: 8, help: 'Added to the published page exactly as written, so only paste code you trust. It is not run inside the editor; use Preview to see it.' }],
    html: (b, c) => c.edit ? `<div class="s-in"><div class="s-html-ph">Custom HTML block. Open Preview to see it run.</div></div>` : `<div class="s-in s-html">${b.p['code'] ?? ''}</div>`,
  },
  footer: {
    label: 'Footer', icon: 'foot', acts: false,
    def: () => ({ text: '© 2026 Your name', links: [] }),
    fields: [
      { k: 'text', l: 'Text', t: 'text' },
      { k: 'links', l: 'Links', t: 'list', sub: LINK_SUB, make: mkLink },
    ],
    html: (b, c) => `<div class="s-in s-foot"><span ${ed('text')}>${esc(b.p['text'])}</span><div class="s-links">${linksHTML(c.doc, b.p['links'])}</div></div>`,
  },
};

export const GROUPS: [string, string[]][] = [
  ['Structure', ['navbar', 'hero', 'split', 'footer', 'spacer', 'divider']],
  ['Content', ['heading', 'text', 'image', 'button', 'cards', 'faq']],
  ['Interactive', ['form', 'popup', 'html']],
];

export const STYLE_FIELDS: FieldDef[] = [
  { k: 'align', l: 'Alignment', t: 'select', o: [['', 'Default'], ['left', 'Left'], ['center', 'Center'], ['right', 'Right']] },
  { k: 'bg', l: 'Background color', t: 'color', def: '#ffffff' },
  { k: 'color', l: 'Text color', t: 'color', def: '#111111' },
  { k: 'py', l: 'Space above and below (px)', t: 'num', min: 0, max: 300, ph: 'Default' },
  { k: 'fs', l: 'Text size (px)', t: 'num', min: 10, max: 140, ph: 'Default' },
];

/* ---------- actions ---------- */
const TG = (o: Partial<FieldDef> = {}): FieldDef => ({ k: 'target', l: 'Element', t: 'block', ...o });
export const ACT: Record<string, { l: string; f: FieldDef[]; def?: Record<string, any> }> = {
  goto: { l: 'Go to a page', f: [{ k: 'page', l: 'Page', t: 'page' }] },
  url: { l: 'Open a web address', f: [{ k: 'url', l: 'Address', t: 'text', ph: 'https://example.com' }, { k: 'blank', l: 'Open in a new tab', t: 'check' }], def: { url: 'https://', blank: true } },
  scroll: { l: 'Scroll to an element', f: [TG()] },
  show: { l: 'Show an element', f: [TG()] },
  hide: { l: 'Hide an element', f: [TG()] },
  toggle: { l: 'Show or hide an element', f: [TG()] },
  popup: { l: 'Open a popup', f: [TG({ l: 'Popup', only: 'popup' })] },
  closepopup: { l: 'Close a popup', f: [TG({ l: 'Popup (empty = the one on screen)', only: 'popup', blank: true })] },
  toast: { l: 'Show a small message', f: [{ k: 'text', l: 'Message', t: 'text' }], def: { text: 'Done!' } },
  copy: { l: 'Copy text to the clipboard', f: [{ k: 'text', l: 'Text to copy', t: 'text' }], def: { text: '' } },
  settext: { l: 'Change the text of an element', f: [TG(), { k: 'text', l: 'New text', t: 'text' }], def: { text: '' } },
  count: { l: 'Add to a number in an element', f: [TG(), { k: 'n', l: 'Amount to add', t: 'num' }], def: { n: 1 } },
  dark: { l: 'Switch light and dark mode', f: [] },
  top: { l: 'Scroll to the top', f: [] },
  back: { l: 'Go back to the previous page', f: [] },
  wait: { l: 'Wait before the next action', f: [{ k: 'ms', l: 'Milliseconds', t: 'num', min: 0 }], def: { ms: 1000 } },
};
export const TRIGGERS: [string, string][] = [
  ['click', 'Visitor clicks it'], ['hover', 'Visitor hovers over it'], ['dblclick', 'Visitor double-clicks it'], ['pageopen', 'The page opens'],
];
export const newAct = (t: string): ActionDef => ({ type: t, ...JSON.parse(JSON.stringify(ACT[t]?.def ?? {})) });

export function blk(type: string, p: Record<string, any> = {}, o: Partial<Block> = {}, doc?: SiteDoc): Block {
  return {
    id: o.id ?? uid(), type, p: Object.assign(TYPES[type].def(doc), p), s: o.s ?? {},
    hidden: !!o.hidden, trigger: o.trigger ?? 'click', actions: o.actions ?? [],
  };
}

export function blockLabel(b: Block): string {
  let sn = '';
  for (const k of ['title', 'text', 'label', 'brand', 'eyebrow', 'button', 'caption', 'q']) {
    const v = b.p[k];
    if (typeof v === 'string' && v.trim()) { sn = v.trim(); break; }
  }
  return TYPES[b.type].label + (sn ? ' · ' + (sn.length > 26 ? sn.slice(0, 26) + '…' : sn) : '');
}
