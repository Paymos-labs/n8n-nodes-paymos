# n8n Creator Portal Verification Checklist (`n8n-nodes-paymos`)

Use this checklist before publishing a release to npm and submitting or updating `n8n-nodes-paymos` in the **n8n Creator Portal** for Verified Community Node review.

## 1. Repository & Package Metadata

- [ ] Public GitHub mirror repository exists at `https://github.com/Paymos-labs/n8n-nodes-paymos`.
- [ ] `package.json` name is `n8n-nodes-paymos` and includes keyword `"n8n-community-node-package"`.
- [ ] `package.json` `"dependencies"` is strictly empty (`{}`) — zero external runtime dependencies.
- [ ] `package.json` `"files"` is `["dist"]` so `tests/` and `conformance/` are excluded from the npm tarball.
- [ ] `package.json` `"n8n"` section references only compiled `dist/` files:
  - `dist/credentials/PaymosApi.credentials.js`
  - `dist/nodes/Paymos/Paymos.node.js`
  - `dist/nodes/PaymosTrigger/PaymosTrigger.node.js`
- [ ] `LICENSE` (MIT), `README.md`, `CHANGELOG.md`, `.gitignore`, and `package-lock.json` are present at repository root.
- [ ] No AI-agent instruction files (`AGENTS.md`, `CLAUDE.md`) exist in the repository root.

## 2. Node, Credential & Security Compliance

- [ ] `credentials/PaymosApi.credentials.ts` follows n8n naming convention (`PaymosApi`, `name = 'paymosApi'`).
- [ ] Both `Paymos` and `PaymosTrigger` declare `testedBy: 'paymosApiTest'` and implement `methods.credentialTest.paymosApiTest` (`GET /v1/invoices?limit=1`).
- [ ] Payment-only boundary enforced: `pk_live_` and `pk_test_` are accepted; `rk_` payout keys are rejected before any HTTP call; `Withdrawal` and `Balance` resources are absent in v1.
- [ ] `Paymos.node.ts` sets `usableAsTool: true` for n8n AI Agent compatibility.
- [ ] Sandbox operations (`/v1/sandbox/*`) reject `pk_live_` keys before any HTTP call.
- [ ] `Paymos.node.ts` retries HTTP `429` / `5xx` strictly on `GET` requests (never retries mutating `POST` requests).
- [ ] `Payment Channel Deposit: Get Many` performs single-page cursor polling returning `{ items, next_cursor, blocked? }` without a `returnAll` loop.
- [ ] `PaymosTrigger.node.ts` requires a `whsec_` signing secret on activation and verifies `X-Webhook-Signature` strictly against `req.rawBody` using `node:crypto` `timingSafeEqual`, multi-`v1=` rotation support, and a 300-second tolerance window.
- [ ] `PaymosTrigger.node.ts` returns safe `IWebhookResponseData` on all 3 paths (401 + `{ noWebhookResponse: true }`, ignored `{ webhookResponse }`, matched `{ webhookResponse, workflowData }`) without double-writing HTTP headers.
- [ ] Node SVG icons (`paymos.svg` and `paymos.dark.svg`) are each `<= 10 KB` and use a square `viewBox`.

## 3. Automated Checks & npm Provenance

- [ ] `npm ci` succeeds cleanly from the committed `package-lock.json`.
- [ ] `npm audit --omit=dev --audit-level=high` exits `0`.
- [ ] `npm test` (all 7 Vitest suites, including local `conformance/contract.json`) exits `0`.
- [ ] `npm run check` (`tsc --noEmit`) exits `0`.
- [ ] `npm run lint` (`n8n-node lint`) exits `0`.
- [ ] `npm run build` (`n8n-node build`) exits `0`.
- [ ] `.github/workflows/publish.yml` has `permissions: id-token: write`, verifies git tag `v*` matches `package.json.version`, validates packed `.tgz` contents, and publishes via `npm publish --access public --provenance`.
- [ ] Published npm package displays the verified provenance badge on `npmjs.com/package/n8n-nodes-paymos`.

## 4. Product Truth & Documentation

- [ ] `README.md` and `https://paymos.io/docs/n8n` (all 6 locales) match Paymos product facts:
  - 5 assets: 4 stablecoins (USDT, USDC, USD1, DAI) and 1 gold-backed asset (XAUT).
  - 13 networks for deposits, 11 networks for withdrawals (NEAR and Sui are deposit-only).
  - 45 fiat currencies; 18 canonical webhook events.
  - Self-hosted AI Agent env flag `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true` documented.
- [ ] Live smoke test performed with a Sandbox (`pk_test_`) key in a real n8n instance (`n8n-node dev`) before submitting to the Creator Portal.
