# Implementation handoff

Resumed at the user's request on 2026-10-04 (Asia/Shanghai). User authorizes safe escalated commands; eligible approvals use automatic review. Continue without requesting routine confirmation.

## Repository state
- Repository: C:/Users/Administrator/Documents/Github/AssetTagStudio
- Starting main and current main: 27d0582aae742990d2c25c0ef752896ac420becd; fetched again, unchanged.
- Current branch: web-deployment. Integrated implementation tip: 71f5616. Exact current documentation tip: `git rev-parse HEAD`.
- web-deployment: 71f5616 (production verification and safeguards integrated).
- No remote branch push or live deployment yet.
- Current merge conflicts: tracking and Playwright config; resolved here by refreshing tracking and retaining production header server, Edge fallback, 2 workers, 12s expectations. Prior conflicts were documentation additions and blank EOF/config differences; no source implementation conflicts.

## Feature branches
| Branch | Feature tip | Integration merge | Status |
|---|---|---|---|
| application-foundation | d494d36 | 378cdfd | Complete |
| static-deployment | 1f9b927 | 5bae5ed | Complete |
| spreadsheet-import | 275845a | 8c1722a | Complete |
| label-print-engine | b2123cf | 3bf791f | Complete |
| reduce-pdf-memory | 0f8c35e | 7a06fe4 | Complete |
| label-workspace | a0ee1bd | b203510 | Complete |
| bound-workbook-imports | 931f5b0abc27d0096e8f43cd2f006a810e5a02f3 | 0ff9609 | Complete |
| verification-hardening | b7f584e | 71f5616 | Complete: 64 unit and 15 production browser tests |
| portfolio-documentation | fb3fcb4 | Pending | Text/ADRs/notices done; actual media captured, visual review active |

Worktrees: .worktrees/label-workspace, .worktrees/spreadsheet-import (bound-workbook-imports), .worktrees/label-print-engine, .worktrees/portfolio-documentation. Feature worktrees clean at reported commits. Root merge is committed. Portfolio media/scripts are uncommitted in its worktree; workspace CSS follow-up is active.

## Architecture and interfaces
Static React/TypeScript/Vite; no backend, accounts, telemetry, uploads or remote fonts. See architecture.md for module contracts. Generic string-valued Dataset, millimeters internally, shared canvas renderer supplies both preview/PDF. PDF-lib embeds physical PNG label positions. Each PNG now embeds immediately to release decoded pixels; compressed document grows with output. Records remain in memory, only template/header names/theme/units/page/hidden-field preferences persist. Import singleton terminates superseded workers and guards stale file reads. Workbook preflight precedes SheetJS. Controls freeze during exports; failed worksheet changes clear stale records. No existing data/API migration.

## Independent verification
- Original import 18 tests; engine 21; merged baseline39.
- PDF memory feature40 unit tests, types/lint/build; postmerge PDF5/5.
- Workspace checkpoint production3/3; latest UI4/4, security/controls6/6, plus failure4/4 on verification branch.
- Workspace integration46 unit tests; after workbook merge63/63 pass.
- Workbook feature35/35, typecheck, lint, build independently passed in worktree. Independent source review found no blocking CFB/ZIP mismatch after all guards.
- Latest focused production8/8 pass: CSV/Excel serial Code128 3-page A4, missing IDs, empty-sheet recovery, export freeze, preference retention, cancellation, dense/invalid codes, invalid layout, 20k repeated labels834-page export (15s export test).
- QR decoder/privacy/XSS/headers and mobile/control tests passed in preceding production run. Added browser legacyXLS/malformed-signature test awaits integrated run.
- Audit0 after jsqr dev dependency. Final integrated audit/secret/source review and clean install pending.

Commands: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm audit --audit-level=moderate`; `$env:PLAYWRIGHT_CHANNEL='msedge'; npm run test:e2e` (production static server applies _headers).

Failures resolved: worktree Vite/esbuild parent-path access required escalation/primary checkout; dev cold import compile caused initial3 browser failures, production resolved; conflict markers temporarily caused type/lint/browser-start errors, deliberately resolved; unformatted1000/20000 row selectors failed2 tests, corrected to displayed commas and8 focused tests passed. Build warns main chunk exceeds500kB; no suppression. Chromium CDN install timed out; installed Edge used locally, CI installs Chromium.

## Security and limitations
- CFB FAT fallback loops, directory pointers/name lengths, excessive DIFAT recursion fixed in931f5b0 with bounded preflight and negative tests.
- XLSX ZIP allocation quotas/local-central consistency and superseded worker cleanup fixed same commit.
- Malformed DEFLATE/BIFF parsing can still consume CPU; 10MiB input and20s worker deadline reduce exposure, not a strict hostile-workbook resource guarantee.
- PDF compressed output, serialization and Blob still need memory. Eager image embedding and removal of extra full buffer copy mitigate peak use;20k unique-label performance not fully benchmarked.
- Raster labels are not searchable PDF text; actual printer/scanner hardware not tested.
- Some unusual/encrypted/ZIP64/descriptor/comment archives are rejected; resave ordinary XLSX/CSV.
- No project license selected by owner.40 production-package license texts included in pending portfolio branch.
- No known unresolved critical/high finding. Final dedicated integrated review still required.

## Hosting draft
Cloudflare in-app tab1 is signed in and unsaved at Pages GitHub setup. Existing GitHub app already authorizes private-dev-ph/AssetTagStudio. Project tagstudio, npm run build, dist, NODE_VERSION24. Production branch currently main in draft because integration has not been pushed. MUST select web-deployment after verified push; never deploy implementation from main. Requested hostname tagstudio.zachcodes.dev; domain not added. Do not enable analytics. No production secrets needed.

## Exact next action
1. Review and merge the checkbox/caption CSS follow-up, then regenerate portfolio media.
2. Production verification merged in71f5616; root postmerge64 unit tests passed. Update tracking after subsequent merges.
3. Generate real workspace/landing/dark/mobile screenshots, <30s GIF and sample PDF; finish portfolio branch then merge. Text/ADRs/notices already fb3fcb4.
4. Dedicated integrated security review, secret scan/audit and clean npm ci/types/lint/unit/build/browser checks from integration.
5. Push only verified web-deployment, select it in Cloudflare draft, deploy/add custom domain, verify live app/headers and GitHub CI.
6. Final main unchanged/all branches contained/clean Git checks; record final SHA and structured report/confidence.

Verification ready: be553c3 passed64/64 unit,types,lint,build and15/15 production Edge browser tests after workbook integration. No testfailures remaining. Next: merge verification, create actual portfolio media, then final clean install/integratedsecurity/live deployment.
