# n8n-nodes-paymos — Offizielles Paymos-Community-Node-Paket für n8n

[English](../README.md) | [简体中文](README.zh-CN.md) | [Русский](README.ru.md) | [Español](README.es.md) | **Deutsch** | [Türkçe](README.tr.md)

Offizielles n8n-Community-Node-Paket für [Paymos](https://paymos.io/de) — akzeptieren Sie Stablecoin-Zahlungen (**USDT, USDC, USD1, DAI**) sowie goldgedecktes **XAUT** über **13 Netzwerke**, verwalten Sie kundenbezogene Payment Channels und serverseitig berechnete Rechnungsrückerstattungen und lösen Sie Workflows über verifizierte Paymos-Webhooks aus.

Entwickelt für **n8n Cloud** und **Self-Hosted n8n** mit **null Runtime-Abhängigkeiten** (`"dependencies": {}`), integrierter `node:crypto`-HMAC-SHA256-Signierung, Raw-Body-Webhook-Verifizierung und KI-Agenten-Unterstützung (`usableAsTool: true`).

[![Video ansehen: Paymos-API-Schnellstart in 10 Minuten — Von der Sandbox bis zu signierten Webhooks](https://i.ytimg.com/vi/aHQfHszuRBo/maxresdefault.jpg)](https://www.youtube.com/watch?v=aHQfHszuRBo)

> **Video-Walkthrough (1:22, Untertitel in 6 Sprachen):** [Auf YouTube ansehen](https://www.youtube.com/watch?v=aHQfHszuRBo)

## Highlights

- **5 unterstützte Assets über 13 Einzahlungsnetzwerke:** 4 Stablecoins (**USDT, USDC, USD1, DAI**) und 1 goldgedecktes Asset (**XAUT**) auf **TRC20, ERC20, BEP20, POLYGON, ARBITRUM, OPTIMISM, BASE, TON, AVAX, SOL, NEAR, SUI, PLASMA** (Auszahlungen unterstützen 11 Netzwerke — NEAR und Sui sind reine Einzahlungsnetzwerke — und sind in v1 dieses Nodes bewusst ausgeschlossen).
- **45 Fiat-Preiswährungen:** Erstellen Sie Rechnungen wahlweise in 45 Fiat-Währungen oder direkt in Krypto.
- **Reine Payment-API-Schlüsselgrenze:** Verbindet sich mit einem Paymos Payment-API-Schlüssel (`pk_live_` für Produktion oder `pk_test_` für Sandbox) und Secret Key (`sk_...`). Payout-Schlüssel (`rk_...`) werden noch vor dem Senden einer Anfrage abgelehnt; `Withdrawal`- und `Balance`-Operationen sind in v1 nicht enthalten.
- **Null externe npm-Runtime-Abhängigkeiten:** Alle HMAC-SHA256-Anfragesignaturen und `X-Webhook-Signature`-Prüfungen laufen über das integrierte `node:crypto` und n8ns `this.helpers.httpRequest`.
- **Bereit als AI-Agent-Tool (`usableAsTool: true`):** Hängen Sie den `Paymos`-Node direkt als Tool in n8n-AI-Agent-Workflows ein.
- **Alle 18 kanonischen Webhook-Events + `*`:** `Paymos Trigger` verifiziert `X-Webhook-Signature` gegen den exakten `rawBody` mittels zeitkonstantem Vergleich, unterstützt Multi-`v1=`-Secret-Rotation und ein Replay-Fenster von 300 Sekunden.

## Installation

### n8n Cloud & Self-Hosted (Community Nodes UI)

1. Öffnen Sie **Settings → Community Nodes** in Ihrer n8n-Instanz.
2. Wählen Sie **Install a community node**.
3. Geben Sie `n8n-nodes-paymos` ein und bestätigen Sie die Installation.

### Self-Hosted (Manuell / Docker)

```bash
npm install n8n-nodes-paymos
```

Um den `Paymos`-Node in Self-Hosted n8n als **AI-Agent-Tool** freizuschalten, setzen Sie:

```bash
N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true
```

## Schnellstart (3 Minuten)

1. **Kopieren Sie Ihre Project ID (`prj_...`)** aus **Paymos Dashboard → Projects → Details**.
2. **Kopieren Sie ein Payment-API-Schlüsselpaar (`pk_` + `sk_`)** aus **Paymos Dashboard → Developer → API Keys** (schalten Sie den **Test**-Schalter in der oberen Leiste für Sandbox `pk_test_...` / `sk_test_...` ein oder für Produktion `pk_live_...` / `sk_live_...` aus).
3. **Erstellen Sie eine `Paymos API`-Credential** in n8n und klicken Sie auf **Save** (oder **Retry / Test**), um die Verbindung zu prüfen.
4. **Fügen Sie einen `Paymos`-Node hinzu** (`Invoice` → `Create`) mit Ihrer `project_id`, `amount`, `currency` und einer eindeutigen `external_order_id` und senden Sie `={{ $json.payment_url }}` an Ihren Kunden.
5. **Fügen Sie einen `Paymos Trigger`-Workflow hinzu**, der auf `invoice.paid` und `invoice.paid_over` lauscht, registrieren Sie dessen **Production URL** unter **Paymos Dashboard → Developer → Webhooks**, tragen Sie das erzeugte `whsec_...` in Ihre **Paymos API**-Credential ein und erfüllen Sie Bestellungen über `={{ $json.data.invoice_id }}` und `={{ $json.data.order.external_id }}`.

## Zugangsdaten (`Paymos API`)

Erstellen Sie in n8n eine **Paymos API**-Credential mit den Schlüsseln aus **Paymos Dashboard → Developer → API Keys**:

| Feld | Erforderlich | Beschreibung |
| --- | --- | --- |
| **Public Key** | Ja | Payment-API-Schlüssel: `pk_live_...` (Produktion) oder `pk_test_...` (Sandbox). Payout-Schlüssel (`rk_...`) werden abgelehnt. |
| **Secret Key** | Ja | Vollständiges Payment-API-Secret (`sk_...`) für die HMAC-SHA256-Anfragesignierung. |
| **Webhook Signing Secret** | Nur Trigger | `whsec_...`-Secret aus **Dashboard → Developer → Webhooks**. Erforderlich beim Aktivieren von `Paymos Trigger`. |
| **API Base URL** | Ja | Standard `https://api.paymos.io` (bedient anhand des Schlüsselpräfixes sowohl Produktion als auch Sandbox). |

Ein Klick auf **Save** / **Test** führt eine signierte Prüfung `GET /v1/invoices?limit=1` gegen die Paymos Merchant API aus. Pflegen Sie idealerweise zwei Credentials — **Paymos Sandbox** (`pk_test_...`) und **Paymos Production** (`pk_live_...`) —, um End-to-End zu testen, bevor Sie auf Live-Traffic umschalten.

## Typische Workflows

- **Hosted-Checkout-Link bei neuen Bestellungen:** Trigger (Telegram / Webhook / Formular / CRM) → **Paymos** (`Invoice: Create`) → `={{ $json.payment_url }}` versenden und `={{ $json.invoice_id }}` speichern.
- **Automatische Bestellerfüllung:** **Paymos Trigger** (`invoice.paid`, `invoice.paid_over`) → anhand von `={{ $json.data.invoice_id }}` + `={{ $json.event_id }}` deduplizieren → Zugang freischalten oder den CRM-Deal über `={{ $json.data.order.external_id }}` als bezahlt markieren.
- **Dauerhafte Kunden-Einzahlungsadressen:** **Paymos** (`Payment Channel: Create` mit stabiler Kunden-`external_id`) → Guthaben bei `payment_channel.deposit.confirmed` gutschreiben oder zeitgesteuert über `Payment Channel Deposit: Get Many` mit gespeichertem `={{ $json.next_cursor }}` abgleichen.
- **Support-Rückerstattungen ohne Payout-Schlüssel:** Helpdesk-/CRM-Trigger → **Paymos** (`Refund: Create` mit `invoice_id`, `mode: full | overpayment`, `external_order_id`) → optional `withdrawal.completed` / `withdrawal.failed` über **Paymos Trigger** verfolgen.
- **KI-Agenten-Tool für Checkout & Support:** Hängen Sie **Paymos Tool** an einen n8n **AI Agent** an und weisen Sie ihn an, Ihre `project_id` zu übergeben, eine eindeutige `external_order_id` zu nutzen, `payment_url` zurückzugeben und vor einer Zahlungsbestätigung den Status mit `Invoice: Get` zu prüfen.

## Operationen (`Paymos`-Node — 18 Operationen)

### Invoice (6 Operationen)

- **Create** (`POST /v1/invoices`) — Erstellt eine Rechnung in einer von 45 Fiat-Währungen oder unterstützten Krypto-Assets mit idempotenter `external_order_id`, optionalen Feldern `network`, `customer_fee_percent`, `client_id` und optionalen Warenkorbpositionen (`products[]`).
- **Get** (`GET /v1/invoices/{id}`) — Ruft eine Rechnung per ID (`inv_...`) ab.
- **Get Many** (`GET /v1/invoices`) — Listet Rechnungen per Keyset-Cursor-Paginierung (`returnAll` oder `limit`) mit Filtern für `project_id`, `status`, `external_order_id`, `created_from` / `created_to` (Unix-Sekunden).
- **Confirm Payment** (`POST /v1/invoices/{id}/confirm-payment`) — Fixiert den Wechselkurs und weist einer Fiat-Rechnung eine Einzahlungsadresse zu (Host-to-Host-Checkout).
- **Cancel** (`POST /v1/invoices/{id}/cancel`) — Storniert eine Rechnung im Status `awaiting_client` mit Angabe eines Grundes.
- **Simulate Sandbox Payment** (`POST /v1/sandbox/invoices/{id}/simulate-payment`) — Nur Sandbox (`pk_test_` erforderlich; bei `pk_live_` bereits clientseitig abgelehnt). Versetzt eine Rechnung in `paid`, `overpaid`, `underpay`, `cancel` oder `paid_late`.

### Payment Channel (6 Operationen)

- **Create** (`POST /v1/payment-channels`) — Erstellt oder ruft idempotent eine dauerhafte Multi-Netzwerk-Einzahlungsidentität für einen Kunden ab (`project_id` + `external_id`).
- **Get** (`GET /v1/payment-channels/{id}`) — Ruft einen Payment Channel samt bereitgestellten Adressen und aktuellem `minimum_deposit` je Token ab.
- **Get Many** (`GET /v1/payment-channels`) — Listet Payment Channels per Keyset-Cursor-Paginierung (`returnAll` oder `limit`) mit Filtern für `project_id`, `status` und `external_id`.
- **Block** (`POST /v1/payment-channels/{id}/block`) — Stoppt die Zuordnung neuer Einzahlungen zu diesem Channel.
- **Unblock** (`POST /v1/payment-channels/{id}/unblock`) — Nimmt die Zuordnung von Einzahlungen wieder auf.
- **Simulate Sandbox Deposit** (`POST /v1/sandbox/payment-channels/{id}/simulate-deposit`) — Nur Sandbox (`pk_test_` erforderlich). Simuliert eine Einzahlung im Status `confirming`, `reorged` oder `confirmed`.

### Payment Channel Deposit (2 Operationen)

- **Get** (`GET /v1/payment-channel-deposits/{id}`) — Ruft eine einzelne Einzahlung (`pcd_...`) in beliebigem Status (`confirming`, `reorged`, `confirmed`) ab.
- **Get Many** (`GET /v1/payment-channel-deposits`) — Einseitiges Cursor-Polling des Feeds bestätigter Einzahlungen (`cursor`, `limit`, `project_id`, `payment_channel_id`, `confirmed_from`). Gibt stets `{ items, next_cursor, blocked? }` ohne `returnAll`-Schleife zurück, da `next_cursor` in einem fortlaufenden Feed niemals `null` ist — speichern Sie `next_cursor` in Ihrem Workflow-State und übergeben Sie ihn beim nächsten Durchlauf.

### Refund (4 Operationen)

- **Create** (`POST /v1/refunds`) — Erstellt eine serverseitig berechnete `full`- oder `overpayment`-Rückerstattung zurück an die erste gespeicherte Absenderadresse (`invoice_id`, `mode`, `external_order_id`).
- **Get** (`GET /v1/refunds/{id}`) — Ruft eine Rückerstattung anhand der Auszahlungs-ID (`wdr_...`) ab.
- **Get Many** (`GET /v1/refunds`) — Listet Rückerstattungen per Keyset-Cursor-Paginierung (`returnAll` oder `limit`) mit Filtern für `invoice_id`, `status`, `created_from` / `created_to` (RFC-3339-Zeitstempel).
- **Simulate Sandbox Refund** (`POST /v1/sandbox/refunds/{id}/simulate`) — Nur Sandbox (`pk_test_` erforderlich). Überführt eine Sandbox-Rückerstattung in `completed`, `failed` oder `cancelled`.

> **Hinweis zum v1-Funktionsumfang:** Ausgehende Auszahlungen (`Withdrawal`) und Guthabenabfragen (`Balance`) erfordern einen Payout-API-Schlüssel (`rk_...`) und sind in v1 von `n8n-nodes-paymos` nicht enthalten.

## Webhook-Trigger (`Paymos Trigger`)

1. Fügen Sie **Paymos Trigger** zu Ihrem Workflow hinzu und kopieren Sie dessen **Production URL** (nutzen Sie die **Test URL** nur während interaktiver Tests im Editor).
2. Legen Sie unter **Paymos Dashboard → Developer → Webhooks** einen HTTPS-Endpunkt mit dieser URL an und wählen Sie Ihre Kategorien (`Invoice`, `Payment channel`, `Withdrawal`).
3. Kopieren Sie das generierte Signatur-Secret `whsec_...` in das Feld **Webhook Signing Secret** Ihrer **Paymos API**-Credential in n8n.
4. Wählen Sie im Trigger-Node gezielte Events oder `*` (All Events) aus und aktivieren Sie den Workflow.

Unterstützte kanonische Events (insgesamt **18**):

- **Invoice (9):** `invoice.awaiting_payment`, `invoice.confirming`, `invoice.underpaid_waiting`, `invoice.paid`, `invoice.paid_over`, `invoice.underpaid`, `invoice.expired`, `invoice.cancelled`, `invoice.paid_late`
- **Payment Channel Deposit (3):** `payment_channel.deposit.confirming`, `payment_channel.deposit.reorged`, `payment_channel.deposit.confirmed`
- **Withdrawal (6):** `withdrawal.created`, `withdrawal.processing`, `withdrawal.completed`, `withdrawal.failed`, `withdrawal.cancelled`, `withdrawal.completion_rewound`

Zustellungen ohne `rawBody`, mit fehlgeschlagener HMAC-Prüfung oder außerhalb der 300-Sekunden-Zeitstempeltoleranz erhalten HTTP `401` und starten niemals den Workflow. Gültige Zustellungen für nicht ausgewählte Events antworten mit HTTP `200 { "received": true, "ignored": true }`, ohne den Workflow auszulösen.

## Fehlerbehebung

| Symptom / Fehler | Lösung |
| --- | --- |
| `Payout API keys (rk_) are not supported` | Verwenden Sie einen **Payment**-Schlüssel (`pk_live_` oder `pk_test_`) aus **Dashboard → Developer → API Keys**. |
| `Paymos API 401: Invalid API credential or signature` | Kopieren Sie das vollständige `sk_`-Secret erneut, prüfen Sie, ob der Schlüssel aktiv ist, und kontrollieren Sie die NTP-Zeitsynchronisation auf Self-Hosted n8n. |
| `Paymos Trigger requires a Webhook Signing Secret (whsec_...)` | Fügen Sie `whsec_...` aus **Dashboard → Developer → Webhooks** in **Paymos API** ein und aktivieren Sie den Workflow erneut. |
| Webhooks fehlen oder liefern `401` auf Self-Hosted n8n | Registrieren Sie die **Production URL** des Triggers, konfigurieren Sie eine öffentliche HTTPS-`N8N_WEBHOOK_URL` und leiten Sie den exakten Raw-Body ohne erneute JSON-Serialisierung durch. |
| `Sandbox simulation operations require a Sandbox Payment API key (pk_test_)` | Wechseln Sie auf eine Sandbox-Credential (`pk_test_`) oder entfernen Sie `Simulate Sandbox *`-Nodes vor dem Produktivbetrieb. |
| **Paymos** erscheint nicht unter AI-Agent-Tools (Self-Hosted) | Setzen Sie `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true` und starten Sie n8n neu. |

## Häufig gestellte Fragen

### Funktioniert `n8n-nodes-paymos` sowohl auf n8n Cloud als auch auf Self-Hosted n8n?
Ja. Das Paket kommt ohne externe npm-Runtime-Abhängigkeiten aus (`"dependencies": {}`), nutzt Nodes integriertes `node:crypto` für HMAC-SHA256-Signaturen und Raw-Body-Prüfung von `X-Webhook-Signature` und entspricht den Verified-Community-Node-Richtlinien von n8n. Self-Hosted-Instanzen installieren `n8n-nodes-paymos` über **Settings → Community Nodes** oder `npm install n8n-nodes-paymos`.

### Kann ich Paymos als Tool an einen n8n AI Agent anbinden?
Ja. Der `Paymos`-Node setzt `usableAsTool: true`, sodass n8n-AI-Agent-Workflows mit einem reinen Payment-Schlüssel (`pk_live_` oder `pk_test_`) Hosted-Checkout-Rechnungen erstellen, Zahlungsstatus abfragen, kundenbezogene Payment Channels bereitstellen und serverseitig berechnete Rückerstattungen anstoßen können. Auf Self-Hosted n8n setzen Sie dazu `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true`.

### Warum sind Payout-Schlüssel (`rk_`) und Auszahlungen in v1 ausgeschlossen?
Aus Sicherheitsgründen bleibt `n8n-nodes-paymos` strikt innerhalb der **Payment-API-Grenze** (`pk_live_` / `pk_test_`), damit Automatisierungen und KI-Agenten Stablecoin-/XAUT-Zahlungen annehmen und Rechnungsrückerstattungen bearbeiten können, ohne Treasury-Auszahlungsschlüssel (`rk_`) zu halten.

### Welche Assets, Netzwerke und Webhook-Events werden unterstützt?
Paymos unterstützt **5 Assets** (4 Stablecoins: **USDT, USDC, USD1, DAI** + goldgedecktes **XAUT**) in **13 Einzahlungsnetzwerken**, **45 Fiat-Preiswährungen** sowie alle **18 kanonischen Webhook-Events** (`invoice.*`, `payment_channel.deposit.*`, `withdrawal.*`), geprüft gegen `rawBody` mit einem Replay-Fenster von 300 Sekunden.

## Entwicklung

```bash
npm ci
npm test
npm run check
npm run lint
npm run build
```

## Dokumentation & Support

- [Paymos n8n-Integrationsleitfaden](https://paymos.io/de/docs/n8n)
- [Paymos Merchant API-Dokumentation](https://paymos.io/de/docs)
- [Webhooks-Referenz](https://paymos.io/de/docs/webhooks)
- [Issues](https://github.com/Paymos-labs/n8n-nodes-paymos/issues)

## Lizenz

[MIT](../LICENSE)
