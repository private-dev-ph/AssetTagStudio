# Feature expansion checklist

All12 requested; local-only feature-expansion based on main345071383d7029423e805efb799204e6852f69f7. No push/deployment/main merge/hosted tests. Source specification: feature-expansion-plan.md. Status updated2026-10-05.

| Milestone / feature | Branch | Status | Related files | Latest commit | Verification | Dependencies / unresolved | Merge status |
|---|---|---|---|---|---|---|---|
| Foundation | expansion-foundation | Complete | core, studio, types | 3feddae | 107unit/type/lint | Shared contracts documented | feature-expansion f8281ce |
| Asset ID Generator | asset-data-tools | Testing | id-generator, DataToolsPage | e8f3afa | 27focused; browser collision/blank-only/undo pass | Final full suite | workspace0c741a1; integration pending |
| Data Health | asset-data-tools | Testing | data-health, import audit | e8f3afa | 20k duplicate regression; unit pass | Health selector fix pending browser rerun | workspace0c741a1 |
| Template library / JSON portability | template-library | Testing | templates, storage, TemplatesPage | 8199064; hierarchy ee9882c | 7focused; browser CRUD/mapping/privacy pass | Capacity/corruption new test pending | feature-expansion15d9313 |
| QR Payload Builder | expansion-workspace | Testing | core/payload, PayloadPage | 9a8fad5 | focused tests pass | Density fixture corrected; final rerun | Workspace; integration pending |
| Location Labels | print-identity-packages | Testing | specialized-labels, renderer | 74de40d | Focused print tests28pass | Final browser geometry/hierarchy | Final fixes pending merge |
| Cable Labels | print-identity-packages | Testing | specialized-labels, renderer | 74de40d | Mirrored panel geometry/QR/Code128 tests | Final browser checks | Final fixes pending merge |
| Printer Calibration | print-identity-packages | Testing | calibration, layout/PDF | 74de40d | Bounds/referencePDF focused pass | Physical printer unverified | Final fixes pending merge |
| Code Inspector | code-inspector | Testing | inspector, decoder, camera | f5904e0 | 9unit; realQR/Code128 worker and camera cleanup browser pass | Physical camera unverified; final full suite | feature-expansion3114c62 |
| Serial Tools | asset-data-tools | Testing | serial-tools, regex worker | e8f3afa | Focused tests; browser normalize/pattern pass | Final full suite | workspace0c741a1 |
| Asset Manifest | print-identity-packages | Testing | printJob, manifest, PDF | 74de40d | Snapshot/placements unit; browserPDFpages/coords pass | ParsedCSV assertions pending rerun | Final fixes pending merge |
| FieldLens Export | print-identity-packages | Testing | integrations/fieldlens, export | 74de40d | Browser PDF/CSV matching IDs + QR decode + formula rejection pass | CSV receiver importer unverified | Final fixes pending merge |
| Printer Profiles | print-identity-packages | Testing | calibration, storage | 74de40d | Strict schema/limits focused pass | Final persistence/recovery browser | Final fixes pending merge |
| Subpages / shared undo | expansion-workspace | Testing | App, navigation, styles | 9a8fad5 | Whole155unit/type/lint/build; browser shared undo pass | Final integration/full suite | Integration pending |
| Local regression coverage | expansion-regressions | Testing | e2e/expansion*.spec.ts | 298ecfb | 14discovered; subset8/11pass; fixes ready | Merge/rebuild/rerun | workspace194be05 earlier; final pending |
| Final security / docs / Git | feature-expansion | In progress | README, privacy, roadmap, security review | d09e09a integration checkpoint | npm audit0; original browser15/16 then fixed test passes | Final suite/security/clean install/branch verification | Pending |

Original browser failure: duplicated status text made selector ambiguous; fixed status wording, unchanged Excel test passed. Expansion failures: Health accessible name and inaccurate density/CSV fixtures; corrected, rerun pending. All failures remain recorded. No feature marked Complete solely for code.
