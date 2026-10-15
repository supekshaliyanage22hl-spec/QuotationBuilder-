/* Phase 4 tests: Excel fidelity (size, colours, real formulas, web pictures, document properties, layout kept).
   Usage: node phase4_excel.test.js <new-html> [old-html]
   Needs: playwright (+ chromium), sharp, python3 + openpyxl, LibreOffice (soffice), pdfinfo, pdftotext, pdftoppm.
   The browser has NO internet: web pictures are served by Playwright's route() from https://img.test/ . */
const { chromium } = require('playwright');
const sharp = require('sharp');
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const FILE = path.resolve(process.argv[2] || '../quotation-builder_V13e.html');
const OLD = process.argv[3] ? path.resolve(process.argv[3]) : null;
const HERE = __dirname;
const OUT = path.join(HERE, '..', 'out'); fs.mkdirSync(OUT, { recursive: true });
const sh = (cmd, args, o) => cp.execFileSync(cmd, args, Object.assign({ encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }, o || {}));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rows = [];  // {id, name, res: {new:bool, old:bool|null}, detail}
const rec = (id, name, tag, ok, detail) => { let r = rows.find(x => x.id === id); if (!r) rows.push(r = { id, name, res: {}, detail: {} }); r.res[tag] = !!ok; if (!ok && detail) r.detail[tag] = String(detail).slice(0, 220); };

/* ---------- scenario data (seeded into localStorage BEFORE the page loads) ---------- */
function SEED(o) {
  if (localStorage.getItem('__seeded')) return; localStorage.setItem('__seeded', '1');
  const mk = (w, h, c, type) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.font = 'bold 28px sans-serif'; x.fillText('pic', 10, 40); return cv.toDataURL(type || 'image/jpeg', 0.9); };
  const items = o.items.map((it, i) => Object.assign({ id: 'i' + i, qty: 1, unitPrice: 1000, discountType: 'pct', discountValue: 0, description: 'Item ' + (i + 1) }, it,
    it.photoKind === 'jpeg' ? { photo: mk(300, 200, '#355c7d') } : it.photoKind === 'png' ? { photo: mk(300, 300, '#2c7a4b', 'image/png') } : it.photoKind === 'webpdata' ? { photo: mk(300, 300, '#b5651d', 'image/webp') } : {}));
  const q = Object.assign({ id: 'q1', title: 't', quoteNo: 'QT-004', date: '2026-10-14', validUntil: '2026-10-28', customerName: 'Agnus Hotel & "Spa"', address: 'No 12, Galle Road, Colombo 03',
    discountType: 'pct', discountValue: 5, advancePct: 65, showAdvance: true, showBank: true,
    terms: ['Advance payments are non-refundable under any circumstances, except in cases of delivery delays caused by us or unavailability of stock. ' .repeat(2), 'Bank transfer or Card payment available.'], createdAt: 1, updatedAt: 1 }, o.quote || {}, { items });
  localStorage.setItem('qb_quotes_v2', JSON.stringify([q]));
  localStorage.setItem('qb_settings_v2', JSON.stringify({ logo: o.noLogo ? '' : mk(600, 200, '#c9820a', 'image/png'), companyName: 'KITCHEN HUB', subline: 'Hotel & Restaurant Kitchen Equipment Supplier', address: 'No. 149, Matara Road, Unawatuna, Galle', phone: '+94 76 487 5776', email: 'kitchenhubbranch@gmail.com', website: 'www.kitchenhubb.lk', currency: 'LKR',
    bank: { accountName: 'KITCHEN HUB (PVT) LTD', accountNumber: '1234567890', bankName: 'Sample Bank PLC', branch: 'Galle' }, updatedAt: 1 }));
}

