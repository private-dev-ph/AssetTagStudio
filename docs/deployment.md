# Static deployment

The app builds to `dist` and has no backend, database, account or runtime secret. Node 24 LTS and the checked-in lockfile are the build contract.

## Verified deployment

- Live: [tagstudio.zachcodes.dev](https://tagstudio.zachcodes.dev), with [tagstudio.pages.dev](https://tagstudio.pages.dev) as the provider mirror.
- Cloudflare Pages project: `tagstudio`; Git repository: `private-dev-ph/AssetTagStudio`; production branch: `main` after the owner-authorized cutover on 2026-10-04. Exact cutover status and release SHA are recorded in implementation/handoff.md.
- Build: `npm run build`, output: `dist`, `NODE_VERSION=24`. Automatic Git deployments enabled. The initial release used `web-deployment`; the owner subsequently authorized merging it into main and serving main.
- Custom hostname maps to `tagstudio.pages.dev` through a proxied CNAME; dashboard reports Active and SSL enabled. HTTPS 200 and all five configured security headers verified on both hostnames on 2026-10-04.
- GitHub Actions independently verifies clean install, types, lint, unit/browser tests, build and audit. The deployed application bundle matches the locally verified build.
- The existing zone-wide Web Analytics setting injected a beacon on the custom hostname. An active Configuration Rule named `Disable analytics for AssetTag Studio` matches `(http.host eq "tagstudio.zachcodes.dev")` and sets Disable RUM. The app response now has no injected beacon; the portfolio retains its analytics. Preserve this rule when changing hosting. See [Cloudflare's RUM configuration setting](https://developers.cloudflare.com/rules/configuration-rules/settings/#disable-real-user-monitoring-rum).

## Cloudflare Pages (recommended)

1. Connect this GitHub repository in Cloudflare Pages.
2. Choose `main` as the production branch. The previous `web-deployment` production setting belongs to the initial release; the owner authorized the main cutover afterward.
3. Select React/Vite, build command `npm run build`, output directory `dist`. Set NODE_VERSION to 24 if the environment does not provide it.
4. Deploy and verify the resulting HTTPS URL; configure a custom domain only if desired.

Cloudflare's Git integration automatically builds branch changes after the project is connected. No deployment token goes into this repository. CI runs independently on pull requests and pushes to main/web-deployment. Live URLs above were recorded after provider deployment and HTTPS verification.

`public/_headers` is copied to the build and applies to Cloudflare static responses. It disallows remote scripts, framing, objects and forms, and restricts workers to the same origin. Inline styles are needed for physical preview dimensions; scripts remain external. No Functions are used. Other providers must configure equivalent headers themselves.

## Verify a deployment

- Load root URL and refresh; inspect console for errors.
- Confirm `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, Referrer-Policy and Permissions-Policy in response headers.
- Import CSV and a multiple-sheet Excel workbook, change sheets, create QR and Code128 PDFs.
- Confirm Network shows only static app assets; no inventory values leave the device.
- Open downloaded PDF and print at **actual size / 100%**, disable fit-to-page.
- Run `npm ci && npm run typecheck && npm run lint && npm test && npm run test:e2e && npm run build` in a clean checkout (install Playwright Chromium first).
- Ensure dist contains its worker bundle and _headers. Do not upload node_modules, source inventory files or credentials.

## Alternatives

Vercel/Netlify can host dist with equivalent build settings and provider-specific response headers. GitHub Pages serves static files but does not apply Cloudflare _headers and requires setting Vite base for a repository subpath. This project targets root hosting; do not assume subpath deployment works without configuring base and testing worker/sample URLs.

Sources: [Cloudflare build settings](https://developers.cloudflare.com/pages/configuration/build-configuration/), [headers](https://developers.cloudflare.com/pages/configuration/headers/), [Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/), [GitHub Actions security](https://docs.github.com/en/actions/reference/security/secure-use).

Local browser fallback: if the Chromium CDN is unavailable and Microsoft Edge is installed, use PLAYWRIGHT_CHANNEL=msedge for npm run test:e2e. CI uses bundled Chromium by default.

To verify a deployed build with the same synthetic-data suite, set `PLAYWRIGHT_BASE_URL` to its HTTPS root URL and run `npm run test:e2e`. This skips the local build/server and keeps the privacy assertion tied to the configured origin. Clear this variable to return to local production testing. The suite performs no server writes; imported fixtures and generated PDFs stay in the test browser.

Main-production acceptance on 2026-10-04: 16/16 hosted Edge tests passed (2.3 minutes), 16/16 local production Edge tests passed (1.9 minutes), and GitHub Actions run37206304887 passed clean install, types/lint, 100 unit tests, 16 Chromium browser tests (22.2 seconds), build and audit0 on ac3fa0e. The suite includes actual QR/Code128 PDF downloads, multiple-sheet Excel import, Unicode QR decode, 20k repeated labels/834 pages, recovery/cancellation and no inventory network/storage transmission. Both live hostnames serve complete `/LICENSE.txt`, `/NOTICE.txt` and `/third-party-notices.txt` with the configured security headers and no injected analytics. Physical print hardware remains unverified.

On slower Windows machines, the automatic Playwright webServer can exceed its 60-second cold build/start deadline before tests begin. Build first, then start the existing production server in one terminal:

```powershell
npm run build
node tests/serve-production.mjs
```

In a second terminal, run the unchanged suite against that loopback server:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
$env:PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:4173'
npm run test:e2e
Remove-Item Env:PLAYWRIGHT_BASE_URL
```

Stop the server with Ctrl+C after testing. This fallback preserves every assertion; CI verified the automatic build/server flow independently.
