# Security review (in progress)

The integrated review is pending. This document is not an assertion that the application is secure.

| Severity | Area | Finding | Disposition / fix | Commit | Remaining risk |
|---|---|---|---|---|---|
| High | Excel dependency | npm xlsx 0.18.5 is obsolete and vulnerable | Use official 0.20.3 distribution and lock integrity | Foundation pending | Audit plus hostile workbook review required |
| Medium | Import | Compressed workbooks can allocate disproportionate memory | Worker isolation, file/row/column/cell limits, timeout | Pending | Worker may still exhaust browser memory before parser returns |
| Medium | Rendering | Oversized codes/layout can allocate excessive memory | Validate dimensions, payload, pixel/capacity limits | Pending | Integrated negative tests required |

Final checks planned: npm audit; strict TypeScript/ESLint; unit and browser negative tests; runtime request monitoring; no dataset persistence; headers/CSP; source/secret scan; deployment artifact inspection.