const SC = {
  S1: { items: [
    { qty: 2, unitPrice: 12500, photoKind: 'jpeg', description: 'Commercial gas cooker\nSize: 835*775*900 mm\nMaterial: Stainless steel 304\nBurners: 4' },
    { qty: 3, unitPrice: 8333.33, discountType: 'pct', discountValue: 10, photoKind: 'png', description: 'Work table with undershelf' },
    { qty: 1, unitPrice: 100000, discountType: 'flat', discountValue: 2500.5, description: 'Chiller - 2 door' },
    { qty: 7, unitPrice: 1234.5, discountType: 'pct', discountValue: 12.5, photoKind: 'webpdata', description: 'Wall shelf' } ] },
  S2: { items: [   // web pictures
    { qty: 1, unitPrice: 5000, photo: 'https://img.test/ok.png', description: 'Web PNG' },
    { qty: 1, unitPrice: 6000, photo: 'https://img.test/ok.webp', description: 'Web WEBP (needs converting)' },
    { qty: 1, unitPrice: 7000, photo: 'https://img.test/blocked.png', description: 'Blocked web picture' } ] },
  S3: { quote: { discountType: 'flat', discountValue: 1500, showBank: false, showAdvance: false, terms: [] }, items: [
    { qty: 2, unitPrice: 3000, description: 'Pan' }, { qty: 1, unitPrice: 999.99, description: 'Lid' } ] },
  S4: { noLogo: true, items: [ { qty: 3, unitPrice: 123456789.5, description: 'Very expensive machine' }, { qty: 1, unitPrice: 98765432.1, description: 'Another' } ] },
  S5: { quote: { discountType: 'pct', discountValue: 100 }, items: [ { qty: 1, unitPrice: 2500, discountType: 'pct', discountValue: 250, description: 'Over-discounted line (clamped)' }, { qty: 2, unitPrice: 4000, discountType: 'flat', discountValue: 99999, description: 'Flat larger than gross (clamped)' } ] },
  S6: { items: [] },
  S7: { quote: { terms: ['First term: Advance payments are non-refundable under any circumstances.', 'Second term.', 'Third term.'] },
        items: [...Array(6)].map((_, i) => ({ qty: i + 1, unitPrice: 15000 + i * 777, photoKind: i % 2 ? 'jpeg' : 'png', description: 'Item ' + (i + 1) + ' - Commercial kitchen equipment\nSize: 835*775*900 mm\nMaterial: Stainless steel' })) },
  S8: { quote: { terms: ['Alpha term text.', 'Beta term text.'] },
        items: [...Array(5)].map((_, i) => ({ qty: 1, unitPrice: 9000, photoKind: 'jpeg', description: 'Row ' + (i + 1) + '\nline two\nline three\nline four' })) },
};

async function exportXlsx(browser, file, key, tag) {
  const png = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#2a6f97' } }).png().toBuffer();
  const webp = await sharp({ create: { width: 320, height: 320, channels: 3, background: '#9d4edd' } }).webp().toBuffer();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1200 }, acceptDownloads: true, timezoneId: 'Asia/Colombo' });
  const reqs = [];
  await ctx.route(/^https?:/, r => {
    const u = r.request().url(); reqs.push(u);
    const cors = { 'access-control-allow-origin': '*' };
    if (u === 'https://img.test/ok.png') return r.fulfill({ status: 200, contentType: 'image/png', headers: cors, body: png });
    if (u === 'https://img.test/ok.webp') return r.fulfill({ status: 200, contentType: 'image/webp', headers: cors, body: webp });
    return r.abort();
  });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(SEED, Object.assign({}, SC[key]));
  await page.goto('file://' + file); await page.waitForSelector('#docRoot .doc-table', { state: 'attached' });
  const shown = await page.evaluate(() => ({
    lines: [...document.querySelectorAll('.item-row-print')].map(r => r.cells[5].textContent),
    totals: [...document.querySelectorAll('.doc-totals td.v')].map(td => td.textContent),
    adv: (document.querySelector('.doc-req-advance .v') || {}).textContent || null }));
  const dl = page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
  await page.click('#excelBtn');
  const d = await dl; let toasts = [];
  const file1 = path.join(OUT, `${tag}_${key}.xlsx`);
  if (d) await d.saveAs(file1);
  for (let i = 0; i < 14; i++) { await sleep(300); const t = await page.locator('#toast').innerText().catch(() => ''); if (t && !toasts.includes(t)) toasts.push(t); }
  await ctx.close();
  return { file: d ? file1 : null, toasts, errors, shown, reqs };
}
const inspect = f => JSON.parse(sh('python3', [path.join(HERE, 'phase4_inspect.py'), f], { maxBuffer: 1 << 26 }));
const num = s => s == null ? null : Number(String(s).replace(/[^0-9.\-]/g, ''));
function loRecalc(xlsx, tag) {   // strip saved results, let LibreOffice calculate, read back
  const stripped = xlsx.replace(/\.xlsx$/, '_nocache.xlsx');
  sh('python3', [path.join(HERE, 'phase4_strip_cache.py'), xlsx, stripped]);
  const dir = path.join(OUT, 'recalc_' + tag); fs.mkdirSync(dir, { recursive: true });
  sh('soffice', ['--headless', '--convert-to', 'xlsx:Calc MS Excel 2007 XML', '--outdir', dir, stripped], { timeout: 120000 });
  return inspect(path.join(dir, path.basename(stripped)));
}
function loPdf(xlsx) {
  const dir = path.join(OUT, 'pdf'); fs.mkdirSync(dir, { recursive: true });
  sh('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', dir, xlsx], { timeout: 120000 });
  const pdf = path.join(dir, path.basename(xlsx).replace(/\.xlsx$/, '.pdf'));
  const pages = Number((sh('pdfinfo', [pdf]).match(/Pages:\s+(\d+)/) || [0, 0])[1]);
  return { pdf, pages, text: sh('pdftotext', ['-layout', pdf, '-']) };
}

