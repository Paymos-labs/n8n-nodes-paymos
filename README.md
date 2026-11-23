# n8n-nodes-paymos

Official n8n community node package for [Paymos](https://paymos.io) — accept stablecoin (**USDT, USDC, USD1, DAI**) and gold-backed **XAUT** payments across **13 networks**, manage per-customer Payment Channels and server-calculated invoice refunds, and trigger workflows on verified Paymos webhooks.

Designed for both **n8n Cloud** and **Self-Hosted n8n** with **zero runtime dependencies** (`"dependencies": {}`), built-in `node:crypto` HMAC-SHA256 signing and raw-body webhook verification, and AI Agent support (`usableAsTool: true`).

## Highlights

- **5 supported assets across 13 deposit networks:** 4 stablecoins (**USDT, USDC, USD1, DAI**) and 1 gold-backed asset (**XAUT**) on **TRC20, ERC20, BEP20, POLYGON, ARBITRUM, OPTIMISM, BASE, TON, AVAX, SOL, NEAR, SUI, PLASMA** (withdrawals support 11 networks — NEAR and Sui are deposit-only — and are intentionally excluded from v1 of this node).
- **45 fiat pricing currencies:** Create invoices denominated in 45 fiat currencies or directly in crypto.
- **Payment-only API key boundary:** Connects with a Paymos Payment API key (`pk_live_` for Production or `pk_test_` for Sandbox) and Secret Key (`sk_...`). Payout keys (`rk_...`) are rejected before any request is sent; `Withdrawal` and `Balance` operations are not included in v1.
- **Zero runtime npm dependencies:** All HMAC-SHA256 request signatures and `X-Webhook-Signature` checks run on built-in `node:crypto` and n8n's `this.helpers.httpRequest`.
- **AI Agent Tool ready (`usableAsTool: true`):** Attach the `Paymos` node directly as a tool to n8n AI Agent workflows.
- **All 18 canonical webhook events + `*`:** `Paymos Trigger` verifies `X-Webhook-Signature` against the exact `rawBody` with constant-time comparison, multi-`v1=` secret rotation support, and a 300-second replay window.

## Installation

### n8n Cloud & Self-Hosted (Community Nodes UI)

1. Open **Settings → Community Nodes** in your n8n instance.
2. Select **Install a community node**.
3. Enter `n8n-nodes-paymos` and confirm installation.

### Self-Hosted (Manual / Docker)

```bash
npm install n8n-nodes-paymos
```

To allow the `Paymos` node to be used as an **AI Agent tool** on self-hosted n8n, set:

```bash
N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true
```

## Quickstart (3 minutes)

1. **Copy your Project ID (`prj_...`)** from **Paymos Dashboard → Projects → Details**.
2. **Copy a Payment API key pair (`pk_` + `sk_`)** from **Paymos Dashboard → Developer → API Keys** (flip the top-bar **Test** switch on for Sandbox `pk_test_...` / `sk_test_...`, or off for Production `pk_live_...` / `sk_live_...`).
3. **Create a `Paymos API` credential** in n8n and click **Save** (or **Retry / Test**) to verify connectivity.
4. **Add a `Paymos` node** (`Invoice` → `Create`) with your `project_id`, `amount`, `currency`, and a unique `external_order_id`, then send `={{ $json.payment_url }}` to your customer.
5. **Add a `Paymos Trigger` workflow** listening to `invoice.paid` and `invoice.paid_over`, register its **Production URL** in **Paymos Dashboard → Developer → Webhooks**, paste the resulting `whsec_...` into your **Paymos API** credential, and fulfil orders using `={{ $json.data.invoice_id }}` and `={{ $json.data.order.external_id }}`.

## Credentials (`Paymos API`)

Create a **Paymos API** credential in n8n using keys from **Paymos Dashboard → Developer → API Keys**:

| Field | Required | Description |
| --- | --- | --- |
| **Public Key** | Yes | Payment API key: `pk_live_...` (Production) or `pk_test_...` (Sandbox). Payout keys (`rk_...`) are rejected. |
| **Secret Key** | Yes | Full Payment API secret (`sk_...`) used for HMAC-SHA256 request signing. |
| **Webhook Signing Secret** | Trigger only | `whsec_...` secret from **Dashboard → Developer → Webhooks**. Required when activating `Paymos Trigger`. |
| **API Base URL** | Yes | Defaults to `https://api.paymos.io` (serves both Production and Sandbox based on your key prefix). |

Clicking **Save** / **Test** runs a signed `GET /v1/invoices?limit=1` check against the Paymos Merchant API. Keep two credentials — **Paymos Sandbox** (`pk_test_...`) and **Paymos Production** (`pk_live_...`) — so you can test end-to-end before switching to live traffic.

## Common Workflows

- **Hosted Checkout link on new orders:** Trigger (Telegram / Webhook / Form / CRM) → **Paymos** (`Invoice: Create`) → send `={{ $json.payment_url }}` and save `={{ $json.invoice_id }}`.
- **Automatic order fulfilment:** **Paymos Trigger** (`invoice.paid`, `invoice.paid_over`) → deduplicate on `={{ $json.data.invoice_id }}` + `={{ $json.event_id }}` → grant access or mark the CRM deal paid using `={{ $json.data.order.external_id }}`.
- **Permanent customer deposit addresses:** **Paymos** (`Payment Channel: Create` with stable customer `external_id`) → credit balances on `payment_channel.deposit.confirmed` or via scheduled `Payment Channel Deposit: Get Many` storing `={{ $json.next_cursor }}`.
- **Support refunds without payout keys:** Helpdesk/CRM trigger → **Paymos** (`Refund: Create` with `invoice_id`, `mode: full | overpayment`, `external_order_id`) → optionally listen to `withdrawal.completed` / `withdrawal.failed` in **Paymos Trigger**.
- **AI Agent checkout & support tool:** Attach **Paymos Tool** to an n8n **AI Agent** and instruct it to pass your `project_id`, use a unique `external_order_id`, return `payment_url`, and verify status with `Invoice: Get` before confirming payment.

## Operations (`Paymos` node — 18 operations)

### Invoice (6 operations)

- **Create** (`POST /v1/invoices`) — Create an invoice in any of 45 fiat currencies or supported crypto assets, with idempotent `external_order_id`, optional `network`, `customer_fee_percent`, `client_id`, and optional checkout line items (`products[]`).
- **Get** (`GET /v1/invoices/{id}`) — Fetch an invoice by ID (`inv_...`).
- **Get Many** (`GET /v1/invoices`) — List invoices with keyset cursor pagination (`returnAll` or `limit`), filtering by `project_id`, `status`, `external_order_id`, `created_from` / `created_to` (Unix seconds).
- **Confirm Payment** (`POST /v1/invoices/{id}/confirm-payment`) — Lock the exchange rate and allocate a deposit address for a fiat-denominated invoice (Host-to-Host checkout).
- **Cancel** (`POST /v1/invoices/{id}/cancel`) — Cancel an invoice still in `awaiting_client` with a reason.
- **Simulate Sandbox Payment** (`POST /v1/sandbox/invoices/{id}/simulate-payment`) — Sandbox only (`pk_test_` required; rejected client-side for `pk_live_`). Drives an invoice to `paid`, `overpaid`, `underpay`, `cancel`, or `paid_late`.

### Payment Channel (6 operations)

- **Create** (`POST /v1/payment-channels`) — Idempotently create or retrieve a permanent multi-network deposit identity for a customer (`project_id` + `external_id`).
- **Get** (`GET /v1/payment-channels/{id}`) — Fetch a payment channel with provisioned addresses and live per-token `minimum_deposit`.
- **Get Many** (`GET /v1/payment-channels`) — List payment channels with keyset cursor pagination (`returnAll` or `limit`), filtering by `project_id`, `status`, `external_id`.
- **Block** (`POST /v1/payment-channels/{id}/block`) — Stop attributing new deposits to a channel.
- **Unblock** (`POST /v1/payment-channels/{id}/unblock`) — Resume attributing deposits to a channel.
- **Simulate Sandbox Deposit** (`POST /v1/sandbox/payment-channels/{id}/simulate-deposit`) — Sandbox only (`pk_test_` required). Simulates a `confirming`, `reorged`, or `confirmed` deposit on a channel.

### Payment Channel Deposit (2 operations)

- **Get** (`GET /v1/payment-channel-deposits/{id}`) — Fetch a single deposit (`pcd_...`) in any state (`confirming`, `reorged`, `confirmed`).
- **Get Many** (`GET /v1/payment-channel-deposits`) — Single-page cursor poll of the confirmed-deposit feed (`cursor`, `limit`, `project_id`, `payment_channel_id`, `confirmed_from`). Always returns `{ items, next_cursor, blocked? }` without looping `returnAll`, because `next_cursor` is never `null` on an endless feed — persist `next_cursor` in your workflow state and pass it into the next poll.

### Refund (4 operations)

- **Create** (`POST /v1/refunds`) — Create a server-calculated `full` or `overpayment` invoice refund back to the first saved sender (`invoice_id`, `mode`, `external_order_id`).
- **Get** (`GET /v1/refunds/{id}`) — Fetch a refund by withdrawal ID (`wdr_...`).
- **Get Many** (`GET /v1/refunds`) — List refunds with keyset cursor pagination (`returnAll` or `limit`), filtering by `invoice_id`, `status`, `created_from` / `created_to` (RFC 3339 timestamps).
- **Simulate Sandbox Refund** (`POST /v1/sandbox/refunds/{id}/simulate`) — Sandbox only (`pk_test_` required). Drives a sandbox refund to `completed`, `failed`, or `cancelled`.

> **v1 Scope Note:** Outgoing withdrawals (`Withdrawal`) and balance reads (`Balance`) require a Payout API key (`rk_...`) and are not exposed in v1 of `n8n-nodes-paymos`.

## Webhook Trigger (`Paymos Trigger`)

1. Add **Paymos Trigger** to your workflow and copy its **Production URL** (use **Test URL** only while testing interactively in the editor).
2. In **Paymos Dashboard → Developer → Webhooks**, create an HTTPS endpoint with that URL and choose your categories (`Invoice`, `Payment channel`, `Withdrawal`).
3. Copy the generated `whsec_...` signing secret into the **Webhook Signing Secret** field of your **Paymos API** credential in n8n.
4. Select specific events or `*` (All Events) on the trigger node and activate the workflow.

Supported canonical events (**18** total):

- **Invoice (9):** `invoice.awaiting_payment`, `invoice.confirming`, `invoice.underpaid_waiting`, `invoice.paid`, `invoice.paid_over`, `invoice.underpaid`, `invoice.expired`, `invoice.cancelled`, `invoice.paid_late`
- **Payment Channel Deposit (3):** `payment_channel.deposit.confirming`, `payment_channel.deposit.reorged`, `payment_channel.deposit.confirmed`
- **Withdrawal (6):** `withdrawal.created`, `withdrawal.processing`, `withdrawal.completed`, `withdrawal.failed`, `withdrawal.cancelled`, `withdrawal.completion_rewound`

Deliveries missing `rawBody`, failing HMAC verification, or exceeding the 300-second timestamp tolerance receive HTTP `401` and never start the workflow. Valid deliveries for non-selected events return HTTP `200 { "received": true, "ignored": true }` without triggering the workflow.

## Troubleshooting

| Symptom / error | Fix |
| --- | --- |
| `Payout API keys (rk_) are not supported` | Use a **Payment** key (`pk_live_` or `pk_test_`) from **Dashboard → Developer → API Keys**. |
| `Paymos API 401: Invalid API credential or signature` | Re-copy the full `sk_` secret, confirm the key is active, and verify NTP clock sync on Self-Hosted n8n. |
| `Paymos Trigger requires a Webhook Signing Secret (whsec_...)` | Paste `whsec_...` from **Dashboard → Developer → Webhooks** into **Paymos API** and re-activate. |
| Webhooks missing or `401` on Self-Hosted n8n | Register the trigger's **Production URL**, configure public HTTPS `N8N_WEBHOOK_URL`, and forward the exact raw body without re-serialising JSON. |
| `Sandbox simulation operations require a Sandbox Payment API key (pk_test_)` | Switch to a Sandbox `pk_test_` credential or remove `Simulate Sandbox *` nodes before going live. |
| **Paymos** not listed under AI Agent tools (Self-Hosted) | Set `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true` and restart n8n. |

## Development

```bash
npm ci
npm test
npm run check
npm run lint
npm run build
```

## Documentation & Support

- [Paymos n8n Integration Guide](https://paymos.io/docs/n8n)
- [Paymos Merchant API Docs](https://paymos.io/docs)
- [Webhooks Reference](https://paymos.io/docs/webhooks)
- [Issues](https://github.com/Paymos-labs/n8n-nodes-paymos/issues)

## License

[MIT](./LICENSE)
