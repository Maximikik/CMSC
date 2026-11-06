import { SiteDoc } from './model';
import { blk } from './types';
import { art, uid } from './util';

const lk = (label: string, page: string) => ({ label, kind: 'page', page, url: '' });

export function tplBlank(name = 'My site'): SiteDoc {
  const id = 'pg_' + uid();
  const doc: SiteDoc = { name, theme: { primary: '#0f766e', bg: '#ffffff', text: '#14181f', font: 'DM Sans', radius: 10 }, pages: [{ id, name: 'Home', slug: 'home', title: '', blocks: [] }] };
  doc.pages[0].blocks = [
    blk('navbar', { brand: name, links: [lk('Home', id)] }),
    blk('hero', { eyebrow: '', title: 'Build something here', sub: 'Add elements from the left, click any text to edit it, and use the Actions tab to make buttons do things.', button: 'Try a button' }, { actions: [{ type: 'toast', text: 'It works.' }] }),
    blk('footer', { text: '© 2026 ' + name }),
  ];
  return doc;
}

export function tplPortfolio(): SiteDoc {
  const H = 'pg_home', W = 'pg_work', C = 'pg_contact';
  const nav = () => blk('navbar', { brand: 'Northlight', links: [lk('Home', H), lk('Work', W), lk('Contact', C)] });
  const foot = () => blk('footer', { text: '© 2026 Northlight Studio, Oslo', links: [lk('Contact', C)] });
  return {
    name: 'Northlight Studio',
    theme: { primary: '#b4440e', bg: '#f8f6f1', text: '#1d1b18', font: 'Fraunces', radius: 4 },
    pages: [
      { id: H, name: 'Home', slug: 'home', title: 'Northlight Studio', blocks: [
        nav(),
        blk('hero', { eyebrow: 'Architecture and interiors', title: 'We design rooms people remember', sub: 'Northlight is a six-person studio in Oslo. We plan homes, cafes and offices around daylight, timber and quiet.', button: 'See our work', image: art('#ece3d2', '#d9a441', '#2f5d50') }, { actions: [{ type: 'goto', page: W }] }),
        blk('cards', { title: 'What we do', items: [
          { title: 'Residential', text: 'Houses, cabins and apartment renovations, from first sketch to handover.' },
          { title: 'Hospitality', text: 'Cafes, bakeries and small hotels that feel good at 8 in the morning.' },
          { title: 'Workplace', text: 'Studios and offices for teams of five to fifty.' }] }),
        blk('split', { title: 'A studio of six', text: 'We started in 2014 in a shared garage. Today we work with a small circle of builders and craftspeople across Norway.', button: 'Read our story', variant: 'outline', image: art('#e4e8e2', '#e8b04b', '#3d5a73'), flip: true }, { actions: [{ type: 'toggle', target: 'story' }] }),
        blk('text', { text: 'Our story in short: we like fewer, better decisions. Every project gets one lead architect from the first meeting to the last screw, and we never take on more than eight projects at once.' }, { id: 'story', hidden: true }),
        blk('heading', { text: 'Planning a project?', level: '2' }, { s: { align: 'center' } }),
        blk('button', { label: 'Say hello', size: 'lg' }, { s: { align: 'center' }, actions: [{ type: 'popup', target: 'hello' }] }),
        blk('popup', { title: 'Say hello', text: 'Write to hello@northlight.example and we will reply within two working days.', button: 'Copy email' }, { id: 'hello', actions: [{ type: 'copy', text: 'hello@northlight.example' }] }),
        foot()] },
      { id: W, name: 'Work', slug: 'work', title: 'Selected work', blocks: [
        nav(),
        blk('heading', { text: 'Selected work', level: '1' }),
        blk('text', { text: 'A few recent projects. Each one started with a site visit and a very long walk.' }),
        blk('cards', { title: '', items: [
          { title: 'Fjord House', text: 'A timber house on a slope near Hardanger, 148 m².' },
          { title: 'Bakeri Cafe', text: 'A corner bakery in Grünerløkka with a 9-metre oak counter.' },
          { title: 'Studio Loft', text: 'A former print works turned into an office for 22 people.' }] }),
        blk('image', { src: art('#e9dfcb', '#c9792f', '#2f5d50'), alt: 'Fjord House exterior', caption: 'Fjord House, spring 2025', width: 100 }),
        blk('faq', { title: 'Working with us', items: [
          { q: 'How long does a house take?', a: 'Design takes four to six months. Construction depends on the builder, usually another ten to fourteen.' },
          { q: 'Do you work outside Oslo?', a: 'Yes. We travel for site visits and stay close to the build.' }] }),
        foot()] },
      { id: C, name: 'Contact', slug: 'contact', title: 'Contact', blocks: [
        nav(),
        blk('heading', { text: 'Contact', level: '1' }),
        blk('text', { text: 'Tell us about the place and the people who will use it. We read every message.' }),
        blk('form', { title: '', fields: 'Name*\nEmail*\nMessage*', button: 'Send message', ok: 'Thanks. We will reply within two working days.' }),
        blk('button', { label: 'Copy our email', variant: 'outline' }, { actions: [{ type: 'copy', text: 'hello@northlight.example' }] }),
        blk('button', { label: 'Switch light and dark', variant: 'soft' }, { actions: [{ type: 'dark' }] }),
        foot()] },
    ],
  };
}

