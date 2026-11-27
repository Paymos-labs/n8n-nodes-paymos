# n8n-nodes-paymos — Paquete oficial de nodos comunitarios de Paymos para n8n

[English](../README.md) | [简体中文](README.zh-CN.md) | [Русский](README.ru.md) | **Español** | [Deutsch](README.de.md) | [Türkçe](README.tr.md)

Paquete oficial de nodos comunitarios de n8n para [Paymos](https://paymos.io/es): acepta pagos en stablecoins (**USDT, USDC, USD1, DAI**) y en **XAUT** respaldado por oro en **13 redes**, gestiona canales de pago por cliente y reembolsos de facturas calculados en el servidor, y dispara flujos de trabajo con webhooks verificados de Paymos.

Diseñado tanto para **n8n Cloud** como para **n8n autoalojado** con **cero dependencias en tiempo de ejecución** (`"dependencies": {}`), firma HMAC-SHA256 integrada mediante `node:crypto`, verificación de webhooks sobre el cuerpo sin procesar y compatibilidad con AI Agent (`usableAsTool: true`).

[![Ver vídeo: Inicio rápido de la API de Paymos en 10 minutos — Del Sandbox a los webhooks firmados](https://i.ytimg.com/vi/aHQfHszuRBo/maxresdefault.jpg)](https://www.youtube.com/watch?v=aHQfHszuRBo)

> **Recorrido en vídeo (1:22, subtítulos en 6 idiomas):** [Ver en YouTube](https://www.youtube.com/watch?v=aHQfHszuRBo)

## Aspectos destacados

- **5 activos admitidos en 13 redes de depósito:** 4 stablecoins (**USDT, USDC, USD1, DAI**) y 1 activo respaldado por oro (**XAUT**) en **TRC20, ERC20, BEP20, POLYGON, ARBITRUM, OPTIMISM, BASE, TON, AVAX, SOL, NEAR, SUI, PLASMA** (los retiros admiten 11 redes — NEAR y Sui son solo de depósito — y se excluyen intencionadamente de la v1 de este nodo).
- **45 divisas fiduciarias de fijación de precios:** crea facturas denominadas en 45 divisas fiduciarias o directamente en cripto.
- **Frontera de clave API exclusiva para cobros (Payment-only):** se conecta con una clave Payment API de Paymos (`pk_live_` para Producción o `pk_test_` para Sandbox) y su clave secreta (`sk_...`). Las claves de desembolso (`rk_...`) se rechazan antes de enviar cualquier solicitud; las operaciones `Withdrawal` y `Balance` no están incluidas en la v1.
- **Cero dependencias npm en tiempo de ejecución:** toda la firma de solicitudes HMAC-SHA256 y la verificación de `X-Webhook-Signature` se ejecutan sobre el módulo nativo `node:crypto` y `this.helpers.httpRequest` de n8n.
- **Listo como herramienta de AI Agent (`usableAsTool: true`):** adjunta el nodo `Paymos` directamente como herramienta a flujos con n8n AI Agent.
- **Los 18 eventos canónicos de webhook + `*`:** `Paymos Trigger` verifica `X-Webhook-Signature` frente al `rawBody` exacto con comparación en tiempo constante, rotación de secretos con múltiples `v1=` y una ventana anti-repetición de 300 segundos.

## Instalación

### n8n Cloud y autoalojado (interfaz de Community Nodes)

1. Abre **Settings → Community Nodes** en tu instancia de n8n.
2. Selecciona **Install a community node**.
3. Introduce `n8n-nodes-paymos` y confirma la instalación.

### Autoalojado (manual / Docker)

```bash
npm install n8n-nodes-paymos
```

Para permitir que el nodo `Paymos` se utilice como herramienta de **AI Agent** en n8n autoalojado, configura:

```bash
N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true
```

## Inicio rápido (3 minutos)

1. **Copia tu Project ID (`prj_...`)** en **Paymos Dashboard → Projects → Details**.
2. **Copia un par de claves Payment API (`pk_` + `sk_`)** en **Paymos Dashboard → Developer → API Keys** (activa el interruptor **Test** en la barra superior para Sandbox `pk_test_...` / `sk_test_...`, o desactívalo para Producción `pk_live_...` / `sk_live_...`).
3. **Crea una credencial `Paymos API`** en n8n y haz clic en **Save** (o **Retry / Test**) para comprobar la conectividad.
4. **Añade un nodo `Paymos`** (`Invoice` → `Create`) con tu `project_id`, `amount`, `currency` y un `external_order_id` único; después envía `={{ $json.payment_url }}` a tu cliente.
5. **Añade un flujo `Paymos Trigger`** escuchando `invoice.paid` e `invoice.paid_over`, registra su **Production URL** en **Paymos Dashboard → Developer → Webhooks**, pega el `whsec_...` resultante en tu credencial **Paymos API** y procesa los pedidos usando `={{ $json.data.invoice_id }}` y `={{ $json.data.order.external_id }}`.

## Credenciales (`Paymos API`)

Crea una credencial **Paymos API** en n8n utilizando las claves de **Paymos Dashboard → Developer → API Keys**:

| Campo | Obligatorio | Descripción |
| --- | --- | --- |
| **Public Key** | Sí | Clave Payment API: `pk_live_...` (Producción) o `pk_test_...` (Sandbox). Las claves de desembolso (`rk_...`) se rechazan. |
| **Secret Key** | Sí | Secreto completo de la Payment API (`sk_...`) empleado para firmar solicitudes con HMAC-SHA256. |
| **Webhook Signing Secret** | Solo Trigger | Secreto `whsec_...` de **Dashboard → Developer → Webhooks**. Requerido al activar `Paymos Trigger`. |
| **API Base URL** | Sí | Predeterminado `https://api.paymos.io` (atiende Producción y Sandbox según el prefijo de tu clave). |

Al pulsar **Save** / **Test** se ejecuta una comprobación firmada `GET /v1/invoices?limit=1` contra la Paymos Merchant API. Mantén dos credenciales — **Paymos Sandbox** (`pk_test_...`) y **Paymos Production** (`pk_live_...`) — para probar de extremo a extremo antes de pasar a tráfico real.

## Flujos habituales

- **Enlace de Hosted Checkout en nuevos pedidos:** disparador (Telegram / Webhook / Formulario / CRM) → **Paymos** (`Invoice: Create`) → enviar `={{ $json.payment_url }}` y guardar `={{ $json.invoice_id }}`.
- **Entrega automática de pedidos:** **Paymos Trigger** (`invoice.paid`, `invoice.paid_over`) → deduplicar por `={{ $json.data.invoice_id }}` + `={{ $json.event_id }}` → conceder acceso o marcar el trato del CRM como pagado usando `={{ $json.data.order.external_id }}`.
- **Direcciones permanentes de depósito por cliente:** **Paymos** (`Payment Channel: Create` con un `external_id` estable de cliente) → acreditar saldos en `payment_channel.deposit.confirmed` o mediante `Payment Channel Deposit: Get Many` programado guardando `={{ $json.next_cursor }}`.
- **Reembolsos de soporte sin claves de desembolso:** disparador de helpdesk/CRM → **Paymos** (`Refund: Create` con `invoice_id`, `mode: full | overpayment`, `external_order_id`) → opcionalmente escuchar `withdrawal.completed` / `withdrawal.failed` en **Paymos Trigger**.
- **Herramienta de checkout y soporte para AI Agent:** adjunta **Paymos Tool** a un **AI Agent** de n8n e indícale que envíe tu `project_id`, use un `external_order_id` único, devuelva `payment_url` y verifique el estado con `Invoice: Get` antes de confirmar el pago.

## Operaciones (nodo `Paymos` — 18 operaciones)

### Invoice (6 operaciones)

- **Create** (`POST /v1/invoices`) — Crea una factura en cualquiera de las 45 divisas fiduciarias o activos cripto admitidos, con `external_order_id` idempotente, `network`, `customer_fee_percent`, `client_id` opcionales y líneas de producto opcionales para el checkout (`products[]`).
- **Get** (`GET /v1/invoices/{id}`) — Obtiene una factura por su ID (`inv_...`).
- **Get Many** (`GET /v1/invoices`) — Lista facturas con paginación por cursor (`returnAll` o `limit`), filtrando por `project_id`, `status`, `external_order_id`, `created_from` / `created_to` (segundos Unix).
- **Confirm Payment** (`POST /v1/invoices/{id}/confirm-payment`) — Bloquea el tipo de cambio y asigna una dirección de depósito para una factura en divisa fiduciaria (checkout Host-to-Host).
- **Cancel** (`POST /v1/invoices/{id}/cancel`) — Cancela una factura aún en estado `awaiting_client` indicando un motivo.
- **Simulate Sandbox Payment** (`POST /v1/sandbox/invoices/{id}/simulate-payment`) — Solo Sandbox (requiere `pk_test_`; rechazado en el cliente para `pk_live_`). Lleva la factura a `paid`, `overpaid`, `underpay`, `cancel` o `paid_late`.

### Payment Channel (6 operaciones)

- **Create** (`POST /v1/payment-channels`) — Crea o recupera de forma idempotente una identidad de depósito permanente multired para un cliente (`project_id` + `external_id`).
- **Get** (`GET /v1/payment-channels/{id}`) — Obtiene un canal de pago con sus direcciones aprovisionadas y el `minimum_deposit` vigente por token.
- **Get Many** (`GET /v1/payment-channels`) — Lista canales de pago con paginación por cursor (`returnAll` o `limit`), filtrando por `project_id`, `status` y `external_id`.
- **Block** (`POST /v1/payment-channels/{id}/block`) — Detiene la atribución de nuevos depósitos a un canal.
- **Unblock** (`POST /v1/payment-channels/{id}/unblock`) — Reanuda la atribución de depósitos a un canal.
- **Simulate Sandbox Deposit** (`POST /v1/sandbox/payment-channels/{id}/simulate-deposit`) — Solo Sandbox (requiere `pk_test_`). Simula un depósito `confirming`, `reorged` o `confirmed` en un canal.

### Payment Channel Deposit (2 operaciones)

- **Get** (`GET /v1/payment-channel-deposits/{id}`) — Obtiene un depósito individual (`pcd_...`) en cualquier estado (`confirming`, `reorged`, `confirmed`).
- **Get Many** (`GET /v1/payment-channel-deposits`) — Sondeo por cursor de una sola página del feed de depósitos confirmados (`cursor`, `limit`, `project_id`, `payment_channel_id`, `confirmed_from`). Siempre devuelve `{ items, next_cursor, blocked? }` sin bucle `returnAll`, ya que `next_cursor` nunca es `null` en un feed continuo: guarda `next_cursor` en el estado de tu flujo y pásalo al siguiente sondeo.

### Refund (4 operaciones)

- **Create** (`POST /v1/refunds`) — Crea un reembolso de factura `full` u `overpayment` calculado en el servidor hacia el primer remitente registrado (`invoice_id`, `mode`, `external_order_id`).
- **Get** (`GET /v1/refunds/{id}`) — Obtiene un reembolso por ID de retiro (`wdr_...`).
- **Get Many** (`GET /v1/refunds`) — Lista reembolsos con paginación por cursor (`returnAll` o `limit`), filtrando por `invoice_id`, `status`, `created_from` / `created_to` (marcas de tiempo RFC 3339).
- **Simulate Sandbox Refund** (`POST /v1/sandbox/refunds/{id}/simulate`) — Solo Sandbox (requiere `pk_test_`). Lleva un reembolso de sandbox a `completed`, `failed` o `cancelled`.

> **Nota sobre el alcance v1:** Los retiros salientes (`Withdrawal`) y la consulta de saldos (`Balance`) requieren una clave Payout API (`rk_...`) y no se exponen en la v1 de `n8n-nodes-paymos`.

## Disparador de Webhooks (`Paymos Trigger`)

1. Añade **Paymos Trigger** a tu flujo y copia su **Production URL** (usa **Test URL** únicamente durante pruebas interactivas en el editor).
2. En **Paymos Dashboard → Developer → Webhooks**, crea un endpoint HTTPS con esa URL y selecciona tus categorías (`Invoice`, `Payment channel`, `Withdrawal`).
3. Copia el secreto de firma `whsec_...` generado en el campo **Webhook Signing Secret** de tu credencial **Paymos API** en n8n.
4. Selecciona eventos específicos o `*` (All Events) en el nodo disparador y activa el flujo.

Eventos canónicos admitidos (**18** en total):

- **Invoice (9):** `invoice.awaiting_payment`, `invoice.confirming`, `invoice.underpaid_waiting`, `invoice.paid`, `invoice.paid_over`, `invoice.underpaid`, `invoice.expired`, `invoice.cancelled`, `invoice.paid_late`
- **Payment Channel Deposit (3):** `payment_channel.deposit.confirming`, `payment_channel.deposit.reorged`, `payment_channel.deposit.confirmed`
- **Withdrawal (6):** `withdrawal.created`, `withdrawal.processing`, `withdrawal.completed`, `withdrawal.failed`, `withdrawal.cancelled`, `withdrawal.completion_rewound`

Las entregas sin `rawBody`, que fallen la verificación HMAC o que superen la tolerancia de 300 segundos reciben HTTP `401` y nunca inician el flujo. Las entregas válidas para eventos no seleccionados devuelven HTTP `200 { "received": true, "ignored": true }` sin disparar el flujo.

## Solución de problemas

| Síntoma / error | Solución |
| --- | --- |
| `Payout API keys (rk_) are not supported` | Usa una clave **Payment** (`pk_live_` o `pk_test_`) desde **Dashboard → Developer → API Keys**. |
| `Paymos API 401: Invalid API credential or signature` | Vuelve a copiar el secreto `sk_` completo, confirma que la clave esté activa y verifica la sincronización NTP del reloj en n8n autoalojado. |
| `Paymos Trigger requires a Webhook Signing Secret (whsec_...)` | Pega `whsec_...` de **Dashboard → Developer → Webhooks** en **Paymos API** y vuelve a activar el flujo. |
| Webhooks faltantes o `401` en n8n autoalojado | Registra la **Production URL** del disparador, configura un `N8N_WEBHOOK_URL` público sobre HTTPS y reenvía el cuerpo sin procesar exacto sin volver a serializar el JSON. |
| `Sandbox simulation operations require a Sandbox Payment API key (pk_test_)` | Cambia a una credencial Sandbox `pk_test_` o elimina los nodos `Simulate Sandbox *` antes de salir a producción. |
| **Paymos** no aparece en las herramientas de AI Agent (autoalojado) | Define `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true` y reinicia n8n. |

## Preguntas frecuentes

### ¿Funciona `n8n-nodes-paymos` tanto en n8n Cloud como en n8n autoalojado?
Sí. El paquete se distribuye con cero dependencias npm externas en tiempo de ejecución (`"dependencies": {}`), usa el módulo nativo `node:crypto` para firmar con HMAC-SHA256 y verificar `X-Webhook-Signature` sobre el cuerpo sin procesar, y cumple las directrices de Verified Community Node de n8n. Las instancias autoalojadas pueden instalar `n8n-nodes-paymos` desde **Settings → Community Nodes** o con `npm install n8n-nodes-paymos`.

### ¿Puedo añadir Paymos como herramienta a un AI Agent de n8n?
Sí. El nodo `Paymos` establece `usableAsTool: true` para que los flujos con n8n AI Agent puedan crear facturas de Hosted Checkout, consultar el estado de los pagos, aprovisionar canales de pago por cliente y emitir reembolsos calculados en el servidor usando únicamente una clave Payment (`pk_live_` o `pk_test_`). En n8n autoalojado, configura `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true`.

### ¿Por qué las claves de desembolso (`rk_`) y los retiros quedan fuera de la v1?
Por diseño, `n8n-nodes-paymos` se mantiene estrictamente dentro de la **frontera de la Payment API** (`pk_live_` / `pk_test_`) para que las automatizaciones y los AI Agents puedan cobrar en stablecoins/XAUT y tramitar reembolsos de facturas sin poseer credenciales de retiro de tesorería (`rk_`).

### ¿Qué activos, redes y eventos de webhook son compatibles?
Paymos admite **5 activos** (4 stablecoins: **USDT, USDC, USD1, DAI** + **XAUT** respaldado por oro) en **13 redes de depósito**, **45 divisas fiduciarias** y los **18 eventos canónicos de webhook** (`invoice.*`, `payment_channel.deposit.*`, `withdrawal.*`) verificados contra `rawBody` con una ventana anti-repetición de 300 segundos.

## Desarrollo

```bash
npm ci
npm test
npm run check
npm run lint
npm run build
```

## Documentación y soporte

- [Guía de integración de Paymos con n8n](https://paymos.io/es/docs/n8n)
- [Documentación de Paymos Merchant API](https://paymos.io/es/docs)
- [Referencia de Webhooks](https://paymos.io/es/docs/webhooks)
- [Incidencias (Issues)](https://github.com/Paymos-labs/n8n-nodes-paymos/issues)

## Licencia

[MIT](../LICENSE)
