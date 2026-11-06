// Full-stack browser test. Needs the stack running: app on :8080, published sites on :8081, and an empty database.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.env.OUT || '/tmp';
let passed = 0, failed = 0;
const poll = async (fn, ms = 5000) => { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (e) {} if (Date.now() - t > ms) return false; await new Promise(r => setTimeout(r, 60)); } };
const ok = (n, c, d = '') => { c ? passed++ : failed++; console.log(`  ${c ? 'ok  ' : 'FAIL'} ${n}${c ? '' : '  ' + d}`); };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_|Failed to load resource/.test(m.text())) errors.push(m.text()); });

  console.log('first run');
  await p.goto('http://localhost:8080/');
  await p.waitForURL('**/login');
  ok('redirected to sign in', true);
  ok('offers admin creation', await p.locator('h1').innerText() === 'Create the administrator account');
  await p.fill('#dn', 'Ada'); await p.fill('#em', 'ada@example.com'); await p.fill('#pw', 'short');
  ok('short password blocks submit', await p.locator('button[type=submit]').isDisabled());
  await p.fill('#pw', 'correct horse battery');
  await p.click('button[type=submit]');
  await p.waitForSelector('text=No sites yet');
  ok('lands on the empty sites page', true);

  console.log('create a site');
  await p.click('text=Create your first site');
  await p.fill('#nn', 'Northlight');
  await p.click('.tpl:has-text("Studio portfolio")');
  await p.click('button:has-text("Create site")');
  await p.waitForSelector('.s-hero');
  ok('editor opens with the template', (await p.locator('.s-page .s-b').count()) >= 5);
  const siteUrl = p.url();

  ok('template pictures render', await poll(async () => (await p.locator('.s-hero-img').getAttribute('src')).startsWith('data:image/svg+xml')));

  console.log('edit on the canvas');
  await p.locator('.s-hero h1').click();
  ok('click selects the hero', await poll(async () => (await p.locator('.ins-h .h').first().textContent()) === 'Hero'));
  await p.locator('.s-hero h1').click();
  await p.keyboard.press('Control+A');
  await p.keyboard.type('Rooms with daylight');
  await p.waitForTimeout(300);
  await p.locator('.tabs button:has-text("Content")').click();
  ok('inspector reflects typed headline', await poll(async () => (await p.locator('.ins-b textarea').first().inputValue()) === 'Rooms with daylight'));
  await p.waitForSelector('text=All changes saved', { timeout: 8000 });
  ok('autosaved', true);

  console.log('actions');
  await p.locator('.tabs button:has-text("Actions")').click();
  ok('template action present', await poll(async () => (await p.locator('.act').count()) === 1));
  await p.selectOption('select[aria-label="Add an action"]', 'toast');
  await p.locator('.act').nth(1).locator('input[type=text]').fill('Welcome!');
  ok('two actions now', await poll(async () => (await p.locator('.act').count()) === 2));
  await p.screenshot({ path: OUT + '/e2e-actions.png' });

  console.log('upload an image');
  await p.locator('.tabs button:has-text("Content")').click();
  fs.writeFileSync(OUT + '/pic.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
  await p.locator('input[type=file]').first().setInputFiles(OUT + '/pic.png');
  await p.waitForFunction(() => document.querySelector('.s-hero-img')?.getAttribute('src')?.includes('/_assets/'), null, { timeout: 8000 });
  const imgSrc = await p.locator('.s-hero-img').getAttribute('src');
  const before = 'data:image/svg+xml';
  ok('uploaded image used on the canvas', imgSrc.startsWith('http://localhost:8081/_assets/'), imgSrc);
  const imgResp = await p.request.get(imgSrc);
  ok('image is served by the sites origin', imgResp.status() === 200 && imgResp.headers()['content-type'] === 'image/png', imgResp.status() + ' ' + imgResp.headers()['content-type']);

  console.log('undo / redo');
  await p.click('.top .ib[aria-label="Undo"]');
  ok('undo puts the template picture back', await poll(async () => (await p.locator('.s-hero-img').getAttribute('src')).startsWith(before)));
  await p.click('.top .ib[aria-label="Redo"]');
  ok('redo restores the upload', await poll(async () => (await p.locator('.s-hero-img').getAttribute('src')).includes('/_assets/')));

  console.log('pages');
  await p.locator('.pg-n:has-text("Work")').click();
  ok('switching pages', await poll(async () => (await p.locator('.s-page h1').first().innerText()) === 'Selected work'));
  await p.locator('.chip:has-text("Spacer")').click();
  ok('click-to-add inserts an element', await poll(async () => (await p.locator('.s-spacer').count()) === 1));
  await p.keyboard.press('Escape'); // focus is on body
  await p.locator('.s-spacer').click();
  await p.keyboard.press('Delete');
  ok('Delete key removes the selected element', await poll(async () => (await p.locator('.s-spacer').count()) === 0));
  await p.locator('.pg-n:has-text("Home")').click();
  await p.waitForSelector('.s-hero');

  console.log('preview');
  await p.click('.seg button:has-text("Preview")');
  const fr = p.frameLocator('iframe');
  await fr.locator('.s-hero .s-btn').waitFor();
  ok('preview is sandboxed', (await p.locator('iframe').getAttribute('sandbox')) === 'allow-scripts allow-popups allow-popups-to-escape-sandbox');
  await fr.locator('.s-hero .s-btn').click();
  await fr.locator('.s-toast').waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
  ok('action chain ran in preview (went to Work page)', await fr.locator('.s-page:not([hidden]) h1').first().innerText() === 'Selected work');
  ok('second action showed the toast', (await fr.locator('.s-toast').innerText()) === 'Welcome!');
  await p.click('.seg button:has-text("Edit")');

  console.log('publish');
  await p.click('button:has-text("Publish")');
  await p.fill('#pubnote', 'first version');
  await p.click('.dlg button.pri');
  await p.waitForSelector('text=Published. Visitors see the new version now.', { timeout: 8000 });
  ok('publish succeeded', true);
  const live = await (await p.request.get('http://localhost:8081/northlight/')).text();
  ok('live site contains the edit', live.includes('Rooms with daylight'));
  ok('live site contains the uploaded image', live.includes('/_assets/'));
  ok('live site has no editor markup', !live.includes('contenteditable') && !live.includes('class="tb"'));
  await p.click('.dlg button:has-text("Close")');

  console.log('the live site');
  const v = await ctx.newPage();
  const verrs = [];
  v.on('pageerror', e => verrs.push(e.message));
  await v.goto('http://localhost:8081/northlight/');
  await v.waitForSelector('.s-hero');
  ok('live hero text', (await v.locator('.s-page:not([hidden]) .s-hero h1').innerText()) === 'Rooms with daylight');
  await v.locator('.s-page:not([hidden]) .s-links a:has-text("Contact")').first().click();
  ok('nav link switches page and sets the address', v.url().endsWith('#contact') && await poll(async () => (await v.locator('.s-page:not([hidden]) h1').first().innerText()) === 'Contact'));
  await v.locator('.s-page:not([hidden]) .s-btn:has-text("Switch light and dark")').click();
  ok('dark mode action', await v.locator('#site').evaluate(e => e.classList.contains('dark')));
  await v.goto('http://localhost:8081/northlight/#home');
  await v.reload();
  await v.locator('.s-page:not([hidden]) .s-btn:has-text("Say hello")').click();
  ok('popup opens', await v.locator('.s-popup:not(.is-hidden)').count() === 1);
  await v.keyboard.press('Escape');
  ok('Escape closes the popup', await v.locator('.s-popup:not(.is-hidden)').count() === 0);
  ok('live site has no script errors', verrs.length === 0, verrs.join('; '));
  ok('admin app is not reachable from the sites origin', (await v.request.get('http://localhost:8081/api/auth/status')).status() === 404);

  console.log('persistence and conflicts');
  await p.reload();
  await p.waitForSelector('.s-hero h1');
  ok('edit survives a reload', (await p.locator('.s-hero h1').innerText()) === 'Rooms with daylight');
  const token = await p.evaluate(() => localStorage.getItem('sitewright.token'));
  const id = siteUrl.split('/').pop();
  const cur = await (await p.request.get(`http://localhost:8080/api/sites/${id}`, { headers: { Authorization: 'Bearer ' + token } })).json();
  ok('unpublished-changes flag is clear after publish', cur.unpublishedChanges === false);
  // someone else saves in the meantime
  const sr = await p.request.put(`http://localhost:8080/api/sites/${id}/draft`, { headers: { Authorization: 'Bearer ' + token }, data: { baseVersion: cur.version, document: cur.document } });
  ok('other editor saves', sr.status() === 200);
  await p.locator('.s-hero h1').click(); await p.locator('.s-hero h1').click(); await p.keyboard.press('Control+A'); await p.keyboard.type('Late edit');
  await p.waitForSelector('.banner', { timeout: 8000 });
  ok('conflict banner appears', (await p.locator('.banner').innerText()).includes('Someone else saved'));
  await p.screenshot({ path: OUT + '/e2e-conflict.png' });
  await p.click('.banner button:has-text("Reload")');
  await p.waitForSelector('.banner', { state: 'detached' });
  ok('reload clears the conflict and shows server content', (await p.locator('.s-hero h1').innerText()) === 'Rooms with daylight');

  console.log('sign out and users page');
  await p.goto('http://localhost:8080/users');
  await p.waitForSelector('h1:has-text("Users")');
  await p.fill('#ue', 'eve@example.com'); await p.fill('#up', 'another long one'); await p.fill('#un', 'Eve');
  await p.click('button:has-text("Add user")');
  await p.waitForSelector('text=Added eve@example.com');
  ok('admin adds a user', true);
  await p.click('button:has-text("Sign out")');
  await p.waitForURL('**/login');
  await p.fill('#em', 'eve@example.com'); await p.fill('#pw', 'another long one'); await p.click('button[type=submit]');
  await p.waitForSelector('text=No sites yet');
  ok("the new user does not see the admin's site", true);
  await p.goto('http://localhost:8080/users');
  await p.waitForURL('http://localhost:8080/');
  ok('non-admin cannot open Users', true);

  ok('no console errors in the admin app', errors.length === 0, errors.join(' | '));
  console.log(`\npassed ${passed}, failed ${failed}`);
  await b.close();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message.split('\n').slice(0, 6).join('\n')); process.exit(2); });
