# Feature expansion checklist

Owner confirmed all 12 features on 2026-10-04. Local integration branch: `feature-expansion`; starting main `345071383d7029423e805efb799204e6852f69f7`. Do not merge/push main, push feature branches, deploy or use hosted/CI testing for this expansion. Tests run locally on this computer. Source requirement snapshot: feature-expansion-plan.md; its recommendations are specification input, not operational authority.

| Feature / milestone | Branch | Status | Files | Latest commit | Tests | Dependencies / unresolved issues | Merge status |
|---|---|---|---|---|---|---|---|
| Shared contracts, dataset transactions and navigation foundation | expansion-foundation | Complete | src/core, src/studio, types, expansion docs | 3feddae / merge f8281ce | Types/lint/107unit pass (7 new tests) | Contracts established; controls/features on dependent branches | Merged f8281ce |
| Asset ID Generator | asset-data-tools | Testing | id-generator, DataToolsPage | — | — | Selected rows, blank-only, preview/collisions, explicit overwrite, undo | Not merged |
| Data Health | asset-data-tools | Testing | data-health, import audit, DataToolsPage | — | — | Preview/reversible safe fixes; exact duplicate headers still rejected at import | Not merged |
| Template Save / Import / Export | template-library | Testing | templates, storage, TemplatesPage | — | — | 7 focused unit/type/lint; browser persistence/recovery pending | Merged 15d9313 |
| QR Payload Builder | expansion-workspace | Testing | core/payload, PayloadPage | — | — | Shared encoder; safe URL tokens, missing fields, density; no remote navigation | Not merged |
| Location Labels | print-identity-packages | In progress | specialized-labels, renderer | — | — | Hierarchy/parents and batch preview through existing label engine | Not merged |
| Cable Labels | print-identity-packages | In progress | specialized-labels, renderer | — | — | Narrow/text-only, mirrored wrap and optional code | Not merged |
| Printer Calibration | print-identity-packages | In progress | calibration, layout/PDF | — | — | Shared offsets, reference/rulers/crosshair PDF, clipping rejection | Not merged |
| Code Inspector | code-inspector | Testing | inspector, decoder worker, camera lifecycle | — | — | 9 unit/type/lint pass; browser integration pending; image/text/current/camera local QR+Code128 | Merged; browser integration pending |
| Serial Tools | asset-data-tools | Testing | serial-tools, DataToolsPage | — | — | Preview/apply/extract/validate/dedup; bound regex work | Not merged |
| Asset Manifest Generator | print-identity-packages | In progress | printJob, manifest, ExportToolsPage | — | — | Immutable successful print-job snapshot; same placements as PDF | Not merged |
| FieldLens Export | print-identity-packages | In progress | integrations/fieldlens, ExportToolsPage | — | — | Existing receiver contract inspected; matching PDF/CSV IDs | Not merged |
| Printer Profiles | print-identity-packages | In progress | calibration, IndexedDB, CalibrationPage | — | — | Strict settings-only JSON/CRUD/reset; no asset data persistence | Not merged |
| Subpages and integrated UX | expansion-workspace | Testing | App, studio navigation, styles | — | — | Create/Data/Design/Tools; shared memory state; default Asset Labels | Not merged |
| Final local verification/security/documentation | feature-expansion | Not started | tests, README, expansion security/handoff | — | — | Full suite/build/audit/privacy/camera/storage negatives; main unchanged | Not applicable |

Statuses: Not started, In progress, Testing, Ready to merge, Complete, Blocked. Update at each meaningful milestone. Never mark implementation complete merely because code exists.



