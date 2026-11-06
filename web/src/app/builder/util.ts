export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export const nl = (s: unknown) => esc(s).replace(/\n/g, '<br>');
export const uid = () => Math.random().toString(36).slice(2, 9);

export const getPath = (o: any, p: string): any => p ? p.split('.').reduce((a, k) => (a == null ? a : a[k]), o) : o;
export const setPath = (o: any, p: string, v: any) => {
  const ks = p.split('.');
  const last = ks.pop()!;
  ks.reduce((a, k) => a[k], o)[last] = v;
};

export const slugify = (s: string) =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'page';

/** Links may only point at web pages, mail/phone links, in-page anchors and relative paths. Everything else (javascript:, data:, ...) becomes "#". */
export const safeUrl = (u: unknown): string => {
  const v = String(u ?? '').trim();
  if (!v) return '#';
  if (/^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i.test(v)) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return '#';
  return v;
};
export const safeImg = (u: unknown): string => {
  const v = String(u ?? '').trim();
  if (/^(https?:|\/|\.\/|\.\.\/|data:image\/(png|jpe?g|gif|webp|svg\+xml)[;,])/i.test(v)) return v;
  return /^[a-z][a-z0-9+.-]*:/i.test(v) ? '' : v;
};

export const onColor = (h: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(h || '');
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.6 ? '#111418' : '#ffffff';
};

export const art = (a: string, b: string, c: string) =>
  'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600" fill="${a}"/><circle cx="560" cy="210" r="130" fill="${b}"/><path d="M0 470L230 300 400 420 560 330 800 480V600H0z" fill="${c}"/></svg>`);
export const PH = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600" fill="#d8dde3"/><path d="M0 470L230 300 400 420 560 330 800 480V600H0z" fill="#b9c1ca"/><circle cx="560" cy="210" r="70" fill="#c7ced6"/></svg>');

export const FONTS: Record<string, string> = {
  'DM Sans': '400;500;700', 'Manrope': '400;600;800', 'Outfit': '400;600;700', 'Fraunces': '400;600;700',
  'Playfair Display': '400;600;700', 'Lora': '400;600;700', 'Space Mono': '400;700', 'Bricolage Grotesque': '400;600;800',
};
export const fontURL = (n: string) =>
  'https://fonts.googleapis.com/css2?family=' + (FONTS[n] ? n.replace(/ /g, '+') + ':wght@' + FONTS[n] : 'DM+Sans:wght@400;500;700') + '&display=swap';
