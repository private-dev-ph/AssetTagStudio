# Security review (in progress)

The integrated review is pending. This document is not an assertion that the application is secure.

| Severity | Area | Finding | Disposition / fix | Commit | Remaining risk |
|---|---|---|---|---|---|
| High | Excel dependency | npm xlsx 0.18.5 is obsolete and vulnerable | Use official 0.20.3 distribution and lock integrity | Foundation pending | Audit plus hostile workbook review required |
| Medium | Import | Compressed workbooks can allocate disproportionate memory | Worker isolation, file/row/column/cell limits, timeout | Pending | Worker may still exhaust browser memory before parser returns |
| Medium | Rendering | Oversized codes/layout can allocate excessive memory | Validate dimensions, payload, pixel/capacity limits | Pending | Integrated negative tests required |

Final checks planned: npm audit; strict TypeScript/ESLint; unit and browser negative tests; runtime request monitoring; no dataset persistence; headers/CSP; source/secret scan; deployment artifact inspection.

## Preliminary checks
- Foundation audit: npm audit initially found two moderate Vitest advisory entries (GHSA-82fw-gwwq-j7x9). Upgraded to4.1.11 in d494d36; rerun reports0 total vulnerabilities across288 dependencies. Final integrated audit still required.
- Headers browser E2E on production build:1/1 pass (0f41de6 test branch); CSP restricts script and worker to self and forbids framing.
- Review feedback before commits: reject Excel full-range overflow despite parser truncation; preserve QR/Code128 quiet zones; bounded expanded payloads; consistent PDF cache accounting; selected-row identifier checks. Owners addressing before merge.


## Paused checkpoint findings
- Medium: XLSX ZIP expansion before row limits. New bound-workbook-imports checkpoint f29d5bc adds declared member/aggregate allocation quotas, local/central header checks, descriptor/ZIP64/comment rejection. Latest verification pending; not merged.
- Medium: overlapping worker imports. Same checkpoint terminates superseded workers. Latest lifecycle verification pending; not merged.
- Medium: legacy XLS CFB fallback FAT-cycle traversal (SheetJS xlsx.js1801–15, reached from1880–83). Source-level review confirmed missing cycle guard; no unsafe hang PoC run. Bounded CFB preflight assigned but not implemented when user requested pause. Must resolve before deployment.
- Medium residual: distinct-label PDF embeddings accumulate in PDFDocument. Documented output memory/time limitation; final review and representative browser tests pending.
- Final dedicated integrated security pass has NOT been completed. No deployment performed.
