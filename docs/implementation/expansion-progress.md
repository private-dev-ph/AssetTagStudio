# Feature expansion checklist

All twelve requested features implemented and locally verified on feature-expansion. Starting/current main: 345071383d7029423e805efb799204e6852f69f7. Final source checkpoint: 4388d76a3773cd23d10b4dbe0a9c6c7c4e8878cd. No push, deployment, hosted tests or main merge. Updated 2026-10-05. Attached plan is feature specification; repository operations follow the user's request.

| Milestone / feature | Feature branch | Status | Related files | Latest relevant commit | Tests completed | Dependencies / unresolved issues | Merge status |
|---|---|---|---|---|---|---|---|
| Shared foundation | expansion-foundation | Complete | core, studio, types | 3feddae | Full unit/type/lint | Shared contracts documented | f8281ce |
| Asset ID Generator | asset-data-tools | Complete | id-generator, DataToolsPage | e8f3afa | Unit and browser collision/blank-only/apply/undo | Selected preview cap5,000 | e57f9f3 via workspace0c741a1 |
| Data Health | asset-data-tools | Complete | data-health, import audit, DataToolsPage | e8f3afa / 41fbc16 | 20k duplicate regression; browser remap/trim/undo | Empty source rows counted but discarded; duplicate headers reject at import | e57f9f3 |
| Template library / JSON portability | template-library; bound-settings-library-reads | Complete | templates, storage, TemplatesPage | 8199064 / ee9882c / fc7246c | Unit + browser CRUD/mapping/privacy/capacity/corruption/quota/retry | Settings-only100 items; blocked upgrades not manually exercised | 15d9313 / e57f9f3 |
| QR Payload Builder | expansion-workspace | Complete | payload, model, PayloadPage | 9a8fad5 / 41fbc16 | Unit + browser URL encoding/missing fields/density | Code payload cap2,000 chars | e57f9f3 |
| Location Labels | print-identity-packages | Complete | specialized-labels, renderer | 74de40d | Unit and mapped local PDF browser pass | Physical readability unverified | e57f9f3 |
| Cable Labels | print-identity-packages | Complete | specialized-labels, renderer | 68285e9 | Mirrored panel geometry/QR/Code128/no-code unit; browser PDF | Physical wraps unverified | e57f9f3 |
| Printer Calibration | print-identity-packages | Complete | calibration, layout/PDF | 74de40d | Bounds/reference PDF, signed offsets and clipping | Physical printer unverified; reference sheets100×80mm minimum | e57f9f3 |
| Code Inspector | code-inspector; code-inspector-hardening | Complete | inspector, worker, camera page | 6c909a6 | 12 focused unit; real QR/Code128 worker, PNG failures/recovery, camera denial/late cleanup | Physical camera and diverse browsers unverified | 3114c62 / e57f9f3 |
| Serial Tools | asset-data-tools; serial-worker-startup | Complete | serial-tools, regex worker, DataToolsPage | c1f4dbc | 8 focused unit; normalization/pattern browser repeated5/5 and full suite | Preview cap2,000; startup5s/execution100ms | e57f9f3 / 4388d76 |
| Asset Manifest | print-identity-packages | Complete | printJob, manifest, PDF | 74de40d / 9e0b6d2 | Frozen snapshot + actual PDF draw/manifest coordinates unit; parsed CSV/JSON/browser PDF | Unique20k PDF performance not benchmarked | e57f9f3 |
| FieldLens Export | print-identity-packages | Complete | integrations/fieldlens, export page | 74de40d | PDF/CSV ID equality/QR decode and formula rejection | Receiver-side CSV ingestion unverified | e57f9f3 |
| Printer Profiles | print-identity-packages; bound-settings-library-reads | Complete | profiles, calibration page, storage | 68285e9 / fc7246c | Strict schema, persistence/reset and overflow single-store recovery browser | Browser storage availability varies | e57f9f3 |
| Subpages / shared undo | expansion-workspace | Complete | App, navigation, styles, workspace | 9a8fad5 / 41fbc16 | Shared undo; desktop/mobile390px no overflow/page errors | Hardware/browser follow-up only | e57f9f3 |
| Local regressions | expansion-regressions; workspace | Complete | tests/e2e/expansion*.spec.ts | 79926c6 / fc7246c / 63808b9 | Final33/33 Edge, including16 unchanged original +17 expansion tests | No failed/suppressed tests | e57f9f3 / 4388d76 |
| Final verification / security / docs | feature-expansion | Complete | report, security, handoff, README | 4388d76 | Final175/175 unit (24 files), type/lint/build;33/33 Edge; audit0; secret0; all10 branch tips ancestors | Clean-installed final build passes; final documentation committed at checkpoint completion | All source integrated |

Resolved failures are retained in the report/security history: duplicated selection status, Health accessible name, inaccurate density/CSV/mapping fixtures, synchronous quota exception propagation and worker startup timing. No test removed, suppressed or weakened. Vite large-bundle and unsupported development ESLint warnings retained as follow-up. Hardware, cross-browser and receiver ingestion gaps are explicitly documented; they do not represent omitted exporter/tool implementation.

## User testing follow-up — 2026-10-05

| Milestone / feature | Feature branch | Status | Related files | Latest relevant commit | Tests completed | Dependencies / unresolved issues | Merge status |
|---|---|---|---|---|---|---|---|
| Readable text-only cable wraps, Health tables, themed scrollbars and privacy/footer | polish-workspace-interface | Testing | renderer, SpecialLabelsPage, styles, App | Cable fix2773dc0; interface working changes | Renderer10/10; Edge3/3 canvas ink/QR/table widths/themes/footer; type/lint/build pass | Integrated five browser regressions still required | Not merged |
| ID eligibility guidance and bounded serial batches | improve-data-tool-batches | Testing | DataToolsPage, selection helper/tests | a1cd2a7 | Focused18/18 unit; type/lint | Review follow-up: explicit overwrite permission and same-Apply batch/sequence continuity | Not merged |
| Follow-up integrated verification | feature-expansion | Not started | browser tests, implementation docs | Base04d115e | Pending focused and full local checks | Main/live app stay unchanged | Pending |
