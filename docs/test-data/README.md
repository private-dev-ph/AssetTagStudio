# Synthetic test datasets

These files contain invented inventory values only. Generate the complete pack from the repository with `npm run samples`. The CSV/XLSX/XLS files and their byte sizes, SHA-256 checksums and expected import results are written to `docs/test-data/generated/files/manifest.json`. Generated large files are ignored by Git and excluded from the production website. No additional dependency or remote data is needed.

Run `npm run test:samples` to check every fixture against the actual importer, including each worksheet. These checks verify import outcomes; they do not benchmark PDF performance or replace browser/physical printing tests. The pack includes intentionally invalid files, so some rejection messages are expected.

## Start small, then increase load

| File | Data rows | What to try |
|---|---:|---|
| assets-100-unique.csv | 100 | QR and Code128; encode asset_id or serial. Search, sort, remove/select rows, A4/Letter and PDF. |
| assets-1000-unique.csv | 1,000 | Pagination, preview responsiveness, export progress/cancellation. |
| assets-5000-unique.csv | 5,000 | Larger import/export; compare with assets-5000.xlsx. |
| assets-20000-unique.csv | 20,000 | Maximum supported rows with unique labels: heavier rendering and PDF memory usage. |
| assets-20000-repeated-labels.csv | 20,000 | Identical label values: compare caching with unique labels. Duplicate-ID warnings are intentional. |
| assets-100-legacy.xls | 100 | Legacy XLS import. |

For baseline rendering, use 60 × 30 mm labels, A4, 10 mm margins, 3 mm gaps, a 20 mm QR, and only name + asset_id as visible text fields. This layout has **24 labels per page**: 100 records → 5 pages; 1,000 → 42; 5,000 → 209; 20,000 → 834. This is specific to these settings; changing dimensions changes the page count. For Code128, encode the shorter asset_id, hide name/serial/notes initially, and expand the label if the human-readable text does not fit.

Keep the template identical when comparing unique and repeated datasets. Change one setting at a time. On the repeated file, every text/code field is the same; do not use a payload containing a generated row number. Record your browser/version, device RAM, import time, export time, PDF bytes/pages, peak memory (if measurable), UI responsiveness and whether cancellation recovers. Start with 100 or 1,000 rows before exporting 20,000. The unique 20,000-label file is a stress fixture, not a claim that every device can finish it. Preview remains capped at 36 rendered labels and the table shows 50 rows per page.

## Successful imports with warnings or special content

| File | Expected result / test |
|---|---|
| unicode-and-leading-zeroes.csv | Five records; preserve leading zeroes and international/emoji text. QR accepts Unicode. Choose ASCII serial for Code128; non-ASCII asset_id should be rejected by Code128. Font glyph coverage depends on the device. |
| quoted-fields-and-line-breaks.csv | Three records; embedded commas, quotes and newlines stay in their cells. Long text may need a larger label or smaller font. |
| identifier-warnings.csv | Five records; choosing asset_id reports one missing and two duplicate identifiers. Choose serial to resolve all three without editing the file. |
| empty-column-warning.csv | Two records; import warns about unused. |
| special-headers-and-literal-html.csv | Two records; __proto__/constructor/toString remain ordinary headers. HTML text must display literally, with no script execution. |
| workbook-multiple-sheets.xlsx | Assets: 50 rows; International: 2. Empty and Duplicate headers are intentionally rejected; failed sheet switching must clear the old dataset. Stored formula values: 42 imports from a cached value, while the uncached formula stays empty. |

## Exact boundaries and expected rejection

| Accepted fixture | Rejected counterpart | Expected boundary |
|---|---|---|
| assets-20000-unique.csv | reject-20001-rows.csv | 20,000 data rows, excluding the header |
| boundary-100-columns.csv | reject-101-columns.csv | 100 columns; select only a few for labels (the editor allows six visible text fields; renderer validation allows at most 32) |
| boundary-10MiB.csv | reject-10MiB-plus-one-byte.csv | Exactly 10,485,760 bytes versus 10,485,761; accepted file has 10,000 rows and long-note warnings |
| boundary-10000-character-cell.csv | reject-10001-character-cell.csv | 10,000 versus 10,001 characters in a cell |

Hide notes for the accepted long-cell/10 MiB files and encode asset_id. Import limits are separate from rendering limits: a valid 10,000-character cell cannot be encoded as a code, whose maximum payload is 2,000 characters, and cannot fit as text on a small label.

Other reject-* CSV files exercise duplicate/empty headers, extra populated cells, an unclosed quote, headers without data and an empty file. reject-fake-workbook.xlsx should produce a workbook-signature error. These are small benign malformed fixtures, not ZIP bombs or exploit binaries.

## Rendering failures after a successful import

| File | Test |
|---|---|
| qr-dense-payload.csv | Encode payload at 20 mm QR size: expect a density error. Shorten the payload or increase label/code size; encoding asset_id succeeds. The synthetic URL uses the reserved .invalid domain. |
| reject-code-payload-after-import.csv | Import succeeds. Encode payload: 2,001 characters exceeds the code limit. Encode asset_id to recover. |
| code128-overwide-value.csv | Import succeeds. Choose Code128 and encode payload: its 1,800 ASCII characters are deliberately too wide. Encode asset_id to recover. |

Also try impossible margins/gaps, code dimensions larger than the usable label, crowded text fields, cancellation during a large export, and reloading after import. Reload should clear imported records while preserving permitted preferences. For printing, use 100% / actual size and measure a printed label with a ruler; scan several QR/barcodes, including first/last PDF pages. These hardware checks have not been performed by this pack's automated verification.

## Remaining product roadmap

The original plan defers Data Matrix; EAN/UPC; logo placement; image fields; saved local template libraries; JSON template import/export; bulk formatting rules; sequential asset-ID generation; printer profiles; PWA/offline installation; direct browser printing; and FieldLens-compatible QR presets. See `docs/roadmap.md` in the repository for distinctions from existing MVP behavior.
