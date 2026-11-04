/* Phase 5 tests: document model (per-quotation company/bank/currency snapshot, line-discount note, duplicate dates,
   {advance} term token, Company-settings fields, logo transparency, import/migration).
   Usage: node phase5.test.js <html>     Needs: playwright, python3 + openpyxl */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const FILE = path.resolve(process.argv[2] || 'quotation-builder_V13g.html');
const ALL_ERRORS = [];
const results = []; const rec = (id, name, ok, detail) => results.push({ id, name, ok: !!ok, detail: detail || '' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const Q = (id, o = {}) => Object.assign({ id, title: 't', quoteNo: 'QT-' + id, date: '2026-01-05', validUntil: '2026-01-19', customerName: 'Cust', address: '',
  items: [{ id: 'i1', photo: '', description: 'Oven', qty: 2, unitPrice: 1000, discountType: 'pct', discountValue: 0 }],
  discountType: 'pct', discountValue: 0, advancePct: 65, showAdvance: true, showBank: true, terms: ['Pay {advance}% now.', 'Fixed 65% text stays.'], createdAt: 1, updatedAt: 1000 }, o);
async function open(browser, o = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true, timezoneId: 'Asia/Colombo' });
  await ctx.route(/^https?:/, r => r.abort());
  const page = await ctx.newPage(); const R = { ctx, page, errors: [] }; page.on('pageerror', e => { R.errors.push(String(e)); ALL_ERRORS.push(String(e)); });
  if (o.time) await page.clock.install({ time: o.time });
  await page.addInitScript(`if(!localStorage.getItem('__s')){localStorage.setItem('__s','1');
    localStorage.setItem('qb_quotes_v2',${JSON.stringify(JSON.stringify(o.quotes || []))});
    localStorage.setItem('qb_settings_v2',${JSON.stringify(JSON.stringify(o.settings || {}))});}`);
  await page.goto('file://' + FILE); await page.waitForSelector('#docRoot'); R.local = () => page.evaluate(() => JSON.parse(localStorage.getItem('qb_quotes_v2') || '[]'));
  R.doc = async () => (await page.locator('#docRoot').innerText()).replace(/\s+/g, ' ');
  R.settings = async (fields) => { await page.click('#settingsBtn'); for (const [id, v] of Object.entries(fields)) { const el = page.locator('#' + id); if (v === true || v === false) await el.setChecked(v); else await el.fill(String(v)); } await page.click('#companySave'); await sleep(150); };
  return R;
}
(async () => {
  const browser = await chromium.launch();
  const S0 = { companyName: 'OLD CO', currency: 'LKR', bank: { accountName: 'Old Acc', accountNumber: '111', bankName: 'Old Bank', branch: 'Old Br' } };

  /* snapshot: old quotation unaffected, new quotation uses new details */
  { const R = await open(browser, { quotes: [Q('A')], settings: S0 });
    const before = await R.doc();
    await R.settings({ cs_name: 'NEW CO', cs_currency: 'USD', cs_bAccName: 'New Acc', cs_bAccNo: '999' });
    const after = await R.doc(); const loc = (await R.local()).find(q => q.id === 'A');
    rec('Q1', 'Existing quotation keeps its company name, bank details and currency after Company settings change', /OLD CO/.test(after) && /Old Acc/.test(after) && /LKR 2,000/.test(after) && !/NEW CO|USD|New Acc/.test(after) && /OLD CO/.test(before) && loc.company && loc.company.companyName === 'OLD CO', after.slice(0, 160));
    await R.page.click('#newQuoteBtn'); await sleep(200); const nd = await R.doc();
    rec('Q2', 'A NEW quotation uses the new company name, bank details and currency', /NEW CO/.test(nd) && /New Acc/.test(nd) && /USD/.test(nd), nd.slice(0, 120));
    const side = await R.page.locator('.qcard').allInnerTexts();
    rec('Q3', 'Sidebar shows each quotation in its own currency (LKR on the old one, USD on the new one)', side.some(t => /LKR 2,000/.test(t)) && side.some(t => /USD/.test(t)), side.map(t => t.replace(/\s+/g, ' ')).join(' | ').slice(0, 160));
    await R.ctx.close(); }

  /* migration of quotations saved before snapshots existed */
  { const R = await open(browser, { quotes: [Q('A')], settings: S0 });
    const loc = (await R.local())[0];
    rec('Q4', 'A quotation saved by an older version gets a snapshot of the current company details when first opened', loc.company && loc.company.companyName === 'OLD CO' && loc.company.bank.accountName === 'Old Acc', JSON.stringify(loc.company).slice(0, 100));
    await R.ctx.close(); }

  /* bank edit in the editor affects only this quotation; refresh button */
  { const R = await open(browser, { quotes: [Q('A', { updatedAt: 2000 }), Q('B', { updatedAt: 1000 })], settings: S0 });
    await R.page.locator('#f_bankAccName').fill('Edited Acc'); await sleep(400);
    const [a, b] = [(await R.local()).find(q => q.id === 'A'), (await R.local()).find(q => q.id === 'B')];
    const st = await R.page.evaluate(() => JSON.parse(localStorage.getItem('qb_settings_v2')).bank.accountName);
    rec('Q5', 'Editing bank details inside a quotation changes only that quotation (not the other quotation, not Company settings)', a.company.bank.accountName === 'Edited Acc' && b.company.bank.accountName === 'Old Acc' && st === 'Old Acc', `A=${a.company.bank.accountName} B=${b.company.bank.accountName} settings=${st}`);
    await R.page.click('#refreshCompanyBtn'); await sleep(400);
    const a2 = (await R.local()).find(q => q.id === 'A');
    rec('Q6', '"Use current Company settings" refreshes that quotation from Company settings', a2.company.bank.accountName === 'Old Acc', a2.company.bank.accountName);
    await R.ctx.close(); }

  /* line discount shown */
  { const it = [{ id: 'i1', photo: '', description: 'Oven', qty: 2, unitPrice: 1000, discountType: 'pct', discountValue: 10 }, { id: 'i2', photo: '', description: 'Fryer', qty: 1, unitPrice: 5000, discountType: 'flat', discountValue: 500 }, { id: 'i3', photo: '', description: 'Plain', qty: 1, unitPrice: 100, discountType: 'pct', discountValue: 0 }];
    const R = await open(browser, { quotes: [Q('A', { items: it })], settings: S0 });
    const d = await R.doc();
    rec('Q7', 'Preview shows "Discount: 10%" and "Discount: LKR 500.00" under the discounted items only', /Discount: 10%/.test(d) && /Discount: LKR 500\.00/.test(d) && (await R.page.locator('#docRoot .disc-note').count()) === 2, (await R.page.locator('#docRoot .disc-note').allInnerTexts()).join(' | '));
    const [dl] = await Promise.all([R.page.waitForEvent('download'), R.page.click('#excelBtn')]); const f = path.join(os.tmpdir(), 'p5.xlsx'); await dl.saveAs(f);
    const out = cp.execFileSync('python3', ['-c', `import openpyxl;ws=openpyxl.load_workbook(r'${f}').active;print('|'.join(str(ws.cell(r,3).value) for r in range(13,16)))`], { encoding: 'utf8' });
    rec('Q8', 'Excel description cells carry the same discount note', /Oven\nDiscount: 10%/.test(out) && /Fryer\nDiscount: LKR 500\.00/.test(out) && !/Plain\nDiscount/.test(out), out.replace(/\n/g, ' / ').slice(0, 120));
    await R.ctx.close(); }

  /* duplicate dates + {advance} token */
  { const R = await open(browser, { quotes: [Q('A')], settings: S0, time: new Date('2026-10-13T19:30:00Z') });   // 14 Oct 2026, 01:00 Colombo
    await R.page.locator('.qcard').first().hover(); await R.page.locator('[data-act="dup"]').first().click(); await sleep(300);
    const dup = (await R.local()).find(q => q.title.includes('(copy)'));
    rec('Q9', 'Duplicating a quotation resets its date to today and valid-until to today + 14 days', dup.date === '2026-10-14' && dup.validUntil === '2026-10-28', `${dup.date} / ${dup.validUntil}`);
    const d = await R.doc();
    rec('Q10', '{advance} in a term shows the quotation\'s advance %, while fixed text is untouched', /Pay 65% now\./.test(d) && /Fixed 65% text stays\./.test(d), d.match(/Pay [^.]*\./) + '');
    await R.page.locator('#f_advancePct').fill('40'); await sleep(300);
    rec('Q11', 'Changing the advance % updates the term wording (65% -> 40%)', /Pay 40% now\./.test(await R.doc()), '');
    await R.ctx.close(); }

  /* Company settings fields drive new quotations */
  { const R = await open(browser, { settings: S0, time: new Date('2026-10-13T19:30:00Z') });
    await R.settings({ cs_valid: 30, cs_advDefault: false, cs_terms: 'First term {advance}%\nSecond term' });
    await R.page.click('#newQuoteBtn'); await sleep(300);
    const q = (await R.local()).sort((a, b) => b.createdAt - a.createdAt)[0];
    rec('Q12', 'New quotations follow the Company settings for validity days, default terms and "Required Advance" default', q.validUntil === '2026-11-13' && q.showAdvance === false && q.terms.join('|') === 'First term {advance}%|Second term', `${q.validUntil} ${q.showAdvance} ${q.terms}`);
    await R.ctx.close(); }

  /* logo transparency */
  { const R = await open(browser, { settings: S0 });
    const png = await R.page.evaluate(() => { const c = document.createElement('canvas'); c.width = 40; c.height = 20; const x = c.getContext('2d'); x.fillStyle = 'rgba(255,0,0,0.5)'; x.fillRect(0, 0, 20, 20); return c.toDataURL('image/png').split(',')[1]; });
    await R.page.click('#settingsBtn');
    await R.page.setInputFiles('#logoInput', { name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') }); await sleep(500);
    const info = await R.page.evaluate(async () => { const url = document.querySelector('#logoPreview img').src; const im = new Image(); im.src = url; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return { type: url.slice(5, 14), alphaRight: x.getImageData(35, 10, 1, 1).data[3], alphaLeft: x.getImageData(5, 10, 1, 1).data[3] }; });
    rec('Q13', 'A transparent PNG logo stays PNG and stays transparent (not flattened onto white)', info.type === 'image/png' && info.alphaRight === 0 && info.alphaLeft > 0, JSON.stringify(info));
    await R.ctx.close(); }

  /* import / sanitising */
  { const R = await open(browser, { settings: S0 });
    const old = { quotes: [Q('OLD1', { updatedAt: 5 })] };     // backup from an older version: no company snapshot
    const evil = Q('EVIL', { updatedAt: 6, company: { companyName: '<img src=x onerror=window.__xss=1>', currency: '"><b>', bank: { accountName: 'x'.repeat(9000) }, bogus: 1 } });
    await R.page.setInputFiles('#importInput', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ quotes: [old.quotes[0], evil] })) });
    await R.page.waitForSelector('#confirmModal.show'); await R.page.click('#confirmOk'); await sleep(400);
    const loc = await R.local(); const o1 = loc.find(q => q.id === 'OLD1'), ev = loc.find(q => q.id === 'EVIL');
    await R.page.locator('[data-id="EVIL"]').click(); await sleep(200);
    const xss = await R.page.evaluate(() => window.__xss === 1), inj = await R.page.locator('img[onerror]').count();
    rec('Q14', 'Imported old backup gets a snapshot; a hostile company block is cleaned (no script, length capped, unknown keys dropped, bad currency fixed)', o1.company && !xss && inj === 0 && ev.company.bank.accountName.length === 500 && !('bogus' in ev.company) && !/[<>"]/.test(ev.company.currency), `xss=${xss} acc=${ev.company.bank.accountName.length} cur=${ev.company.currency}`);
    await R.ctx.close(); }

  rec('Q15', 'No uncaught JavaScript errors in any scenario', ALL_ERRORS.length === 0, ALL_ERRORS.slice(0, 3).join(' | '));
  await browser.close();
  let pass = 0; for (const r of results) { if (r.ok) pass++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id.padEnd(4)} ${r.name}${r.ok ? '' : '\n        -> ' + r.detail}`); }
  console.log(`\n${pass}/${results.length} passed  (${path.basename(FILE)})`); process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
