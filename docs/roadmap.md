# Product roadmap after the MVP

These are the twelve later-feature items deferred in section 6 of the original end-to-end plan. The separate local `feature-expansion` branch now implements the items marked below, plus Data Health, serial tools, payload tooling, cable/location labels, code inspection and exact print manifests. The live deployment remains on main. See [the expansion checklist](implementation/expansion-progress.md) for verification status.

| Feature | What remains |
|---|---|
| Data Matrix | Another compact 2D code format, with size/quiet-zone validation, preview/PDF and scanner tests. |
| EAN / UPC | Retail code formats, with digit-length and checksum validation. Code128 is already implemented. |
| Logo placement | Place an optional local logo while preserving code readability and print dimensions. |
| Image fields | Associate/render images from input fields with explicit source/privacy and resource rules. |
| Saved local templates | Implemented in the local expansion: named IndexedDB CRUD, six presets and explicit field mapping. |
| JSON template import/export | Implemented in the local expansion: strict versioned settings-only documents and unknown-version/property rejection. |
| Bulk formatting rules | Apply field transformations/prefixes/conditional formatting across records, without becoming a spreadsheet editor. |
| Sequential asset-ID generation | Implemented in the local expansion: selected/blank-only padded sequences, tokens, collision checks and undo. |
| Printer profiles | Calibration profiles implemented in the local expansion; stock/page/label settings are portable with templates. |
| PWA / offline installation | Installable app and explicit offline asset/update behavior. Client-only processing currently works after loading, but offline installation/reload is not guaranteed. |
| Direct browser printing | Print workflow alongside authoritative PDF export, with browser scaling and layout verification. |
| FieldLens QR presets | Implemented in the local expansion: validated raw asset URIs and matching PDF/CSV export; actual receiver CSV ingestion remains unverified. |

Next candidates are additional code formats, local logos/images and broader formatting rules, guided by real workflows. PWA updates and direct printing need explicit compatibility and privacy decisions. FieldLens CSV ingestion requires a verified receiver-side importer. These are follow-up suggestions outside the twelve-feature expansion.

Separate reliability follow-up includes physical printing/scanning, Firefox/Safari coverage, benchmarking large unique-label PDFs, workbook fuzz testing, bundle splitting and updating the development linter. Those tasks improve the existing MVP rather than add the roadmap features above. The owner selected Apache-2.0 for the project after the initial release.
