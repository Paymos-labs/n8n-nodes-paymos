# n8n-nodes-paymos — официальный пакет узлов Paymos для n8n

[English](../README.md) | [简体中文](README.zh-CN.md) | **Русский** | [Español](README.es.md) | [Deutsch](README.de.md) | [Türkçe](README.tr.md)

Официальный пакет community-узлов n8n для [Paymos](https://paymos.io/ru): принимайте платежи в стейблкоинах (**USDT, USDC, USD1, DAI**) и токене с золотым обеспечением **XAUT** в **13 сетях**, управляйте персональными платёжными каналами клиентов и возвратами по счетам с расчётом суммы на сервере, а также запускайте сценарии по подписанным вебхукам Paymos.

Пакет рассчитан и на **n8n Cloud**, и на **Self-Hosted n8n** — без внешних runtime-зависимостей (`"dependencies": {}`), со встроенной подписью HMAC-SHA256 на `node:crypto`, проверкой сырого тела вебхуков и поддержкой AI Agent (`usableAsTool: true`).

[![Видео: быстрый старт с Paymos API за 10 минут — от песочницы до подписанных вебхуков](https://i.ytimg.com/vi/aHQfHszuRBo/maxresdefault.jpg)](https://www.youtube.com/watch?v=aHQfHszuRBo)

> **Видеообзор (1:22, субтитры на 6 языках):** [Смотреть на YouTube](https://www.youtube.com/watch?v=aHQfHszuRBo)

## Ключевые особенности

- **5 активов в 13 сетях для приёма:** 4 стейблкоина (**USDT, USDC, USD1, DAI**) и обеспеченный золотом токен (**XAUT**) в сетях **TRC20, ERC20, BEP20, POLYGON, ARBITRUM, OPTIMISM, BASE, TON, AVAX, SOL, NEAR, SUI, PLASMA** (выводы работают в 11 сетях — NEAR и Sui принимают только входящие переводы — и намеренно не включены в v1 этого пакета).
- **45 фиатных валют для расчёта цены:** выставляйте счета в любой из 45 фиатных валют или сразу в токене.
- **Только граница ключей приёма (Payment API):** подключение идёт по ключу приёма (`pk_live_` для рабочего режима или `pk_test_` для песочницы) и секрету (`sk_...`). Ключи выплат (`rk_...`) отклоняются ещё до отправки запроса; операции `Withdrawal` и `Balance` в v1 отсутствуют.
- **Ноль внешних npm-зависимостей в рантайме:** вся подпись запросов HMAC-SHA256 и проверка `X-Webhook-Signature` работают на встроенном `node:crypto` и штатном `this.helpers.httpRequest` в n8n.
- **Готов как инструмент для AI Agent (`usableAsTool: true`):** узел `Paymos` подключается напрямую к сценариям с n8n AI Agent.
- **Все 18 канонических событий вебхуков + `*`:** узел `Paymos Trigger` проверяет `X-Webhook-Signature` по точному `rawBody` со сравнением за постоянное время, поддерживает ротацию с несколькими `v1=` и окно защиты от повторов на 300 с.

## Установка

### n8n Cloud и Self-Hosted (через Community Nodes UI)

1. Откройте **Settings → Community Nodes** в своём экземпляре n8n.
2. Нажмите **Install a community node**.
3. Введите `n8n-nodes-paymos` и подтвердите установку.

### Self-Hosted (вручную / Docker)

```bash
npm install n8n-nodes-paymos
```

Чтобы разрешить использовать узел `Paymos` как инструмент **AI Agent** в self-hosted n8n, задайте переменную окружения:

```bash
N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true
```

## Быстрый старт (3 минуты)

1. **Скопируйте Project ID (`prj_...`)** в **Paymos Dashboard → Projects → Details**.
2. **Скопируйте пару ключей приёма (`pk_` + `sk_`)** в **Paymos Dashboard → Developer → API Keys** (переключите тумблер **Test** в верхней панели в положение «вкл» для песочницы `pk_test_...` / `sk_test_...` или «выкл» для рабочего режима `pk_live_...` / `sk_live_...`).
3. **Создайте учётные данные `Paymos API`** в n8n и нажмите **Save** (или **Retry / Test**), чтобы проверить подключение.
4. **Добавьте узел `Paymos`** (`Invoice` → `Create`) с вашим `project_id`, `amount`, `currency` и уникальным `external_order_id`, а затем отправьте клиенту `={{ $json.payment_url }}`.
5. **Добавьте сценарий с `Paymos Trigger`** на события `invoice.paid` и `invoice.paid_over`, зарегистрируйте его **Production URL** в **Paymos Dashboard → Developer → Webhooks**, вставьте полученный `whsec_...` в учётные данные **Paymos API** и закрывайте заказы по `={{ $json.data.invoice_id }}` и `={{ $json.data.order.external_id }}`.

## Учётные данные (`Paymos API`)

Создайте в n8n учётные данные **Paymos API** с ключами из **Paymos Dashboard → Developer → API Keys**:

| Поле | Обязательно | Описание |
| --- | --- | --- |
| **Public Key** | Да | Ключ приёма: `pk_live_...` (рабочий режим) или `pk_test_...` (песочница). Ключи выплат (`rk_...`) отклоняются. |
| **Secret Key** | Да | Полный секрет ключа приёма (`sk_...`) для подписи запросов по HMAC-SHA256. |
| **Webhook Signing Secret** | Только для Trigger | Секрет `whsec_...` из **Dashboard → Developer → Webhooks**. Обязателен при активации `Paymos Trigger`. |
| **API Base URL** | Да | По умолчанию `https://api.paymos.io` (обслуживает и рабочий режим, и песочницу по префиксу ключа). |

При нажатии **Save** / **Test** узел отправляет подписанный запрос `GET /v1/invoices?limit=1` к Paymos Merchant API. Держите две записи — **Paymos Sandbox** (`pk_test_...`) и **Paymos Production** (`pk_live_...`), чтобы сначала прогнать всё в песочнице, а потом переключиться на реальные платежи.

## Типовые сценарии

- **Ссылка на Hosted Checkout при новом заказе:** триггер (Telegram / Webhook / форма / CRM) → **Paymos** (`Invoice: Create`) → отправьте `={{ $json.payment_url }}` и сохраните `={{ $json.invoice_id }}`.
- **Автоматическая выдача заказа:** **Paymos Trigger** (`invoice.paid`, `invoice.paid_over`) → дедупликация по `={{ $json.data.invoice_id }}` + `={{ $json.event_id }}` → выдача доступа или отметка оплаты сделки в CRM по `={{ $json.data.order.external_id }}`.
- **Постоянные адреса пополнения для клиентов:** **Paymos** (`Payment Channel: Create` со стабильным `external_id` клиента) → зачисление баланса по `payment_channel.deposit.confirmed` или по расписанию через `Payment Channel Deposit: Get Many` с сохранением `={{ $json.next_cursor }}`.
- **Возвраты из поддержки без ключей выплат:** триггер из хелпдеска или CRM → **Paymos** (`Refund: Create` с `invoice_id`, `mode: full | overpayment`, `external_order_id`) → при необходимости отслеживайте `withdrawal.completed` / `withdrawal.failed` в **Paymos Trigger**.
- **Инструмент оплаты и поддержки для AI Agent:** подключите **Paymos Tool** к **AI Agent** в n8n и укажите в инструкции передавать ваш `project_id`, уникальный `external_order_id`, отдавать `payment_url` и проверять статус через `Invoice: Get` перед подтверждением оплаты.

## Операции (узел `Paymos` — 18 операций)

### Invoice (6 операций)

- **Create** (`POST /v1/invoices`) — создаёт счёт в любой из 45 фиатных валют или поддерживаемых токенах с идемпотентным `external_order_id`, опциональными `network`, `customer_fee_percent`, `client_id` и позициями заказа для страницы оплаты (`products[]`).
- **Get** (`GET /v1/invoices/{id}`) — получает счёт по идентификатору (`inv_...`).
- **Get Many** (`GET /v1/invoices`) — возвращает список счетов с курсорной пагинацией (`returnAll` или `limit`) и фильтрами `project_id`, `status`, `external_order_id`, `created_from` / `created_to` (Unix-секунды).
- **Confirm Payment** (`POST /v1/invoices/{id}/confirm-payment`) — фиксирует курс обмена и выделяет адрес пополнения для счёта в фиатной валюте (схема Host-to-Host).
- **Cancel** (`POST /v1/invoices/{id}/cancel`) — отменяет счёт в статусе `awaiting_client` с указанием причины.
- **Simulate Sandbox Payment** (`POST /v1/sandbox/invoices/{id}/simulate-payment`) — только для песочницы (нужен `pk_test_`; с `pk_live_` блокируется на стороне клиента). Переводит счёт в `paid`, `overpaid`, `underpay`, `cancel` или `paid_late`.

### Payment Channel (6 операций)

- **Create** (`POST /v1/payment-channels`) — идемпотентно создаёт или возвращает постоянный мультивалютный профиль адресов пополнения клиента (`project_id` + `external_id`).
- **Get** (`GET /v1/payment-channels/{id}`) — возвращает платёжный канал с выделенными адресами и актуальным `minimum_deposit` по каждому токену.
- **Get Many** (`GET /v1/payment-channels`) — возвращает список каналов с курсорной пагинацией (`returnAll` или `limit`) и фильтрами `project_id`, `status`, `external_id`.
- **Block** (`POST /v1/payment-channels/{id}/block`) — останавливает привязку новых пополнений к каналу.
- **Unblock** (`POST /v1/payment-channels/{id}/unblock`) — возобновляет привязку пополнений к каналу.
- **Simulate Sandbox Deposit** (`POST /v1/sandbox/payment-channels/{id}/simulate-deposit`) — только для песочницы (нужен `pk_test_`). Симулирует пополнение `confirming`, `reorged` или `confirmed` на канале.

### Payment Channel Deposit (2 операции)

- **Get** (`GET /v1/payment-channel-deposits/{id}`) — возвращает одно пополнение (`pcd_...`) в любом статусе (`confirming`, `reorged`, `confirmed`).
- **Get Many** (`GET /v1/payment-channel-deposits`) — одностраничный опрос ленты подтверждённых пополнений по курсору (`cursor`, `limit`, `project_id`, `payment_channel_id`, `confirmed_from`). Всегда возвращает `{ items, next_cursor, blocked? }` без цикла `returnAll`, потому что в бесконечной ленте `next_cursor` никогда не равен `null` — сохраняйте `next_cursor` в состоянии сценария и передавайте его в следующий опрос.

### Refund (4 операции)

- **Create** (`POST /v1/refunds`) — создаёт возврат по счёту (`full` или `overpayment`), рассчитанный на сервере, обратно на первый сохранённый адрес отправителя (`invoice_id`, `mode`, `external_order_id`).
- **Get** (`GET /v1/refunds/{id}`) — возвращает возврат по идентификатору вывода (`wdr_...`).
- **Get Many** (`GET /v1/refunds`) — возвращает список возвратов с курсорной пагинацией (`returnAll` или `limit`) и фильтрами `invoice_id`, `status`, `created_from` / `created_to` (метки времени RFC 3339).
- **Simulate Sandbox Refund** (`POST /v1/sandbox/refunds/{id}/simulate`) — только для песочницы (нужен `pk_test_`). Переводит тестовый возврат в `completed`, `failed` или `cancelled`.

> **Ограничение v1:** исходящие выводы (`Withdrawal`) и чтение балансов (`Balance`) требуют ключ выплат (`rk_...`) и не входят в v1 пакета `n8n-nodes-paymos`.

## Триггер вебхуков (`Paymos Trigger`)

1. Добавьте **Paymos Trigger** в сценарий и скопируйте его **Production URL** (используйте **Test URL** только во время интерактивной отладки в редакторе).
2. В **Paymos Dashboard → Developer → Webhooks** создайте HTTPS-эндпоинт с этим адресом и отметьте нужные категории (`Invoice`, `Payment channel`, `Withdrawal`).
3. Скопируйте сгенерированный секрет подписи `whsec_...` в поле **Webhook Signing Secret** ваших учётных данных **Paymos API** в n8n.
4. Выберите конкретные события или `*` (All Events) в узле триггера и активируйте сценарий.

Поддерживаемые канонические события (всего **18**):

- **Invoice (9):** `invoice.awaiting_payment`, `invoice.confirming`, `invoice.underpaid_waiting`, `invoice.paid`, `invoice.paid_over`, `invoice.underpaid`, `invoice.expired`, `invoice.cancelled`, `invoice.paid_late`
- **Payment Channel Deposit (3):** `payment_channel.deposit.confirming`, `payment_channel.deposit.reorged`, `payment_channel.deposit.confirmed`
- **Withdrawal (6):** `withdrawal.created`, `withdrawal.processing`, `withdrawal.completed`, `withdrawal.failed`, `withdrawal.cancelled`, `withdrawal.completion_rewound`

Запросы без `rawBody`, с неверной HMAC-подписью или за пределами допуска в 300 с получают HTTP `401` и не запускают сценарий. Корректные запросы по невыбранным событиям получают HTTP `200 { "received": true, "ignored": true }` без запуска сценария.

## Решение проблем

| Симптом или ошибка | Как исправить |
| --- | --- |
| `Payout API keys (rk_) are not supported` | Возьмите ключ **приёма** (`pk_live_` или `pk_test_`) в **Dashboard → Developer → API Keys**. |
| `Paymos API 401: Invalid API credential or signature` | Скопируйте заново полный секрет `sk_`, проверьте активность ключа и синхронизацию часов по NTP на Self-Hosted n8n. |
| `Paymos Trigger requires a Webhook Signing Secret (whsec_...)` | Вставьте `whsec_...` из **Dashboard → Developer → Webhooks** в **Paymos API** и заново активируйте сценарий. |
| Вебхуки не приходят или отдают `401` на Self-Hosted n8n | Зарегистрируйте **Production URL** триггера, настройте публичный HTTPS `N8N_WEBHOOK_URL` и проксируйте точное сырое тело запроса без повторной сериализации JSON. |
| `Sandbox simulation operations require a Sandbox Payment API key (pk_test_)` | Переключитесь на тестовые ключи `pk_test_` или удалите узлы `Simulate Sandbox *` перед переходом на реальные платежи. |
| Узел **Paymos** не виден среди инструментов AI Agent (Self-Hosted) | Задайте `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true` и перезапустите n8n. |

## Частые вопросы

### Работает ли `n8n-nodes-paymos` на n8n Cloud и Self-Hosted n8n?
Да. У пакета ноль внешних runtime-зависимостей в npm (`"dependencies": {}`), подпись HMAC-SHA256 и проверка `X-Webhook-Signature` по сырому телу работают на встроенном `node:crypto`, а сам пакет соответствует требованиям n8n Verified Community Node. На self-hosted сервере `n8n-nodes-paymos` ставится через **Settings → Community Nodes** или командой `npm install n8n-nodes-paymos`.

### Можно ли подключить Paymos как инструмент к n8n AI Agent?
Да. Узел `Paymos` выставляет `usableAsTool: true`, поэтому сценарии с n8n AI Agent могут создавать счета Hosted Checkout, проверять статус оплаты, заводить персональные платёжные каналы клиентов и оформлять серверные возвраты по счетам, используя только ключ приёма (`pk_live_` или `pk_test_`). На self-hosted n8n задайте `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true`.

### Почему ключи выплат (`rk_`) и выводы исключены из v1?
По замыслу `n8n-nodes-paymos` строго остаётся внутри **границы Payment API** (`pk_live_` / `pk_test_`), чтобы автоматизации и AI-агенты принимали платежи в стейблкоинах и XAUT и делали возвраты по счетам без доступа к ключам вывода средств (`rk_`).

### Какие активы, сети и события вебхуков поддерживаются?
Paymos поддерживает **5 активов** (4 стейблкоина: **USDT, USDC, USD1, DAI** + обеспеченный золотом **XAUT**) в **13 сетях для приёма**, **45 фиатных валют** для указания цены и все **18 канонических событий вебхуков** (`invoice.*`, `payment_channel.deposit.*`, `withdrawal.*`) с проверкой по `rawBody` и окном защиты от повторов 300 с.

## Разработка

```bash
npm ci
npm test
npm run check
npm run lint
npm run build
```

## Документация и поддержка

- [Руководство по интеграции Paymos с n8n](https://paymos.io/ru/docs/n8n)
- [Документация Paymos Merchant API](https://paymos.io/ru/docs)
- [Справочник по вебхукам](https://paymos.io/ru/docs/webhooks)
- [Issues на GitHub](https://github.com/Paymos-labs/n8n-nodes-paymos/issues)

## Лицензия

[MIT](../LICENSE)
