# Architecture and contracts

The repository started with only .gitattributes; there are no existing APIs, user data or migrations. The MVP follows the supplied plan; later features remain out of scope.

- React + TypeScript + Vite, static files only. No accounts, backend, telemetry, uploads, remote fonts or runtime CDN requests.
- CSV and Excel share Dataset/AssetRecord in src/types.ts. Null-prototype value maps prevent special header names changing object prototypes. React escapes spreadsheet text.
- Canonical dimensions are millimeters. A pure page layout function serves preview and PDF.
- Structured templates, no free-position editor. Rendering owns payload interpolation, code generation and a shared raster label renderer. Preview and PDF use the same rendered label to avoid different wrapping/layout.
- PDF-lib embeds rendered label images at physical dimensions. Text uses browser canvas for Unicode support. PDF remains authoritative; print at 100%/actual size.
- Import parsing runs in a module worker, with 10 MiB input, 20,000 rows, 100 columns and bounded cell values. Excel sheet selection occurs before normalization. Worker termination makes interrupted imports recoverable.
- PDF generation yields between batches, reports progress, supports cancellation and caches repeated labels/codes with bounded memory.
- Only preferences persist in localStorage; dataset values never persist. Malformed preferences must fall back to safe defaults.
- SheetJS 0.20.3 uses the official distribution rather than the obsolete vulnerable npm release; pin integrity in the lockfile. Remaining hostile workbook resource risk must be documented.

## Module ownership and exported contracts

- src/features/import/: parseCsv(text): Dataset; listSheets(buffer): string[]; parseWorkbook(buffer, sheetName): Dataset. normalizeRows(rows: unknown[][]): Dataset. validateIdentifiers(dataset, field): string[]. Worker messaging is owned by import work.
- src/features/layout/pageLayout.ts: calculateLayout(template, page, count): PageLayout (throws readable errors for invalid dimensions/zero-fit). mmToInches, inchesToMm.
- src/features/labels/renderer.ts: renderLabel(record, template): Promise<string> (PNG data URL); validateTemplate(template): void; interpolatePayload(record, template): string. Rendering uses browser DOM/canvas only; pure helpers are testable in Node.
- src/features/export/pdf.ts: generatePdf(records, template, page, options?): Promise<Uint8Array>; options { onProgress?: (completed:number,total:number)=>void; signal?: AbortSignal }. Revalidate before allocating. UI owns object URL download and revocation.
- src/App.tsx and src/styles.css: workspace orchestration/editor/table/preference validation and UI. No second parser or renderer.

## Acceptance boundaries

CSV/XLSX/XLS imports, sheet selection, header/identifier diagnostics, bounded table with search/sort/select/remove; QR raw/template payload and Code128; field selection/reordering/font/bold/prefix/alignment/border/padding; page and label presets/custom sizing/units/margins/gaps; paginated preview; multi-page PDF/progress/cancel; demo/template/theme; accessibility; CI/static deployment config; unit + browser failure tests; documentation/portfolio artifacts. Live publishing requires available provider permissions and is not to be represented as complete without a verified URL.
