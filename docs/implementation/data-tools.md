# Data tools implementation

Branch: `asset-data-tools`, based on `f8281ce`. Feature commit: `f722cce`.

This branch implements Data Health, Asset ID Generator, and Serial Tools as `DataToolsPage` views. The page uses the host dataset and selected row IDs, calls `onCommitDataset` only after explicit Apply, and keeps previews in memory. It preserves each internal `record.id`; value maps are cloned with null prototypes before updates. Data Health fixes return a column map so the host can update references atomically.

Import normalization retains original header text and the number of skipped empty data rows in `Dataset.importAudit`. Duplicate header rejection remains unchanged. Empty source rows are counted for reporting and are not retained.

Custom serial patterns are limited to 120 characters, checked for known high-risk constructs, and evaluated in a module worker with a 100 ms timeout. The worker is terminated on success, error, timeout, and posting failure. Serial input is limited to 500 characters per cell and 2,000 selected rows per preview. ID previews are limited to 5,000 rows; displayed previews show at most 200 rows.

Focused local verification commands (Vitest needed the runner config loader in this restricted worktree):

```powershell
npx vitest run src/features/id-generator/logic.test.ts src/features/data-health/logic.test.ts src/features/serial-tools/logic.test.ts src/features/import/parser.test.ts --configLoader runner
npm run typecheck
npm run lint
```

Status: focused tests (27), typecheck, and lint pass locally. Implementation is committed on `asset-data-tools`, remains local and unpushed. No hosted checks or deployment are part of this work. Blank source rows are counted but cannot be restored or edited after parsing; duplicate headers still reject import by design.
