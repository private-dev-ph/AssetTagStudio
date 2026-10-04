# Data tools implementation

Branch: `asset-data-tools`, based on `f8281ce`. Feature commit: `f722cce`.

This branch implements Data Health, Asset ID Generator, and Serial Tools as `DataToolsPage` views. The page uses the host dataset and selected row IDs, calls `onCommitDataset` only after explicit Apply, and keeps previews in memory. It preserves each internal `record.id`; value maps are cloned with null prototypes before updates. Data Health fixes return a column map so the host can update references atomically.

Import normalization retains original header text and the number of skipped empty data rows in `Dataset.importAudit`. Duplicate header rejection remains unchanged. Empty source rows are counted for reporting and are not retained.

Custom serial patterns are limited to 120 characters, checked for known high-risk constructs, and evaluated in a module worker with a 100 ms execution timeout after a ready handshake and separately bounded five-second startup. The worker is terminated on success, error, timeout, and posting failure. Serial input is limited to 500 characters per cell and 2,000 selected rows per preview. ID previews are limited to 5,000 rows; displayed previews show at most 200 rows.

Focused local verification commands (Vitest needed the runner config loader in this restricted worktree):

```powershell
npx vitest run src/features/id-generator/logic.test.ts src/features/data-health/logic.test.ts src/features/serial-tools/logic.test.ts src/features/import/parser.test.ts --configLoader runner
npm run typecheck
npm run lint
```

Status: focused tests (27), typecheck, and lint pass locally. Implementation is committed on `asset-data-tools`, remains local and unpushed. No hosted checks or deployment are part of this work. Blank source rows are counted but cannot be restored or edited after parsing; duplicate headers still reject import by design.

## User testing improvements

`improve-data-tool-batches` adds **Start position**, **Preview count**, **Previous batch** and **Next batch** controls. Positions follow selected rows in dataset order, regardless of checkbox click order. Serial batches contain at most2,000 rows; ID batches at most5,000. The initial count is the smaller of2,000 and the selection size. Only the first200 results are displayed; Apply affects every row in that bounded preview and no other row. Selection itself is unchanged.

After a successful Apply, the tool retains its batch position. ID sequence advances by the number of IDs generated; click Next batch and Preview again to continue. The final shorter batch gets the remaining count. Changes to options/batch invalidate results and pending serial responses; external dataset/selection changes reset positions. Deduplication also resets positions because removed rows change the order. Apply remains explicit and undoable.

ID eligibility counts distinguish selected, blank and populated values. Existing IDs remain protected unless **Allow overwriting existing IDs** is explicitly checked. Unchecking blank-only does not grant overwrite permission. The [blank-ID test fixture](../../public/examples/id-generator.csv) demonstrates `TEST-{sequence}` with padding3. Collisions still block Apply.
