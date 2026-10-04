# Print identity packages

## Shared print snapshot

`createPrintJob` clones and freezes the selected rows, template, page settings, resolved code payloads, and row-major physical label placements. PDF generation consumes the resulting placements directly. A manifest is generated from the same completed snapshot, so its page, row, column, and millimeter origin match the PDF job even when the workspace data changes later. A failed or canceled PDF does not produce a manifest package.

The current PDF generator supports up to 20,000 records. Each record produces one physical label; mirrored cable text appears in both reading directions on that label and does not double the manifest count.

## Label variants

The shared template supports QR, Code 128, and text-only labels. Cable presets map source, port, and destination into a configurable narrow label and can render mirrored text for a wrap; their preview shows at most 36 selected rows through the shared renderer. Location presets map up to seven hierarchy columns into a readable high-contrast label and use `location://site/...` payloads through the common URI resolver. Optional code generation keeps the common renderer, layout, and PDF export path.

## Printer calibration

Sheet calibration offsets are millimeters and default to zero. Layout calculation applies the offsets to every sheet origin and rejects any offset that would clip a label beyond the physical page. Printer profile JSON is versioned and strict; it contains only a name and X/Y settings. Profiles use the shared IndexedDB `printers` store, while the active profile ID uses local storage. Oversized profile files are rejected before reading, and the UI offers explicit clear-and-recover after any initial printer-library load failure, including overflow. No imported rows are included.

The calibration PDF is vector artwork with corner crosses, a center crosshair, a 1 mm ruler with 10 mm labels, a reference box, and print-at-actual-size instructions. It requires paper at least 100 × 80 mm so these marks stay legible and clear of the rulers.

## FieldLens exchange

FieldLens package generation uses the same selected immutable print snapshot for both outputs. `asset_id` in the CSV must exactly match the identifier in each `fieldlens://asset/ID` QR payload. The local FieldLens mobile URI resolver accepts one case-sensitive, unescaped ID and rejects percent encoding, slash, backslash, whitespace, query, and fragment characters. Spreadsheet-formula-leading IDs are rejected rather than modified, preserving QR/CSV identity. Other CSV text uses formula-safe CSV quoting.

The package provides `fieldlens-labels.pdf` and `fieldlens-assets.csv` as an exchange contract. The inspected FieldLens receiver has no verified CSV importer, so this feature does not claim direct ingestion.