export function tplLaunch(): SiteDoc {
  const H = 'pg_h', P = 'pg_p', Q = 'pg_q';
  const nav = () => blk('navbar', { brand: 'Lumen', links: [lk('Product', H), lk('Pricing', P), lk('Help', Q)] });
  const foot = () => blk('footer', { text: '© 2026 Lumen Labs', links: [lk('Help', Q)] });
  return {
    name: 'Lumen',
    theme: { primary: '#38bdf8', bg: '#0b1220', text: '#e8eefc', font: 'Outfit', radius: 14 },
    pages: [
      { id: H, name: 'Product', slug: 'product', title: 'Lumen smart lighting', blocks: [
        nav(),
        blk('hero', { eyebrow: 'Smart lighting', title: 'Light that follows your day', sub: 'Lumen bulbs warm up at sunset and brighten at sunrise. No hub, no app to open.', button: 'Start free trial', image: art('#12244a', '#38bdf8', '#1d4ed8') }, { actions: [{ type: 'popup', target: 'trial' }] }),
        blk('cards', { title: 'Built for ordinary evenings', items: [
          { title: 'Sunrise mode', text: 'Fades up over 20 minutes so mornings start gently.' },
          { title: 'Scenes on a schedule', text: 'Reading, dinner, movie. Set it once.' },
          { title: '10-year bulbs', text: 'Rated for 25,000 hours. We replace any that fail.' }] }),
        blk('split', { title: 'Set up in five minutes', text: 'Screw in the bulb, scan the code on the box, pick a room. That is the whole setup.', button: 'See pricing', variant: 'outline', image: art('#0f1c38', '#7dd3fc', '#2563eb'), flip: true }, { actions: [{ type: 'goto', page: P }] }),
        blk('popup', { title: 'Start your 30-day trial', text: 'No card needed. Cancel from the app at any time.', button: 'Create account' }, { id: 'trial', actions: [{ type: 'toast', text: 'Account created. This is a demo, nothing was sent.' }, { type: 'closepopup', target: '' }] }),
        foot()] },
      { id: P, name: 'Pricing', slug: 'pricing', title: 'Pricing', blocks: [
        nav(),
        blk('heading', { text: 'Simple pricing', level: '1' }, { s: { align: 'center' } }),
        blk('cards', { title: '', items: [
          { title: 'Starter – $0', text: 'Up to 3 bulbs. Scenes and sunrise mode included.' },
          { title: 'Home – $9 a month', text: 'Up to 30 bulbs, shared access for the household.' },
          { title: 'Studio – $29 a month', text: 'Unlimited bulbs, schedules per room, priority support.' }] }),
        blk('faq', { title: 'Billing', items: [
          { q: 'Can I cancel any time?', a: 'Yes. You keep the plan until the end of the month you paid for.' },
          { q: 'Do you offer student pricing?', a: 'Students get the Home plan at half price.' }] }),
        blk('button', { label: 'Talk to sales', size: 'lg' }, { s: { align: 'center' }, actions: [{ type: 'goto', page: Q }] }),
        foot()] },
      { id: Q, name: 'Help', slug: 'help', title: 'Help', blocks: [
        nav(),
        blk('heading', { text: 'How can we help?', level: '1' }),
        blk('faq', { title: '', items: [
          { q: 'A bulb will not connect.', a: 'Turn it off and on three times until it blinks, then scan the code again.' },
          { q: 'Does it work without internet?', a: 'Schedules keep running. Remote control needs a connection.' }] }),
        blk('form', { title: 'Ask a question', fields: 'Name*\nEmail*\nQuestion*', button: 'Send question', ok: 'Thanks. A person will reply by email.' }),
        foot()] },
    ],
  };
}

export interface Template { k: string; n: string; d: string; make: () => SiteDoc }
export const TEMPLATES: Template[] = [
  { k: 'portfolio', n: 'Studio portfolio', d: 'Three pages with a popup, a hidden story you can reveal, a contact form and a dark mode button.', make: tplPortfolio },
  { k: 'launch', n: 'Product launch', d: 'A dark landing page with a trial popup, pricing, a questions list and a help form.', make: tplLaunch },
  { k: 'blank', n: 'Blank site', d: 'One page with a navigation bar, a hero with a working button, and a footer.', make: () => tplBlank() },
];