async function suite(browser, file, tag) {
  const R = {};
  for (const k of Object.keys(SC)) { R[k] = await exportXlsx(browser, file, k, tag); }
  const ok = (id, name, cond, detail) => rec(id, name, tag, cond, detail);

  for (const k of Object.keys(SC)) ok('X0-' + k, `Excel file is produced and opens (${k})`, !!R[k].file && R[k].errors.length === 0, R[k].toasts.join('|') + R[k].errors.join('|'));
  const I = {}; for (const k of Object.keys(SC)) if (R[k].file) { try { I[k] = inspect(R[k].file); } catch (e) { ok('X0b-' + k, 'openpyxl can read ' + k, false, e.message.slice(0, 150)); } }
  const s1 = I.S1; if (!s1) return R;
  const c = s1.cells, n = 4, last = 12 + n, tStart = last + 2;

  /* ---- A. layout from Phase 1b is kept ---- */
  ok('A1', 'Logo merged A1:C6; company block D1:F1 … D6:F6', ['A1:C6', 'D1:F1', 'D2:F2', 'D3:F3', 'D4:F4', 'D5:F5', 'D6:F6'].every(m => s1.merged.includes(m)), s1.merged.join(','));
  ok('A2', 'Quote details merged (A8:C8…A10:C10, D8:F8, D9:F10)', ['A8:C8', 'A9:C9', 'A10:C10', 'D8:F8', 'D9:F10'].every(m => s1.merged.includes(m)));
  ok('A3', 'Table header on row 12 with the 6 headings', ['A12', 'B12', 'C12', 'D12', 'E12', 'F12'].map(a => c[a] && c[a].v).join() === 'No,Photos,Description,PCS,Unit Price,Total Price');
  ok('A4', 'No autofilter; A4 portrait, fit 1 page wide; print area & repeating header row', s1.autofilter == null && s1.paper == 9 && s1.fit[0] == 1 && s1.fit[1] == 0 && s1.fit[2] && /^\$?A\$?1:\$?F\$?\d+$/.test(String(s1.print_area).replace(/'?Quotation'?!/, '')) && /12:\$?12|12:12/.test(String(s1.print_titles)), JSON.stringify([s1.autofilter, s1.paper, s1.fit, s1.print_area, s1.print_titles]));
  ok('A5', 'Totals only in columns E:F (A-D empty on those rows)', [0, 1, 2].every(i => c['E' + (tStart + i)] && c['F' + (tStart + i)] && ['A', 'B', 'C', 'D'].every(l => !c[l + (tStart + i)] || c[l + (tStart + i)].v == null)));
  const A = s1.anchors;
  ok('A6', 'Logo anchored inside A1:C6; each photo anchored in column B on its own row', A.length >= 4 && A[0][0] <= 2 && A[0][2] === 0 && A.slice(1).every(a => a[0] === 1) && [13, 14, 16].every(r => A.some(a => a[2] === r - 1)), JSON.stringify(A));
  ok('A7', 'Photos keep their shape (not squashed)', (() => { const sq = A.filter(a => a[0] === 1).map(a => a[4] / a[5]); return sq.length >= 3 && sq.every(r => r > 0.6 && r < 1.6); })());

  /* ---- B. bigger: fonts and widths fill the A4 page ---- */
  const wpx = ['A', 'B', 'C', 'D', 'E', 'F'].reduce((s, l) => s + Math.round((s1.colw[l] || 8.43) * 7 + 5), 0);
  const fitScale = Math.min(1, (8.27 - 0.5) * 96 / wpx);
  const body = c['C13'] && c['C13'].font[1], head = c['D1'] && c['D1'].font[1];
  ok('B1', 'Body text is 12 pt or more (was 10)', body >= 12, 'body=' + body);
  ok('B2', 'Company name 22 pt or more; table headings 13 pt or more', head >= 22 && c['A12'].font[1] >= 13, `name=${head} th=${c['A12'].font[1]}`);
  ok('B3', 'Printed text size (font × fit-to-page scale) is at least 10.5 pt', body * fitScale >= 10.5, `scale=${fitScale.toFixed(3)} eff=${(body * fitScale).toFixed(2)}pt`);
  ok('B4', 'Sheet is not wasting the page: scaled width is 88–100% of the printable A4 width', fitScale >= 0.88, 'scale=' + fitScale.toFixed(3));

  /* ---- C. colours match the on-screen document ---- */
  ok('C1', 'Table heading row is yellow FFE699', ['A', 'B', 'C', 'D', 'E', 'F'].every(l => c[l + '12'].fill === 'FFFFE699'));
  ok('C2', 'Total yellow FFFF00, Discount red FF0000, Grand Total green 8FE28F', c['E' + tStart].fill === 'FFFFFF00' && c['F' + tStart].fill === 'FFFFFF00' && c['E' + (tStart + 1)].fill === 'FFFF0000' && c['F' + (tStart + 1)].fill === 'FFFF0000' && c['E' + (tStart + 2)].fill === 'FF8FE28F' && c['F' + (tStart + 2)].fill === 'FF8FE28F', [c['E' + tStart].fill, c['F' + (tStart + 1)].fill, c['F' + (tStart + 2)].fill].join());
  ok('C3', 'No. and Unit Price cells use the soft amber tint FFF8E6', c['A13'].fill === 'FFFFF8E6' && c['E13'].fill === 'FFFFF8E6', [c['A13'].fill, c['E13'].fill].join());
  const bankRow = Object.keys(c).find(k => /^A\d+$/.test(k) && c[k].v === 'Account Name');
  ok('C4', 'Bank details are red and bold like the preview', !!bankRow && c[bankRow].font[2] === true && c[bankRow].font[3] === 'FFFF0000', bankRow && c[bankRow].font.join());
  ok('C5', 'Discount shows as a minus amount (like the preview)', /-/.test(c['F' + (tStart + 1)].fmt) && /LKR/.test(c['F' + (tStart + 1)].fmt), c['F' + (tStart + 1)].fmt);

  /* ---- D. real formulas ---- */
  const isF = a => typeof c[a].v === 'string' && c[a].v.startsWith('=');
  ok('D1', 'Every line total is a formula using qty × unit price', [13, 14, 15, 16].every(r => isF('F' + r) && c['F' + r].v.includes(`D${r}*E${r}`)), [13, 14, 15, 16].map(r => c['F' + r].v).join(' ; '));
  ok('D2', 'Total = SUM of the line totals', isF('F' + tStart) && /SUM\(F13:F16\)/.test(c['F' + tStart].v), c['F' + tStart].v);
  ok('D3', 'Discount and Grand Total are formulas pointing at the Total cell', isF('F' + (tStart + 1)) && c['F' + (tStart + 1)].v.includes('F' + tStart) && isF('F' + (tStart + 2)) && c['F' + (tStart + 2)].v.includes('F' + tStart) && c['F' + (tStart + 2)].v.includes('F' + (tStart + 1)), c['F' + (tStart + 1)].v + ' ; ' + c['F' + (tStart + 2)].v);
  const advCell = Object.keys(c).find(k => /^F\d+$/.test(k) && c['C' + k.slice(1)] && c['C' + k.slice(1)].v === 'Required Advance:');
  ok('D4', 'Required Advance is a formula based on the Grand Total', !!advCell && isF(advCell) && c[advCell].v.includes('F' + (tStart + 2)), advCell && c[advCell].v);
  ok('D5', 'Saved results match what the preview shows (so phone/Quick-Look viewers are right too)', (() => {
    const sh1 = R.S1.shown; const exp = sh1.lines.map(num);
    return [13, 14, 15, 16].every((r, i) => Math.abs(c['F' + r].cached - exp[i]) < 0.005) && Math.abs(c['F' + tStart].cached - num(sh1.totals[0])) < 0.005 && Math.abs(c['F' + (tStart + 1)].cached - Math.abs(num(sh1.totals[1]))) < 0.005 && Math.abs(c['F' + (tStart + 2)].cached - num(sh1.totals[2])) < 0.005 && advCell && Math.abs(c[advCell].cached - num(sh1.adv)) < 0.005;
  })(), JSON.stringify(R.S1.shown));

  /* ---- E. LibreOffice calculates the formulas itself (saved results removed first) and gets the same answer ---- */
  for (const k of ['S1', 'S3', 'S4', 'S5']) {
    if (!I[k]) continue;
    let rc; try { rc = loRecalc(R[k].file, tag + '_' + k); } catch (e) { ok('E-' + k, 'LibreOffice recalculation ' + k, false, e.message.slice(0, 160)); continue; }
    const nI = (SC[k].items || []).length, lst = 12 + nI, ts = lst + 2, cc = rc.cells, sh2 = R[k].shown;
    const lines = (sh2.lines || []).map(num);
    const okLines = lines.every((v, i) => cc['F' + (13 + i)] && Math.abs(cc['F' + (13 + i)].cached - v) < 0.005);
    const okTot = Math.abs(cc['F' + ts].cached - num(sh2.totals[0])) < 0.005 && Math.abs(cc['F' + (ts + 1)].cached - Math.abs(num(sh2.totals[1]))) < 0.005 && Math.abs(cc['F' + (ts + 2)].cached - num(sh2.totals[2])) < 0.005;
    const aC = Object.keys(cc).find(x => /^F\d+$/.test(x) && cc['C' + x.slice(1)] && cc['C' + x.slice(1)].v === 'Required Advance:');
    const okAdv = sh2.adv == null ? !aC : (aC && Math.abs(cc[aC].cached - num(sh2.adv)) < 0.005);
    ok('E-' + k, `Excel's own calculation equals the app's numbers (${k}: lines, total, discount, grand, advance)`, okLines && okTot && okAdv, JSON.stringify({ okLines, okTot, okAdv, lines, calc: [cc['F' + ts], cc['F' + (ts + 1)], cc['F' + (ts + 2)]].map(x => x && x.cached), shown: sh2.totals }));
  }
  if (I.S6) { ok('D6', 'Empty quotation (no items) still exports with zero totals', I.S6.cells['F14'] && I.S6.cells['F14'].cached === 0 || Object.values(I.S6.cells).some(x => x.cached === 0), JSON.stringify(I.S6.cells['F14'])); }
  if (I.S3) { ok('D7', 'Flat quote discount is written as a flat formula', Object.values(I.S3.cells).some(x => typeof x.v === 'string' && /ROUND\(MIN\(1500,/.test(x.v))); ok('D8', 'No bank / advance sections when switched off', !Object.values(I.S3.cells).some(x => x.v === 'Required Advance:' || x.v === 'Account Name')); }
  if (I.S1) { ok('D9', 'Line discounts (percent and flat) are inside the line formulas', /1-MIN\(10,100\)\/100/.test(c['F14'].v) && /MIN\(2500\.5,/.test(c['F15'].v), c['F14'].v + ' ; ' + c['F15'].v); }
  if (I.S5) { ok('D10', 'Over-100% and over-gross discounts are clamped exactly like the app', Object.values(I.S5.cells).filter(x => x.cached === 0).length >= 3, JSON.stringify(['F13', 'F14', 'F16', 'F17', 'F18'].map(a => I.S5.cells[a] && I.S5.cells[a].cached))); }

  /* ---- F. web pictures ---- */
  if (I.S2) {
    ok('F1', 'Web-address pictures (PNG, and WEBP converted) are embedded next to the logo; the blocked one is skipped without failing', I.S2.media.length === 3 && !!R.S2.file, `media=${I.S2.media.length} (logo + 2 web pictures expected)`);
    ok('F2', 'The user is told when a picture could not be added', R.S2.toasts.some(t => /couldn.t be added/i.test(t)), R.S2.toasts.join(' | '));
    ok('F3', 'A picture embedded from the web sits in column B on its own row', I.S2.anchors.filter(a => a[0] === 1).length === 2, JSON.stringify(I.S2.anchors));
  }
  if (I.S1) ok('F4', 'A WEBP picture stored inside the quotation (data:) is converted and embedded', I.S1.media.length === 4 && I.S1.media.some(m => /\.png$/.test(m)), I.S1.media.join());

  /* ---- G. document properties ---- */
  const p = s1.props;
  ok('G1', 'Properties: title, subject, creator, company, last-modified-by', p.title === 'Quotation QT-004' && /Agnus Hotel/.test(p.subject || '') && p.creator === 'KITCHEN HUB' && p.company === 'KITCHEN HUB' && p.lastModifiedBy === 'KITCHEN HUB', JSON.stringify(p));
  ok('G2', 'Properties: created and modified dates present', p.created && p.modified, JSON.stringify(p));
  ok('G3', 'Customer name with & and quote marks survives in the sheet', c['D8'] && /Agnus Hotel & "Spa"/.test(c['D8'].v), c['D8'] && c['D8'].v);

  /* ---- H. what it looks like when printed (LibreOffice) ---- */
  const pr = loPdf(R.S1.file);
  ok('H1', 'Printed with LibreOffice: A4, 1 page wide, text fully present', pr.pages >= 1 && pr.pages <= 2 && /Commercial gas cooker/.test(pr.text) && /Grand Total/.test(pr.text) && !/#{3,}/.test(pr.text), `pages=${pr.pages}`);
  if (I.S4) { const p4 = loPdf(R.S4.file); ok('H2', 'Very large amounts (123,456,789.50) are not cut off or shown as #####', /123,456,789\.50/.test(p4.text) && !/#{3,}/.test(p4.text) && /370,370,368\.50/.test(p4.text.replace(/\s/g, ' ')), (p4.text.match(/LKR[^\n]{0,40}/g) || []).slice(0, 8).join(' | ')); }
  /* ---- I. nothing important is stranded at a page boundary when printed ---- */
  const pageTexts = f => { const pdf = loPdf(f); const out = []; for (let i = 1; i <= pdf.pages; i++) out.push(sh('pdftotext', ['-f', String(i), '-l', String(i), '-layout', pdf.pdf, '-'])); return out; };
  for (const k of ['S1', 'S7', 'S8']) {
    if (!R[k].file) continue;
    const pg = pageTexts(R[k].file), find = re => pg.findIndex(t => re.test(t));
    const first = { S1: /Advance payments are non-refundable/, S7: /First term/, S8: /Alpha term/ }[k];
    const iT = find(/General Terms/), iF = find(first);
    ok('I1-' + k, `"General Terms" heading is on the same page as its first term (${k}, ${pg.length} pages)`, iT >= 0 && iT === iF, `heading page ${iT + 1}, first term page ${iF + 1}`);
    const a = find(/Total:/), b = find(/Discount:/), c2 = find(/Grand Total:/);
    ok('I2-' + k, `Total, Discount and Grand Total are on one page (${k})`, a >= 0 && a === b && b === c2, `${a + 1},${b + 1},${c2 + 1}`);
    const bk = find(/Account Name/), bn = find(/Branch/);
    ok('I3-' + k, `Bank details are not split across pages (${k})`, bk >= 0 && bk === bn, `${bk + 1},${bn + 1}`);
    const ad = find(/Required Advance/), ft = find(/Thank you for the opportunity/);
    ok('I4-' + k, `Required Advance and the closing line are on one page (${k})`, ad >= 0 && ad === ft, `${ad + 1},${ft + 1}`);
  }
  return R;
}

(async () => {
  const browser = await chromium.launch();
  const R = await suite(browser, FILE, 'new');
  if (OLD) await suite(browser, OLD, 'old');
  await browser.close();
  const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
  console.log(pad('ID', 7) + pad('NEW', 6) + (OLD ? pad('OLD', 6) : '') + 'Check');
  let pass = 0, fail = 0, oldFail = 0;
  rows.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })).forEach(r => {
    const nw = r.res.new, od = r.res.old;
    console.log(pad(r.id, 7) + pad(nw ? 'PASS' : 'FAIL', 6) + (OLD ? pad(od == null ? '-' : (od ? 'pass' : 'fail'), 6) : '') + r.name + (nw ? '' : '   <-- ' + (r.detail.new || '')));
    nw ? pass++ : fail++; if (OLD && od === false) oldFail++;
  });
  console.log(`\nNEW file: ${pass} passed, ${fail} failed` + (OLD ? `   |   OLD file fails ${oldFail} of these checks` : ''));
  process.exit(fail ? 1 : 0);
})();
