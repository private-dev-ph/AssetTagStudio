# Product roadmap after the MVP

These are the twelve later-feature items explicitly deferred in section 6 of the original end-to-end plan. They are proposed work, not a schedule or implemented capability.

| Feature | What remains |
|---|---|
| Data Matrix | Another compact 2D code format, with size/quiet-zone validation, preview/PDF and scanner tests. |
| EAN / UPC | Retail code formats, with digit-length and checksum validation. Code128 is already implemented. |
| Logo placement | Place an optional local logo while preserving code readability and print dimensions. |
| Image fields | Associate/render images from input fields with explicit source/privacy and resource rules. |
| Saved local templates | A named template library and switching/deletion. The current app remembers the last template/preferences; it does not provide a library. |
| JSON template import/export | Portable versioned template files with validation and a compatibility/migration policy. |
| Bulk formatting rules | Apply field transformations/prefixes/conditional formatting across records, without becoming a spreadsheet editor. |
| Sequential asset-ID generation | Create configurable, padded ID sequences and avoid collisions with imported values. |
| Printer profiles | Reusable stock/printer dimensions and calibration offsets. Page/label presets already exist. |
| PWA / offline installation | Installable app and explicit offline asset/update behavior. Client-only processing currently works after loading, but offline installation/reload is not guaranteed. |
| Direct browser printing | Print workflow alongside authoritative PDF export, with browser scaling and layout verification. |
| FieldLens QR presets | A validated preset/integration contract for FieldLens asset links. Generic payload templates already allow strings such as fieldlens://asset/{asset_id}; no dedicated preset or end-to-end FieldLens integration exists. |

A practical sequence is saved templates + JSON portability, then printer profiles/calibration and sequential IDs. Additional code formats and logos/images should follow real user needs. PWA updates and FieldLens integration need their own compatibility/privacy decisions. This ordering is a suggestion, not a change to the original scope.

Separate reliability follow-up includes physical printing/scanning, Firefox/Safari coverage, benchmarking large unique-label PDFs, workbook fuzz testing, bundle splitting and updating the development linter. Those tasks improve the existing MVP rather than add the roadmap features above. The owner selected Apache-2.0 for the project after the initial release.
