# Local expansion walkthrough

Run `npm ci --ignore-scripts` and `npm run dev` on `feature-expansion`; open the printed localhost URL. The deployed site still serves main.

1. Import a CSV/Excel file in Asset Labels. Selection is shared by every tool; an empty selection prints nothing. Use the existing [stress-fixture generator](../test-data/README.md) for 100–20,000 rows.
2. In Data Health, map identifier/name/serial columns, review findings, preview a safe fix, then Apply. Header fixes update printed-field and payload references together. Undo restores the whole preceding dataset/settings/selection snapshot.
3. In Asset ID Generator, choose the target column, selected or blank-only rows, pattern and padding. Preview collisions before Apply. Overwriting existing identifiers requires explicit confirmation. Serial Tools likewise previews normalization, extraction, validation or duplicate removal before Apply.
4. In Templates, choose a preset or import a `.assettag.json` document. Map every missing column before Apply. Save/rename/duplicate/export/delete settings locally. Importing another dataset clears inventory and undo, but saved settings remain.
5. In Payload Builder, choose raw text, HTTP URL, FieldLens or structured text. Insert columns, inspect the resolved value and density, validate selected rows, then Apply. Payloads never open links.
6. For cables, import [cable-labels.csv](../../public/examples/cable-labels.csv), open Cable Labels and map source/target/port. Choose mirrored or standard text and optional QR/Code128, check previews, Apply, then Create PDF. Increase dimensions if the renderer reports that text/codes cannot fit.
7. For locations, import [location-labels.csv](../../public/examples/location-labels.csv), map any hierarchy fields you need, and inspect the batch preview. Parent fields are optional. Select text-only or QR, Apply, then Create PDF. QR / Barcode is a separate general-purpose label page.
8. Printer Calibration downloads a measurable sheet. Print at 100% / Actual Size and enter signed corrections: positive X moves right, positive Y moves down. Save a named profile; changing offsets does not silently replace its saved values. Update the active profile explicitly. Calibration reference sheets require paper at least 100 × 80 mm; label export supports smaller sheets separately.
9. Code Inspector accepts PNG/JPEG, current label, pasted content or an explicitly started camera frame. It reports QR/Code128 content, URI validity and duplicates without navigation. Stop camera or leave the page to release it.
10. After a successful PDF, Print Manifest exports JSON/CSV for that frozen job even after later row edits. JSON preserves exact strings; CSV neutralizes spreadsheet formula prefixes. A new file/sheet clears the old snapshot.
11. FieldLens Export maps asset_id/name/asset_type/serial/location and creates matching PDF/CSV IDs. Identifiers follow the current mobile URI receiver rules; formula-leading IDs are rejected. Receiver-side CSV ingestion has not been verified.

Limits: ID preview5,000 selected rows; serial preview2,000; visible transformation preview200; rendered batch preview36; imports20,000 rows/100columns/10MiB; code payload2,000 characters; undo8entries/24MiB; each local library100items. Image inspection10MiB/8MP with a five-second decode worker deadline. Worker timeouts and export cancellation surface recoverable errors. Physical printer/scanner/camera validation remains a hardware follow-up.

Corrupt settings libraries offer an explicit reset for that library only. Storage failures report an error; inventory is never automatically written into these libraries. Browser settings documents can contain literal user-authored text/payloads, so treat exported templates as your own local files.
