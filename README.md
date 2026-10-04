# AssetTag Studio

<img src="public/branding/assettag-logo-horizontal.svg" alt="AssetTag Studio — QR-inspired A/tag logo" width="440" />

[Brand assets and regeneration guide](docs/branding.md)

Turn spreadsheet inventory into print-ready QR and Code 128 labels, entirely in your browser.

[Live demo](https://tagstudio.zachcodes.dev) · [Cloudflare Pages mirror](https://tagstudio.pages.dev)

![Workspace](docs/media/workspace.png)

**No login, no backend, no inventory uploads.** Import CSV or Excel, choose an identifier, configure a label and export a PDF sheet at actual physical size.

## Why it exists

Equipment lists already live in spreadsheets. Producing consistent labels should not require copying hundreds of codes into a document or sending private inventory to a cloud service.

## Features

- CSV, XLSX and legacy XLS; workbook sheet selection and import diagnostics
- Search, sort, select and remove rows; generic column names
- QR raw values or payload templates and Code 128 barcodes
- Structured fields with visibility, ordering, prefixes, fonts, bold and alignment
- Label presets/custom dimensions, padding and borders
- A4, US Letter, A5 and custom paper; mm/inches, margins and gaps
- Paginated print preview, multi-page PDF, progress and cancellation
- Sample data, downloadable CSV template, light/dark theme and keyboard-friendly controls

## Local feature expansion

The `feature-expansion` branch adds the twelve tools below. Verification runs locally; the live links above continue to serve `main`. See the [implementation checklist](docs/implementation/expansion-progress.md) and [resume handoff](docs/implementation/expansion-handoff.md) for current evidence and outstanding checks.

| Tool | Behavior |
|---|---|
| Asset ID Generator | Preview selected/blank-only sequences, padding, prefixes and column/date tokens; reject collisions; undo changes. |
| Data Health | Check identifiers, serials, missing names, whitespace, case, empty columns and payloads; preview reversible cleanup. |
| Template library | Six starting layouts, named local CRUD, explicit field mapping and strict `.assettag.json` import/export. |
| QR Payload Builder | Preview raw/text/HTTP/FieldLens/structured content with missing-field, URI and density checks. |
| Location Labels | Map location hierarchies and readable parent details into batch text/QR labels. |
| Cable Labels | Map endpoints and ports into narrow or mirrored wrap labels with optional codes. |
| Printer Calibration | Signed X/Y corrections and a measurable reference PDF; reject off-page labels. |
| Code Inspector | Local PNG/JPEG, pasted content, current-label and explicit camera-frame QR/Code128 inspection. |
| Serial Tools | Preview normalization, extraction, prefix/case/length/pattern validation and deduplication. |
| Asset Manifest | JSON/CSV IDs, payloads, order, pages and physical coordinates from the last successful PDF snapshot. |
| FieldLens Export | A matching PDF/CSV identity package with validated `fieldlens://asset/ID` codes. CSV is an exchange contract; a receiver importer is not verified. |
| Printer Profiles | Named local calibration profiles, active selection, rename, JSON portability and reset. |

Create, Data, Design and Tools navigation shares one in-memory dataset. Settings libraries use IndexedDB; imported rows and undo history remain in memory. Changes require explicit Apply. Separate Apply and Export actions preserve the chosen print settings.

## Demo workflow

Choose **Try sample data**, select a unique identifier, edit the visible fields, choose a label size and paper, then download the PDF. Print at **100% / actual size**, with fit-to-page disabled. The downloadable CSV template is available at the top of the workspace.

![Demo workflow](docs/media/demo.gif)

[Example PDF](docs/media/sample-labels.pdf). Deployment settings and verification are in [deployment.md](docs/deployment.md).

The screenshots, 9.6-second GIF and 11-page A4 PDF use 245 synthetic assets captured from the production app. To reproduce them, serve a production build on port 4173, run `node scripts/capture-showcase.mjs`, then `python scripts/assemble-demo.py` with Pillow installed. Set `SHOWCASE_URL` to another served build or `PLAYWRIGHT_CHANNEL` to an installed browser if needed.

## Privacy

Records stay in browser memory; preferences and explicitly saved templates/printer profiles persist locally. No analytics, remote processing or spreadsheet-content requests. Reload clears records. Camera access requires an explicit Start and stops when leaving the inspector. See [privacy](docs/privacy.md).

## Architecture

CSV and Excel normalize to one record model. A millimeter layout engine and shared label renderer keep the sheet preview aligned with the exported PDF. [Architecture and decisions](docs/architecture.md).

## Project purpose and role

The goal is a focused, account-free inventory-to-label workflow with no spreadsheet upload service. Project ownership spans product scoping, browser-local architecture, spreadsheet normalization, the label editor, physical layout/rendering, PDF generation, testing, documentation and deployment.

## Technical highlights

- Module-worker imports with deadlines, cancellation and ZIP/CFB preflight bounds before opening Excel files.
- String-valued records preserve leading zeroes; arbitrary headers remain ordinary fields, including prototype-like names.
- Canonical millimeter layout and a shared canvas renderer keep preview and PDF positions consistent.
- QR density/quiet-zone checks and Code128 character/width validation prevent misleading output.
- Paginated tables, capped previews, bounded caches and eager PDF image embedding limit retained work.
- Preference-only persistence, same-origin runtime assets and constrained static response headers preserve the privacy boundary.

## Challenges and solutions

| Challenge | Approach |
|---|---|
| CSV/Excel differences and malformed input | One normalized model, explicit diagnostics, worker lifecycle guards and file/archive quotas. |
| Screen appearance versus physical print output | Shared rendering, millimeter positioning, QR decode tests and PDF page-size checks; hardware calibration still needs a real printer/scanner. |
| Large export memory and responsiveness | Release decoded PDF pixels, bound caches, yield between batches and support cancellation. Unique-label export costs remain unbenchmarked. |
| Hosting-injected analytics | Disable Cloudflare RUM for this hostname and verify hosted network/privacy behavior. |

## Results and lessons

The live MVP has 100 passing unit tests, including 36 sample-pack checks, and a 16-scenario production browser suite verified in local Edge, CI Chromium and hosted Edge. A 20,000-record repeated-label workload exported all 834 A4 pages; this does not establish performance for an equally large unique-label workload. The showcase includes an 11-page sample PDF for 245 synthetic assets, a 9.6-second demo and actual production screenshots.

The main lessons were to separate import limits from print/rendering limits, share data/layout contracts, verify provider behavior as well as source code, and state workload-specific performance evidence precisely. Printer/scanner hardware and Firefox/Safari remain unverified.

## Portfolio integration

The root [portfolio-showcase.json](portfolio-showcase.json) follows the [portfolio contract](https://github.com/private-dev-ph/portfolio/blob/main/docs/portfolio-showcases.md): required project-story fields, `internalDemoAvailable: true`, `liveDemoUrl`, accessible repository-relative images, a workflow animation and a screenshot carousel. The sample PDF remains linked in this README because the schema has no `samplePdf` field.

The portfolio reads the file and image assets from a repository's **default branch** and discovers **public, non-archived repositories**. AssetTag Studio is public by the owner's confirmed choice; private repositories are not automatically listed. Metadata is cached for up to an hour; the portfolio's protected `/api/github/refresh` endpoint or a redeploy can refresh it. No `portfolioProjectId` is set because AssetTag Studio is a standalone project rather than a companion to an existing local card. See [integration verification](docs/portfolio-integration.md).

## Running locally

Requires Node 24 and npm.

```sh
npm ci
npm run dev
```

## Testing

```sh
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm audit
```

CI is configured for pull requests and pushes to main or web-deployment. Read [implementation progress](docs/implementation/progress.md) for verification status.

For manual testing, `npm run samples` generates a synthetic CSV/Excel pack with 100–20,000 rows, exact import boundaries and intentional validation failures. See the [test-data guide](docs/test-data/README.md); `npm run test:samples` verifies its documented import results.

## Deployment

Vite builds static dist files for Cloudflare Pages. No runtime environment secrets required. [Setup, headers and acceptance checks](docs/deployment.md).

## Limitations

Imported files and rendered codes have documented resource limits. Compressed Excel content can still consume browser memory. Code 128 supports its permitted character range; use QR for international identifiers. Dense codes, crowded fields or impossible page grids require changing settings. Print accuracy also depends on printer hardware and actual-size settings. PDF labels are raster images placed at exact dimensions; they are not searchable text. Large exports consume memory and time.

## Future work

Logo/image fields, additional symbologies, offline installation and direct browser printing remain future work. Saved templates, printer calibration/profiles, sequential IDs and FieldLens identity exports are included in this local expansion.

The [post-MVP roadmap](docs/roadmap.md) distinguishes this expansion from the remaining deferred work.

## License

Licensed under [Apache-2.0](LICENSE). Project attribution is in [NOTICE](NOTICE). Third-party components keep their own licenses, listed in [public/third-party-notices.txt](public/third-party-notices.txt). The production build includes LICENSE.txt and NOTICE.txt alongside those notices.
