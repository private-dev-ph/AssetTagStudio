# Template library milestone

## Shipped in this branch

- Version 1 `.assettag.json` documents store only a name, label settings, and optional page settings. The parser rejects unknown properties, row-bearing documents, unsupported versions, malformed values, and files larger than 128 KiB. Optional settings stay optional when importing older documents.
- The Templates page offers six built-in layouts, imports and exports JSON files, maps every dataset field reference before applying a template, and saves settings in a browser-only library. Saved entries can be updated, duplicated, and deleted explicitly.
- `src/features/storage/library.ts` exposes the `templates` and `printers` IndexedDB stores through the shared bounded adapter API. Each store holds at most 100 entries, and documents are capped at 128 KiB. The adapter stores no dataset values.

## Validation

`src/features/templates/documents.test.ts` covers version 1 round trips, compatibility with optional print contracts, preservation of omitted optionals, immutable field mapping, unmapped references, unknown properties, row data, malformed JSON, future versions, and size limits. Browser IndexedDB lifecycle, quota, and blocked-upgrade behavior require browser integration coverage in the integrating branch.

## Limits

- Import is available from Templates after a dataset has been loaded because field mappings are dataset-specific.
- Built-in layouts expose common source column names; users explicitly map names that differ in their dataset.
- Corrupt library document JSON is shown as an invalid item and can be deleted. Structurally damaged IndexedDB records fail library loading with an error.
- The `printers` store is provisioned by the shared adapter for the print profile owner; this page does not read or write printer profiles.
