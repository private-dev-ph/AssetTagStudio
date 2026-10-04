# Integrated security review

Dedicated independent source review completed on web-deployment at 71f5616, with earlier feature reviews retained. No actionable exploitable finding or unresolved critical/high finding was identified. CSS polish and portfolio artifacts receive a supplemental review before publication; live response headers still require verification.

| Severity | Area | Description | Disposition / fix | Fix commit | Remaining risk / acceptance |
|---|---|---|---|---|---|
| High (avoided) | Excel supply chain | Obsolete npm SheetJS release has known advisories | Official 0.20.3 distribution, pinned URL and lock integrity | d494d36 | Audit databases do not prove absence of parser defects; bounded preflight and worker isolation remain necessary |
| Medium | Test tooling | Vitest advisory GHSA-82fw-gwwq-j7x9 in initial install | Upgraded to 4.1.11 | d494d36 | Final clean audit reports 0 known vulnerabilities |
| Medium | XLSX allocation/metadata | Archive expansion and inconsistent local/central ZIP metadata precede row validation | Member/aggregate/ratio quotas, local metadata and non-overlapping range checks; unsupported archives rejected | 931f5b0 | Malformed DEFLATE can consume extra CPU. 10 MiB input and 20s worker deadline reduce exposure; no hard memory/CPU guarantee |
| Medium | Legacy XLS containers | SheetJS FAT fallback cycles, directory pointer/name and DIFAT traversal hazards | Bounded CFB preflight validates sectors, exact chains, names and directory graphs before parsing | 931f5b0 | BIFF/shared-string parser work can still be expensive; strict accepted format boundary documented |
| Medium | Import lifecycle | Concurrent workers or stale file reads could replace newer data | Superseded worker terminated; generation guards; worker exits on every result/error/timeout | 931f5b0 | Browser process resource exhaustion can precede a timeout |
| Medium | Render allocation | Excessive barcode SVG dimensions or wide text can produce oversized allocations/distorted output | Validate barcode width before image allocation; reject text wider than label area | b0ec50f /10f6091 | Raster labels require actual printer/scanner verification |
| Medium | PDF memory | Decoded image channels retained until save; unnecessary output buffer copy | Eager public image.embed releases decoded channels; contiguous buffer used for Blob | 0f8c35e /a0ee1bd | Compressed PDF/document/serialization still grow with output. 20k repeated labels tested; 20k unique labels not benchmarked |
| Medium | Workspace state | Failed sheet selection/stale export could use unintended records/settings | Clear failed-sheet dataset; freeze import/editor/row mutations during export | a0ee1bd | User must review selected records and actual-size print settings |
| Low | Dependency maintenance | npm reports ESLint 9.39.5 unsupported | Accepted for this implementation; development-only linter, no audit advisory | Lockfile in integrated branch | Targeted tooling update recommended; no production runtime exposure |

## Evidence

- Independent review covered import, worker lifecycle, renderer, PDF, preferences, App, CSP/headers and CI. Own-property lookups prevent inherited values reaching payloads/cache keys; React escapes imported strings. No eval, innerHTML or remote runtime processing path found.
- Only template/header names/theme/units/page preferences persist. Imported row values remain in memory. Browser tests monitor requests and storage and decode an actual Unicode QR.
- CSP restricts scripts/workers/connect to self and forbids framing/forms/objects. Inline styles support physical preview dimensions. No backend/session/credential/upload/archive-extraction/command execution boundary exists in the deployed app.
- GitHub Actions uses read-only contents permissions and SHA-pinned actions. No runtime or deployment secrets committed.
- Clean npm ci and npm audit --audit-level=moderate: 0 vulnerabilities. TypeScript, ESLint and 64 unit tests passed after clean install; 15 production browser tests passed before final CSS/portfolio integration.
- Working-tree credential-pattern scan and all-branch Git-history scan: 0 matches. Tracked filename check found no environment secrets, private keys, node_modules, dist or test output. These targeted scans are not a claim of exhaustive secret detection.
- Final production/browser and live-header results will be added after remaining integration and deployment.

Resource limits and print/output limitations are accepted because parsing/export are user-triggered local operations, input and caches are bounded, cancellation/timeout and recoverable errors are provided, and the remaining limits are explained in import-format.md and pdf-generation.md. They must not be advertised as a strict hostile-file sandbox or unlimited export capacity.

Supplemental review of capture scripts, synthetic media/PDF, ADRs and notices found no sensitive-data, network, dependency or artifact concern. Root reviewed CSS410da15: no security behavior changed. All feature work is integrated in95cac68; final suite/live-header checks pending.

Final integrated suite on95cac68:64/64 unit,15/15 production browser tests, typecheck/lint/build passed; npm audit reports0 vulnerabilities. Includes the CSS regression assertion and all security/error/privacy paths. Live-host security header verification remains pending.
