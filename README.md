# AssetTag Studio

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

## Demo workflow

Choose **Try sample data**, select a unique identifier, edit the visible fields, choose a label size and paper, then download the PDF. Print at **100% / actual size**, with fit-to-page disabled. The downloadable CSV template is available at the top of the workspace.

![Demo workflow](docs/media/demo.gif)

[Example PDF](docs/media/sample-labels.pdf). Deployment settings and verification are in [deployment.md](docs/deployment.md).

The screenshots, 9.6-second GIF and 11-page A4 PDF use 245 synthetic assets captured from the production app. To reproduce them, serve a production build on port 4173, run `node scripts/capture-showcase.mjs`, then `python scripts/assemble-demo.py` with Pillow installed. Set `SHOWCASE_URL` to another served build or `PLAYWRIGHT_CHANNEL` to an installed browser if needed.

## Privacy

Records stay in browser memory; only preferences persist. No analytics, remote processing or spreadsheet-content requests. Reload clears records. See [privacy](docs/privacy.md).

## Architecture

CSV and Excel normalize to one record model. A millimeter layout engine and shared label renderer keep the sheet preview aligned with the exported PDF. [Architecture and decisions](docs/architecture.md).

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

Saved templates, logo/image fields, additional symbologies, printer profiles, offline installation and FieldLens presets are intentionally outside the MVP.

The [post-MVP roadmap](docs/roadmap.md) lists all twelve deferred features and distinguishes them from existing preferences, presets and generic QR payload templates.

## License

No project license has been chosen by the repository owner. Third-party notices are in [public/third-party-notices.txt](public/third-party-notices.txt); those notices do not grant a license to this project.
