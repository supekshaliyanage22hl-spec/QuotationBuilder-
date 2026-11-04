# Phase 5 test cases: document model (V13g, built from V13f)

Run: `node tests/phase5.test.js quotation-builder_V13g.html` (needs Playwright, python3 + openpyxl)

## What changed
1. **Each quotation keeps its own company details, bank details and currency.** Changing Company settings no longer rewrites old quotations. New quotations copy the current settings; quotations saved by older versions get a copy of the current settings the first time V13g opens them. (The **logo** is not copied, so it always follows Company settings; copying it into every quotation would use up the browser's storage.)
2. **Bank details in the quotation editor now belong to that quotation only** (before, editing them changed everyone's). A **"Use current Company settings"** button pulls the latest company details into that quotation on purpose.
3. **Line discounts are visible.** Items with a discount show a red "Discount: 10%" or "Discount: LKR 500.00" note under the description, in the preview, the PDF and the Excel file (Excel has fixed columns, so the note is added to the description cell). Unit price x quantity no longer looks wrong.
4. **Duplicating a quotation resets its date to today and valid-until to today + validity days.**
5. **Terms can contain `{advance}`**, replaced by that quotation's advance % (the default term now says "An advance payment of {advance}% …"). Existing terms with a typed "65%" are not touched.
6. **Company settings has the missing options:** valid-for days, "Show Required Advance on new quotations", default terms (one per line), and default bank details. The unused "Tagline" field was removed.
7. **A transparent PNG/WebP/GIF/SVG logo stays transparent** (it used to be flattened onto white as a JPEG).
8. Backups from older versions get a company copy on import, and imported company data is cleaned.

## A. Automated results (15 checks, all pass)
| ID | Check |
|---|---|
| Q1-Q3 | Old quotation unchanged after Company settings change; new one uses the new details; sidebar shows each in its own currency |
| Q4 | Quotation from an older version gets a company copy |
| Q5-Q6 | Editing bank details changes only that quotation; refresh button works |
| Q7-Q8 | Discount note in preview and in the Excel description cells, only on discounted items |
| Q9-Q11 | Duplicate dates reset (clock set to 14 Oct 2026 01:00, UTC+5:30); `{advance}` token works and updates with the advance % |
| Q12 | New quotations follow valid days, default terms, advance default |
| Q13 | Transparent logo stays PNG and transparent |
| Q14 | Imported old backup gets a copy; hostile company data cleaned (no script, lengths capped) |
| Q15 | No JavaScript errors |

Earlier suites on V13g: Phase 1 = 23/23, Excel layout = 12/12, Phase 2 = 27/27, Phase 3 = 31/31 (this includes a check that the preview HTML for normal quotations is identical to V13f).

## B. Please check by hand (2 minutes)
1. Open an existing quotation, then **Company** and change the company name and a bank detail. Save. The old quotation must still show the old details; click **New** and the new one shows the new details.
2. In a quotation with the bank block showing, edit "Account name": only that quotation changes. Press **Use current Company settings** and it returns to the Company value.
3. Give one item a 10% discount: the red note appears in the preview, in the PDF and in the Excel file.
4. Duplicate a quotation (hover its card, click the copy icon): date is today.
5. Company: upload a logo with a transparent background (PNG) and check it has no white box.

## C. Honest notes
- Quotations that already existed take a copy of the company details **as they are when V13g first opens them**. If you changed Company settings earlier, old quotations will already show the changed values.
- The logo is shared by all quotations (see above).
- The default bank account and company name in the file's source are still your real details (fine for you; do not share the file publicly).
- Excel spacing question from the last message was not changed: 2-4 item quotations still print on 2 pages in Excel. Say the word if you want it tighter.
