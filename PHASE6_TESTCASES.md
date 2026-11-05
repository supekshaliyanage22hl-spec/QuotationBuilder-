# Phase 6 (V13h): Terms & Conditions redesign, Special note, usability

Run: `node tests/phase6.test.js quotation-builder_V13h.html` (Playwright; python3 + openpyxl; LibreOffice optional)

## 1. Terms & Conditions (rebuilt to match your real quotation)
- **Headed clauses and bullets.** In the quotation editor, "Terms & conditions" is now one big box, one term per line.
  - `Final Confirmation :: By approving the quotation...` becomes a **bold heading** with the text under it.
  - A line without `::` becomes a **bullet point**.
  - `{advance}` is replaced by that quotation's advance % (e.g. 65%).
- **Own page.** The whole section starts on a new page, with a centred title **TERMS & CONDITIONS**. The Bank details, Required Advance and thank-you line follow on that page. A switch "Start Terms & conditions on a new page" turns this off per quotation.
- Works in the **preview, Print, PDF and Excel**. Very long terms continue on the next page ("Terms & Conditions (continued)").
- **Your real terms are the new default** for new quotations (taken from your PDF: 6 headed clauses + 7 bullets). Quotations you already have keep their old terms (they show as bullets). To use your terms in an existing quotation or in Company settings: open `my_terms_for_company_settings.txt` and paste it into the Terms box.
- **Special note:** new box in the editor ("Special note"). It appears in a highlighted box right under the totals (preview, PDF, Print, Excel). Empty = hidden. Company settings has a "Default special note" for new quotations.

## 2. Usability and accessibility
- Quotation cards can be opened with the keyboard (Tab, Enter); the duplicate/delete buttons are **always visible on touch screens** and when a card is focused.
- Photo button no longer forces the camera: you can choose from the gallery.
- Every field label is linked to its field; icon buttons have names; focus outlines are visible; faint grey text now meets the 4.5:1 contrast guideline; bigger touch targets on phones.
- Dialogs (Company, Delete) behave properly: focus moves in, Tab stays inside, **Esc closes**, focus returns afterwards.
- Company settings has **Cancel** (and discards a newly chosen logo).
- Removing an item or a photo shows **Undo** for 7 seconds.
- On phones the sync text is hidden (dot only), so the top bar is less crowded.
- Bug caught by testing: a dialog could steal focus from a field you had just clicked (text went in the wrong box). Fixed.

## 3. Automated results
| Group | Checks | Result |
|---|---|---|
| New Phase 6 suite (terms, special note, Print, Excel, usability) | 24 | all pass |
| Phase 1 / Excel layout / Phase 2 / Phase 3 (PDF) / Phase 5 | 23 / 12 / 27 / 33 / 15 | all pass |

Total 134 checks. Older tests were adapted where behaviour changed on purpose (terms markup, "Terms & Conditions" heading, the new terms page).
Visual proof: `visual/excel_V13h_terms_page.png` (2 pages: offer + special note, then terms + bank).

## 4. Please check by hand
1. Company settings: paste `my_terms_for_company_settings.txt` into "Default terms", Save. Click **New**: the terms appear as bold headings + bullets.
2. Fill the Special note. See it under the totals in the preview, then **Download PDF**: page 1 = items/totals/special note, page 2 = Terms & Conditions + bank details.
3. **Excel** and **Print**: same two-page structure. In Excel please look at page 2: if any clause text looks cut off, tell me which (row heights are estimates; LibreOffice looked fine).
4. Try Esc, Tab and the new Undo (remove an item, press Undo).
5. On your phone: duplicate/delete buttons visible on the quotation list; photo button lets you pick from the gallery.

## 5. Notes and limits
- A terms line is one paragraph (no line breaks inside a term). A heading is anything before the first `::`.
- Not done on purpose: keystroke performance with very many photos (changing it risked the other tests; tell me if it is slow for you).
- I did not test in real Excel or on a real phone, only in Chromium/LibreOffice emulation.
- Seen in your real quotation but not supported yet: **section header rows** (e.g. "Bra Area"), **"Already Have"** instead of a price, **grouped items with one combined price** (the "}" brackets), two photos per item. Say the word if you want those next.
