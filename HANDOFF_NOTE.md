# Handoff note: Quotation Builder (continue from Phase 5, V13g)

**Give the new Claude these files:** `quotation-builder_V13g.html` (required) + this note.
Optional: the `tests/` folder and `PHASE1/2/3_TESTCASES.md` (only useful if that Claude can run Node/Playwright).

## First message to paste into the new chat
> I'm continuing a project from another chat. Attached are my single-file HTML app (quotation-builder_V13g.html) and a handoff note. Read the note first, then start **Phase 6 (usability and accessibility)** following the "How we work" rules in it. Ask me before changing anything outside the phase.

## The app
- One HTML file, no build step. Quotation builder for a Sri Lankan kitchen-equipment company (currency LKR, A4 documents).
- Features: quotation list (sidebar), editor, live document preview, **Excel export** (own offline XLSX writer in the first `<script>`, global `OfflineExcelJS`), **PDF export**, Print, backup export/import.
- Data is saved in the browser (`localStorage`: `qb_quotes_v2`, `qb_settings_v2`, plus `qb_synced_v1`, `qb_tombstones_v1`). The user does **not** use the online/cloud mode (pill shows "Local only"); cloud code exists but is dormant. Do not spend effort on it.
- Only internet dependencies: html2canvas (CDN) for PDF, Google Fonts (Inter).
- Key functions (second `<script>`): `calcTotals`, `itemLineTotal`, `buildDocParts` + `renderPreview`, `exportExcel`, `excelAddImage`, `paginateForPdf`, `pdfRasterize`, `buildPdfFromJpegs`, `sanitizeQuote`, `normalizeSettings`, `touchAndSave`, `importBackup`.

## How we work (important)
1. Work in **phases**. Each phase ends with a **new file** (V13e, V13f…, never overwrite the previous one) + a test-case document (`PHASEn_TESTCASES.md`) + automated tests when possible.
2. Show before/after evidence (tests that fail on the old file and pass on the new one; for Excel, a LibreOffice render turned into an image and looked at).
3. **Wait for the user's "green light" before the next phase.** The user is informal, prefers short, plain-language explanations, and will test on their own computer/phone.
4. Be honest about what could not be tested (the sandbox had no internet).
5. Each phase must keep all earlier tests passing.

## What is done
| Version | Phase | Summary |
|---|---|---|
| V13a | 1 | Excel crash from placeholder logo fixed; local-time dates (UTC bug); discounts/qty/advance clamped; money rounded to cents; HTML escaping/image-source checks; small fixes |
| V13b | 1b | Excel layout: logo large and left (A1:C6), company block right (D:F), photos keep aspect ratio, totals in columns E:F only, no autofilter, rows tall enough, print area/titles written |
| V13c | 2 | Data safety (local merge, per-quote saves, flush on tab close), quote numbers never reused (⚠ on duplicates), backup **import**, input sanitising. Cloud parts dormant for this user |
| V13d | 3 | PDF rebuilt: real A4 pages built off-screen, rows never split, header repeats, page numbers, own PDF writer (jsPDF removed), fallback to Print when html2canvas can't load. Long text limits raised (description 50,000 chars) |

| V13e | 4 | (made by a different Claude) Excel: bigger text (12 pt, fills A4 width), colours match the screen, **real formulas** for line/total/discount/grand/advance, web-address pictures embedded, document properties, print page breaks that keep blocks together |
| V13f | 4b | My review fixes on V13e: document properties were never linked in the file (now work); table heading only repeats on page 2 when items continue there; page-break estimate no longer strands "General Terms" at 4 items |

| V13g | 5 | Per-quotation company/bank/currency snapshot (+ refresh button), line-discount note on preview/PDF/Excel, duplicate resets dates, `{advance}` term token, Company settings gained valid days / default terms / default advance / default bank, transparent logo stays PNG |

Test status on V13g: Phase 1 = 23/23, Excel layout = 12/12, Phase 2 = 27/27, Phase 3 = 31/31, Phase 5 = 15/15. (Earlier status on V13f: Phase 1 = 23/23, Excel layout (1b) = 12/12, Phase 2 = 27/27, Phase 3 = 31/31 (stand-in for html2canvas). Excel formulas independently verified by letting LibreOffice recalculate: 0 mismatches. The other Claude's own test file `phase4_excel.test.js` is NOT usable (its helper `phase4_inspect.py` was not in the upload).
**Open question for the user:** with bigger Excel text, 2-4 item quotes print on 2 pages (page 2 nearly empty). Still undecided; ask if they want slightly tighter spacing so they fit on 1 page (see `PHASE4_REVIEW.md`).
**Pending from the user:** Phase 3 manual checks (section B of `PHASE3_TESTCASES.md`) with the real html2canvas. If they report PDF problems, fix those first.

## What is left

### Phase 6: usability and accessibility (NEXT, last planned phase)
- Quote actions (duplicate/delete) only appear on hover, so no touch/keyboard access; photo input forces the camera (`capture`), blocking gallery.
- Labels linked to inputs, aria-labels on icon buttons, focus styles, modal focus trap + Esc, contrast, bigger touch targets.
- Company modal has no Cancel and the logo change isn't reverted on close; add undo/confirm for removing items/terms.
- Crowded top bar on phones; performance (whole preview rebuilt on every keystroke; `localStorage` size with many photos).

## Testing setup used (optional)
Node + Playwright (headless Chromium, network blocked), LibreOffice to render Excel, `pdfinfo/qpdf/pdftoppm/tesseract` + Pillow to check PDFs. Excel formulas can be verified independently by stripping the stored `<v>` results from formula cells and letting LibreOffice recalculate (convert to csv). Pattern: seed `localStorage` with `addInitScript` **before** the page loads (the app saves its own state when a page is left, so seeding a live page and reloading gets overwritten).
