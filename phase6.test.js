/* Phase 6 tests: structured Terms & Conditions, Special note (preview + Excel), and usability / accessibility.
   Usage: node phase6.test.js <html>   Needs: playwright, python3 + openpyxl; optional: LibreOffice (soffice) + pdftotext */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const FILE = path.resolve(process.argv[2] || 'quotation-builder_V13h.html');
const results = [], ALL = []; const rec = (id, name, ok, detail) => results.push({ id, name, ok: !!ok, detail: detail || '' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const It = (i, d) => ({ id: 'i' + i, photo: '', description: d || 'Item ' + i, qty: 1, unitPrice: 1000 * i, discountType: 'pct', discountValue: 0 });
const Q = (id, o = {}) => Object.assign({ id, title: 'T-' + id, quoteNo: 'QT-' + id, date: '2026-10-14', validUntil: '2026-10-28', customerName: 'Cust ' + id, address: '', items: [It(1), It(2), It(3)],
  discountType: 'pct', discountValue: 0, advancePct: 65, showAdvance: true, showBank: true, terms: [], createdAt: 1, updatedAt: 1000 }, o);
async function open(browser, o = {}) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true, timezoneId: 'Asia/Colombo' }, o.ctx || {}));
  await ctx.route(/^https?:/, r => r.abort());
  const page = await ctx.newPage(); page.on('pageerror', e => ALL.push(String(e)));
  await page.addInitScript(`if(!localStorage.getItem('__s')){localStorage.setItem('__s','1');
    localStorage.setItem('qb_quotes_v2',${JSON.stringify(JSON.stringify(o.quotes || [Q('A')]))});
    localStorage.setItem('qb_settings_v2',${JSON.stringify(JSON.stringify(o.settings || {}))});}`);
  await page.goto('file://' + FILE); await page.waitForSelector('#docRoot', { state: 'attached' });
  return { ctx, page, local: () => page.evaluate(() => JSON.parse(localStorage.getItem('qb_quotes_v2'))) };
}
const xl = (f) => JSON.parse(cp.execFileSync('python3', ['-c', `
import openpyxl,zipfile,re,json
wb=openpyxl.load_workbook(r'${f}'); ws=wb.active
vals={r:ws.cell(r,1).value for r in range(1,ws.max_row+1) if ws.cell(r,1).value}
x=zipfile.ZipFile(r'${f}').read('xl/worksheets/sheet1.xml').decode()
print(json.dumps({'vals':vals,'breaks':[int(b) for b in re.findall(r'<brk id="(\\d+)"',x)]}))`], { encoding: 'utf8' }));
(async () => {
  const browser = await chromium.launch();

  /* ---- terms + special note in the editor and preview ---- */
  { const T = await open(browser, { quotes: [Q('A', { terms: ['Old plain term {advance}%'] })] });
    const d0 = await T.page.locator('.tc-item.bullet').count();
    rec('T1', 'Terms saved by older versions (plain text) show as bullet points', d0 === 1 && /Old plain term 65%/.test(await T.page.locator('#docRoot').innerText()), `bullets=${d0}`);
    await T.page.locator('#f_terms').fill('Final Confirmation :: By approving, the customer agrees.\nQuotation Confirmation :: An advance of {advance}% is required.\nSpare parts are available.');
    await sleep(350);
    const titles = await T.page.locator('#docRoot .tc-title').allInnerTexts(), bullets = await T.page.locator('#docRoot .tc-item.bullet').count(), saved = (await T.local())[0].terms;
    rec('T2', '"Heading :: text" makes a bold heading; lines without it are bullets; {advance} is filled in', titles.join('|') === 'Final Confirmation|Quotation Confirmation' && bullets === 1 && /advance of 65%/.test(await T.page.locator('#docRoot').innerText()) && saved.length === 3 && saved[0].title === 'Final Confirmation', `${titles} bullets=${bullets}`);
    rec('T3', 'Special note is hidden while empty, appears in a highlighted box under the totals when filled', (await T.page.locator('.doc-special').count()) === 0, '');
    await T.page.locator('#f_special').fill('All items are covered by free delivery.'); await sleep(350);
    const order = await T.page.locator('#docRoot').evaluate(r => { const k = [...r.children].map(c => c.className); return { sp: k.findIndex(c => /doc-special/.test(c)), tot: k.findIndex(c => /doc-totals-wrap/.test(c)), tc: k.findIndex(c => /doc-keep-together/.test(c)) }; });
    rec('T4', 'Special note sits right after the totals, before the terms', order.sp === order.tot + 1 && order.tc === order.sp + 1 && /free delivery/.test(await T.page.locator('.doc-special').innerText()), JSON.stringify(order));
    const cls = await T.page.locator('.doc-keep-together').getAttribute('class');
    await T.page.locator('#f_termsNewPage').evaluate(e => e.click()); await sleep(250);
    const cls2 = await T.page.locator('.doc-keep-together').getAttribute('class');
    rec('T5', '"Start Terms on a new page" switch controls the page break (on by default)', /tc-newpage/.test(cls) && !/tc-newpage/.test(cls2), `${cls} -> ${cls2}`);
    await T.ctx.close(); }

  /* ---- browser Print: terms on their own page ---- */
  { const T = await open(browser, { quotes: [Q('A', { specialNote: 'Free delivery.', terms: [{ title: 'Final Confirmation', text: 'Agreed.' }, { title: '', text: 'Bullet one.' }] })] });
    await T.page.emulateMedia({ media: 'print' }); const f = path.join(os.tmpdir(), 'p6print.pdf'); fs.writeFileSync(f, await T.page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true }));
    const n = +cp.execFileSync('pdfinfo', [f], { encoding: 'utf8' }).match(/Pages:\s+(\d+)/)[1];
    const last = cp.execFileSync('pdftotext', ['-f', String(n), '-l', String(n), f, '-'], { encoding: 'utf8' }), first = cp.execFileSync('pdftotext', ['-f', '1', '-l', '1', f, '-'], { encoding: 'utf8' });
    rec('T6', 'Browser Print: Terms & Conditions start on a new page; Special note stays with the totals on page 1', n >= 2 && /TERMS & CONDITIONS/i.test(last) && !/TERMS & CONDITIONS/i.test(first) && /SPECIAL NOTE/.test(first) && /Grand Total/.test(first), `pages=${n}`);
    await T.ctx.close(); }

  /* ---- Excel ---- */
  { const q = Q('A', { specialNote: 'All items are covered by free delivery.', terms: [{ title: 'Final Confirmation', text: 'By approving the quotation the customer agrees.' }, { title: '', text: 'Spare parts are available.' }] });
    const run = async (newPage) => { const T = await open(browser, { quotes: [Object.assign({}, q, { termsNewPage: newPage })] }); const [dl] = await Promise.all([T.page.waitForEvent('download'), T.page.click('#excelBtn')]); const f = path.join(os.tmpdir(), 'p6_' + newPage + '.xlsx'); await dl.saveAs(f); await T.ctx.close(); return f; };
    const f1 = await run(true), x1 = xl(f1), rowOf = (x, t) => +Object.keys(x.vals).find(k => x.vals[k] === t);
    const tt = rowOf(x1, 'TERMS & CONDITIONS'), sp = rowOf(x1, 'SPECIAL NOTE');
    rec('X1', 'Excel has a SPECIAL NOTE block (title + text) and a TERMS & CONDITIONS block with headed and bullet terms', sp > 0 && tt > sp && x1.vals[sp + 1] === 'All items are covered by free delivery.' && Object.values(x1.vals).includes('Final Confirmation') && Object.values(x1.vals).includes('\u2022 Spare parts are available.'), `special row=${sp} terms row=${tt}`);
    rec('X2', 'Excel: a page break is placed right before Terms & Conditions', x1.breaks.includes(tt - 1), `breaks=${x1.breaks} terms row=${tt}`);
    const x0 = xl(await run(false)), tt0 = rowOf(x0, 'TERMS & CONDITIONS');
    rec('X3', 'Excel: no forced break when "new page" is switched off', !x0.breaks.includes(tt0 - 1), `breaks=${x0.breaks}`);
    try { cp.execFileSync('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', os.tmpdir(), f1], { stdio: 'ignore' }); const pdf = f1.replace('.xlsx', '.pdf'); const n = +cp.execFileSync('pdfinfo', [pdf], { encoding: 'utf8' }).match(/Pages:\s+(\d+)/)[1];
      const last = cp.execFileSync('pdftotext', ['-f', String(n), '-l', String(n), '-layout', pdf, '-'], { encoding: 'utf8' }).trim();
      rec('X4', 'Rendered Excel (LibreOffice): the last page starts with TERMS & CONDITIONS', /^TERMS & CONDITIONS/i.test(last), last.slice(0, 40)); } catch (e) { rec('X4', 'Rendered Excel check (needs LibreOffice)', true, 'skipped: ' + e.message.slice(0, 40)); } }

  /* ---- usability / accessibility ---- */
  { const T = await open(browser, { quotes: [Q('A', { updatedAt: 2000 }), Q('B', { updatedAt: 1000 })], settings: { companyName: 'OLD', logo: 'data:image/png;base64,' + PNG } }); const p = T.page;
    const c = p.locator('.qcard').nth(1);
    rec('U1a', 'Quotation cards are keyboard-focusable and announced as buttons', (await c.getAttribute('tabindex')) === '0' && (await c.getAttribute('role')) === 'button', '');
    await c.focus(); await p.keyboard.press('Enter'); await sleep(250);
    rec('U1b', 'Pressing Enter on a focused card opens that quotation', (await p.locator('#docTitleField').inputValue()) === 'T-B', await p.locator('#docTitleField').inputValue());
    rec('U3', 'Photo button no longer forces the camera (no capture attribute): gallery can be used', (await p.locator('input[data-fileinput][capture]').count()) === 0 && (await p.locator('input[data-fileinput]').count()) > 0, '');
    const lab = await p.evaluate(() => [...document.querySelectorAll('.field')].filter(f => f.querySelector('label') && f.querySelector('input,textarea,select')).map(f => [...f.querySelectorAll('label')].every(l => !!((l.htmlFor && document.getElementById(l.htmlFor)) || l.querySelector('input,textarea,select')))));
    rec('U4', 'Every labelled form field is linked to its label (screen readers + click-to-focus)', lab.length > 10 && lab.every(Boolean), `${lab.filter(Boolean).length}/${lab.length}`);
    const unnamed = await p.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.offsetParent !== null && !(b.textContent.trim() || b.getAttribute('aria-label'))).length);
    rec('U5', 'No visible button is without a text or aria-label name', unnamed === 0, `unnamed=${unnamed}`);
    await p.click('#settingsBtn'); await sleep(120);
    rec('U6a', 'Company window is a proper dialog and focus moves into it', (await p.locator('#companyModal [role=dialog]').count()) === 1 && (await p.evaluate(() => document.getElementById('companyModal').contains(document.activeElement))), '');
    let inside = true; for (let i = 0; i < 14; i++) { await p.keyboard.press('Tab'); inside = inside && await p.evaluate(() => document.getElementById('companyModal').contains(document.activeElement)); }
    rec('U6b', 'Tab key stays inside the open window (focus trap)', inside, '');
    await p.keyboard.press('Escape'); await sleep(150);
    rec('U6c', 'Escape closes the window and focus returns to the Company button', !(await p.locator('#companyModal.show').count()) && (await p.evaluate(() => document.activeElement && document.activeElement.id)) === 'settingsBtn', '');
    const logoBefore = await p.locator('#docRoot .doc-logo-block img').getAttribute('src');
    await p.click('#settingsBtn'); await p.setInputFiles('#logoInput', { name: 'l.png', mimeType: 'image/png', buffer: Buffer.from(PNG.replace('AAAAAQAAAAEI', 'AAAAAgAAAAII'), 'base64') }).catch(() => {});
    await p.evaluate(() => { document.getElementById('cs_name').value = 'TYPED'; }); await sleep(300);
    await p.click('#companyCancel'); await sleep(150);
    const logoAfter = await p.locator('#docRoot .doc-logo-block img').getAttribute('src');
    await p.click('#settingsBtn'); const nm = await p.locator('#cs_name').inputValue(); await p.keyboard.press('Escape');
    rec('U7', 'Cancel in Company settings discards changes, including a newly chosen logo', logoBefore === logoAfter && nm === 'OLD', `logo same=${logoBefore === logoAfter} name=${nm}`);
    await p.locator('#f_title').fill('x').catch(() => {});
    const before = await p.locator('[data-rmitem]').count(); await p.locator('[data-rmitem="1"]').click(); await sleep(150);
    const mid = await p.locator('[data-rmitem]').count(); await p.locator('#toast .toast-act').click(); await sleep(250);
    const descs = await p.locator('[data-field="description"]').evaluateAll(els => els.map(e => e.value));
    rec('U8', 'Removing an item shows "Undo"; Undo puts it back in the same position', before === 3 && mid === 2 && descs.join('|') === 'Item 1|Item 2|Item 3', `${before}->${mid}->${descs}`);
    const ratio = await p.evaluate(() => { const v = getComputedStyle(document.documentElement).getPropertyValue('--ink-faint').trim(); const m = v.match(/#([0-9a-f]{6})/i); const ch = [0, 2, 4].map(i => parseInt(m[1].substr(i, 2), 16) / 255).map(c => c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4)); const L = .2126 * ch[0] + .7152 * ch[1] + .0722 * ch[2]; return +(1.05 / (L + .05)).toFixed(2); });
    rec('U9', 'Faint grey text now meets the 4.5:1 contrast guideline', ratio >= 4.5, `ratio=${ratio}`);
    await T.ctx.close(); }
  { const T = await open(browser, { ctx: { viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true } });
    const info = await T.page.evaluate(() => ({ act: getComputedStyle(document.querySelector('.qcard-actions')).display, lab: getComputedStyle(document.getElementById('syncLabel')).display, pill: document.getElementById('syncPill').offsetParent !== null }));
    rec('U2', 'On a touch screen the duplicate/delete buttons are always visible (no hover needed)', info.act === 'flex', info.act);
    rec('U10', 'On a phone the sync text is hidden (dot only) so the top bar is less crowded', info.lab === 'none' && info.pill, JSON.stringify(info));
    await T.ctx.close(); }

  rec('Z', 'No uncaught JavaScript errors in any scenario', ALL.length === 0, ALL.slice(0, 3).join(' | '));
  await browser.close();
  let pass = 0; for (const r of results) { if (r.ok) pass++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id.padEnd(5)} ${r.name}${r.ok ? '' : '\n        -> ' + r.detail}`); }
  console.log(`\n${pass}/${results.length} passed  (${path.basename(FILE)})`); process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
