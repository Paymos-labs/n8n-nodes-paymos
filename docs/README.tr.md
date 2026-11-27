# n8n-nodes-paymos — Resmi Paymos n8n Topluluk Düğümü Paketi

[English](../README.md) | [简体中文](README.zh-CN.md) | [Русский](README.ru.md) | [Español](README.es.md) | [Deutsch](README.de.md) | **Türkçe**

[Paymos](https://paymos.io/tr) için resmi n8n topluluk düğümü paketi — **13 ağ** üzerinden sabit coin (**USDT, USDC, USD1, DAI**) ve altın destekli **XAUT** ödemeleri kabul edin, müşteri bazlı Ödeme Kanallarını ve sunucu taraflı hesaplanan fatura iadelerini yönetin ve doğrulanmış Paymos webhook'larıyla iş akışlarını tetikleyin.

Hem **n8n Cloud** hem de **Self-Hosted n8n** için **sıfır çalışma zamanı bağımlılığı** (`"dependencies": {}`), yerleşik `node:crypto` HMAC-SHA256 imzalama, ham gövde webhook doğrulaması ve AI Agent desteği (`usableAsTool: true`) ile tasarlanmıştır.

[![İzle: 10 Dakikada Paymos API Hızlı Başlangıç — Sandbox'tan İmzalı Webhook'lara](https://i.ytimg.com/vi/aHQfHszuRBo/maxresdefault.jpg)](https://www.youtube.com/watch?v=aHQfHszuRBo)

> **Video anlatım (1:22, 6 dilde altyazılı):** [YouTube'da izle](https://www.youtube.com/watch?v=aHQfHszuRBo)

## Öne Çıkanlar

- **13 yatırma ağında 5 desteklenen varlık:** **TRC20, ERC20, BEP20, POLYGON, ARBITRUM, OPTIMISM, BASE, TON, AVAX, SOL, NEAR, SUI, PLASMA** üzerinde 4 sabit coin (**USDT, USDC, USD1, DAI**) ve 1 altın destekli varlık (**XAUT**) (çekimler 11 ağı destekler — NEAR ve Sui yalnızca yatırma içindir — ve bu düğümün v1 sürümünde bilinçli olarak kapsam dışındadır).
- **45 itibari fiyatlandırma para birimi:** 45 itibari para birimi veya doğrudan kripto cinsinden fatura oluşturun.
- **Yalnızca Ödeme (Payment-only) API anahtarı sınırı:** Paymos Ödeme API anahtarı (Üretim için `pk_live_` veya Sandbox için `pk_test_`) ve Gizli Anahtar (`sk_...`) ile bağlanır. Ödeme çıkışı anahtarları (`rk_...`) herhangi bir istek gönderilmeden reddedilir; `Withdrawal` ve `Balance` işlemleri v1'de yer almaz.
- **Sıfır çalışma zamanı npm bağımlılığı:** Tüm HMAC-SHA256 istek imzaları ve `X-Webhook-Signature` kontrolleri yerleşik `node:crypto` ve n8n'in `this.helpers.httpRequest` yardımcısı üzerinde çalışır.
- **AI Agent Aracı olarak hazır (`usableAsTool: true`):** `Paymos` düğümünü doğrudan n8n AI Agent iş akışlarına araç olarak ekleyin.
- **18 kanonik webhook olayının tamamı + `*`:** `Paymos Trigger`, `X-Webhook-Signature` başlığını kesin `rawBody` üzerinde sabit zamanlı karşılaştırma, çoklu `v1=` gizli anahtar rotasyonu ve 300 saniyelik yeniden oynatma (*replay*) penceresiyle doğrular.

## Kurulum

### n8n Cloud ve Self-Hosted (Community Nodes Arayüzü)

1. n8n örneğinizde **Settings → Community Nodes** menüsünü açın.
2. **Install a community node** seçeneğini seçin.
3. `n8n-nodes-paymos` yazın ve kurulumu onaylayın.

### Self-Hosted (Manuel / Docker)

```bash
npm install n8n-nodes-paymos
```

Self-hosted n8n üzerinde `Paymos` düğümünün bir **AI Agent aracı** olarak kullanılabilmesi için şunu ayarlayın:

```bash
N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true
```

## Hızlı Başlangıç (3 dakika)

1. **Paymos Dashboard → Projects → Details** sayfasından **Project ID (`prj_...`)** değerinizi kopyalayın.
2. **Paymos Dashboard → Developer → API Keys** sayfasından bir **Ödeme API anahtar çifti (`pk_` + `sk_`)** kopyalayın (Sandbox `pk_test_...` / `sk_test_...` için üst çubuktaki **Test** anahtarını açın; Üretim `pk_live_...` / `sk_live_...` için kapatın).
3. n8n'de bir **`Paymos API` kimlik bilgisi** oluşturun ve bağlantıyı doğrulamak için **Save** (veya **Retry / Test**) düğmesine tıklayın.
4. `project_id`, `amount`, `currency` ve benzersiz bir `external_order_id` ile bir **`Paymos` düğümü** (`Invoice` → `Create`) ekleyin, ardından `={{ $json.payment_url }}` bağlantısını müşterinize gönderin.
5. `invoice.paid` ve `invoice.paid_over` olaylarını dinleyen bir **`Paymos Trigger` iş akışı** ekleyin, **Production URL** adresini **Paymos Dashboard → Developer → Webhooks** altında kaydedin, oluşan `whsec_...` değerini **Paymos API** kimlik bilginize yapıştırın ve siparişleri `={{ $json.data.invoice_id }}` ile `={{ $json.data.order.external_id }}` üzerinden tamamlayın.

## Kimlik Bilgileri (`Paymos API`)

**Paymos Dashboard → Developer → API Keys** bölümündeki anahtarları kullanarak n8n'de bir **Paymos API** kimlik bilgisi oluşturun:

| Alan | Zorunlu | Açıklama |
| --- | --- | --- |
| **Public Key** | Evet | Ödeme API anahtarı: `pk_live_...` (Üretim) veya `pk_test_...` (Sandbox). Ödeme çıkışı anahtarları (`rk_...`) reddedilir. |
| **Secret Key** | Evet | HMAC-SHA256 istek imzalama için kullanılan tam Ödeme API gizli anahtarı (`sk_...`). |
| **Webhook Signing Secret** | Yalnızca Trigger | **Dashboard → Developer → Webhooks** bölümünden alınan `whsec_...` gizli anahtarı. `Paymos Trigger` etkinleştirilirken zorunludur. |
| **API Base URL** | Evet | Varsayılan `https://api.paymos.io` (anahtar önekine göre hem Üretim hem de Sandbox ortamına hizmet verir). |

**Save** / **Test** düğmesine tıklamak Paymos Merchant API'ye imzalı bir `GET /v1/invoices?limit=1` kontrolü gönderir. Canlı trafiğe geçmeden önce uçtan uca test yapabilmek için **Paymos Sandbox** (`pk_test_...`) ve **Paymos Production** (`pk_live_...`) olmak üzere iki ayrı kimlik bilgisi tutun.

## Yaygın İş Akışları

- **Yeni siparişlerde Hosted Checkout bağlantısı:** Tetikleyici (Telegram / Webhook / Form / CRM) → **Paymos** (`Invoice: Create`) → `={{ $json.payment_url }}` gönderin ve `={{ $json.invoice_id }}` kaydedin.
- **Otomatik sipariş teslimi:** **Paymos Trigger** (`invoice.paid`, `invoice.paid_over`) → `={{ $json.data.invoice_id }}` + `={{ $json.event_id }}` üzerinden tekilleştirin → `={{ $json.data.order.external_id }}` ile erişim tanımlayın veya CRM fırsatını ödendi olarak işaretleyin.
- **Kalıcı müşteri yatırma adresleri:** **Paymos** (sabit müşteri `external_id` ile `Payment Channel: Create`) → `payment_channel.deposit.confirmed` ile bakiye ekleyin veya `={{ $json.next_cursor }}` değerini saklayarak zamanlanmış `Payment Channel Deposit: Get Many` çalıştırın.
- **Ödeme çıkışı anahtarı olmadan destek iadeleri:** Destek/CRM tetikleyicisi → **Paymos** (`invoice_id`, `mode: full | overpayment`, `external_order_id` ile `Refund: Create`) → isteğe bağlı olarak **Paymos Trigger** içinde `withdrawal.completed` / `withdrawal.failed` olaylarını dinleyin.
- **AI Agent ödeme ve destek aracı:** **Paymos Tool**'u bir n8n **AI Agent**'a bağlayın ve `project_id` değerinizi geçmesini, benzersiz `external_order_id` kullanmasını, `payment_url` döndürmesini ve ödemeyi onaylamadan önce `Invoice: Get` ile durumu doğrulamasını belirtin.

## İşlemler (`Paymos` düğümü — 18 işlem)

### Invoice (6 işlem)

- **Create** (`POST /v1/invoices`) — 45 itibari para biriminden veya desteklenen kripto varlıklardan herhangi birinde, idempotent `external_order_id`, isteğe bağlı `network`, `customer_fee_percent`, `client_id` ve isteğe bağlı ödeme satır öğeleriyle (`products[]`) fatura oluşturur.
- **Get** (`GET /v1/invoices/{id}`) — Kimliğe (`inv_...`) göre fatura getirir.
- **Get Many** (`GET /v1/invoices`) — `project_id`, `status`, `external_order_id`, `created_from` / `created_to` (Unix saniye) filtreleriyle anahtar kümesi imleç (*keyset cursor*) sayfalaması (`returnAll` veya `limit`) kullanarak faturaları listeler.
- **Confirm Payment** (`POST /v1/invoices/{id}/confirm-payment`) — İtibari para birimli bir fatura için döviz kurunu kilitler ve yatırma adresi tahsis eder (Host-to-Host ödeme).
- **Cancel** (`POST /v1/invoices/{id}/cancel`) — Hâlâ `awaiting_client` durumundaki bir faturayı gerekçeyle iptal eder.
- **Simulate Sandbox Payment** (`POST /v1/sandbox/invoices/{id}/simulate-payment`) — Yalnızca Sandbox (`pk_test_` gerekir; `pk_live_` için istemci tarafında reddedilir). Faturayı `paid`, `overpaid`, `underpay`, `cancel` veya `paid_late` durumuna geçirir.

### Payment Channel (6 işlem)

- **Create** (`POST /v1/payment-channels`) — Bir müşteri için kalıcı çok ağlı yatırma kimliğini idempotent olarak oluşturur veya getirir (`project_id` + `external_id`).
- **Get** (`GET /v1/payment-channels/{id}`) — Tahsis edilmiş adresler ve token başına güncel `minimum_deposit` bilgileriyle ödeme kanalını getirir.
- **Get Many** (`GET /v1/payment-channels`) — `project_id`, `status`, `external_id` filtreleriyle anahtar kümesi imleç sayfalaması (`returnAll` veya `limit`) kullanarak ödeme kanallarını listeler.
- **Block** (`POST /v1/payment-channels/{id}/block`) — Yeni yatırımların bir kanala ilişkilendirilmesini durdurur.
- **Unblock** (`POST /v1/payment-channels/{id}/unblock`) — Yatırımların bir kanala ilişkilendirilmesini yeniden başlatır.
- **Simulate Sandbox Deposit** (`POST /v1/sandbox/payment-channels/{id}/simulate-deposit`) — Yalnızca Sandbox (`pk_test_` gerekir). Kanal üzerinde `confirming`, `reorged` veya `confirmed` yatırımı simüle eder.

### Payment Channel Deposit (2 işlem)

- **Get** (`GET /v1/payment-channel-deposits/{id}`) — Herhangi bir durumdaki (`confirming`, `reorged`, `confirmed`) tek bir yatırımı (`pcd_...`) getirir.
- **Get Many** (`GET /v1/payment-channel-deposits`) — Onaylanmış yatırım akışının tek sayfalık imleç yoklaması (`cursor`, `limit`, `project_id`, `payment_channel_id`, `confirmed_from`). Sonsuz bir akışta `next_cursor` hiçbir zaman `null` olmadığından `returnAll` döngüsüne girmeden her zaman `{ items, next_cursor, blocked? }` döndürür — `next_cursor` değerini iş akışı durumunuzda saklayın ve bir sonraki yoklamaya geçin.

### Refund (4 işlem)

- **Create** (`POST /v1/refunds`) — Kayıtlı ilk gönderene geri dönmek üzere sunucu taraflı hesaplanan `full` veya `overpayment` fatura iadesi oluşturur (`invoice_id`, `mode`, `external_order_id`).
- **Get** (`GET /v1/refunds/{id}`) — Çekim kimliğine (`wdr_...`) göre iadeyi getirir.
- **Get Many** (`GET /v1/refunds`) — `invoice_id`, `status`, `created_from` / `created_to` (RFC 3339 zaman damgaları) filtreleriyle anahtar kümesi imleç sayfalaması (`returnAll` veya `limit`) kullanarak iadeleri listeler.
- **Simulate Sandbox Refund** (`POST /v1/sandbox/refunds/{id}/simulate`) — Yalnızca Sandbox (`pk_test_` gerekir). Bir sandbox iadesini `completed`, `failed` veya `cancelled` durumuna geçirir.

> **v1 Kapsam Notu:** Giden çekimler (`Withdrawal`) ve bakiye sorguları (`Balance`) bir Ödeme Çıkışı API anahtarı (`rk_...`) gerektirir ve `n8n-nodes-paymos` v1 sürümünde sunulmaz.

## Webhook Tetikleyicisi (`Paymos Trigger`)

1. İş akışınıza **Paymos Trigger** ekleyin ve **Production URL** adresini kopyalayın (**Test URL** adresini yalnızca editörde etkileşimli test yaparken kullanın).
2. **Paymos Dashboard → Developer → Webhooks** altında bu URL ile bir HTTPS uç noktası oluşturun ve kategorilerinizi (`Invoice`, `Payment channel`, `Withdrawal`) seçin.
3. Üretilen `whsec_...` imzalama gizli anahtarını n8n'deki **Paymos API** kimlik bilginizin **Webhook Signing Secret** alanına yapıştırın.
4. Tetikleyici düğümünde belirli olayları veya `*` (All Events) seçeneğini seçin ve iş akışını etkinleştirin.

Desteklenen kanonik olaylar (toplam **18**):

- **Invoice (9):** `invoice.awaiting_payment`, `invoice.confirming`, `invoice.underpaid_waiting`, `invoice.paid`, `invoice.paid_over`, `invoice.underpaid`, `invoice.expired`, `invoice.cancelled`, `invoice.paid_late`
- **Payment Channel Deposit (3):** `payment_channel.deposit.confirming`, `payment_channel.deposit.reorged`, `payment_channel.deposit.confirmed`
- **Withdrawal (6):** `withdrawal.created`, `withdrawal.processing`, `withdrawal.completed`, `withdrawal.failed`, `withdrawal.cancelled`, `withdrawal.completion_rewound`

`rawBody` içermeyen, HMAC doğrulamasından geçemeyen veya 300 saniyelik zaman damgası toleransını aşan teslimatlar HTTP `401` alır ve iş akışını asla başlatmaz. Seçilmemiş olaylara ait geçerli teslimatlar, iş akışını tetiklemeden HTTP `200 { "received": true, "ignored": true }` döndürür.

## Sorun Giderme

| Belirti / hata | Çözüm |
| --- | --- |
| `Payout API keys (rk_) are not supported` | **Dashboard → Developer → API Keys** bölümünden bir **Payment** anahtarı (`pk_live_` veya `pk_test_`) kullanın. |
| `Paymos API 401: Invalid API credential or signature` | Tam `sk_` gizli anahtarını yeniden kopyalayın, anahtarın etkin olduğunu doğrulayın ve Self-Hosted n8n sunucusunda NTP saat senkronizasyonunu kontrol edin. |
| `Paymos Trigger requires a Webhook Signing Secret (whsec_...)` | **Dashboard → Developer → Webhooks** sayfasından aldığınız `whsec_...` değerini **Paymos API** içine yapıştırın ve iş akışını yeniden etkinleştirin. |
| Self-Hosted n8n üzerinde eksik webhook veya `401` | Tetikleyicinin **Production URL** adresini kaydedin, herkese açık HTTPS `N8N_WEBHOOK_URL` yapılandırın ve JSON'u yeniden serileştirmeden kesin ham gövdeyi iletin. |
| `Sandbox simulation operations require a Sandbox Payment API key (pk_test_)` | Canlıya geçmeden önce Sandbox `pk_test_` kimlik bilgisine geçin veya `Simulate Sandbox *` düğümlerini kaldırın. |
| **Paymos** AI Agent araçlarında listelenmiyor (Self-Hosted) | `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true` ayarını yapın ve n8n'i yeniden başlatın. |

## Sıkça Sorulan Sorular

### `n8n-nodes-paymos` hem n8n Cloud hem de Self-Hosted n8n üzerinde çalışır mı?
Evet. Paket harici çalışma zamanı npm bağımlılığı içermez (`"dependencies": {}`), HMAC-SHA256 imzalama ve ham gövde `X-Webhook-Signature` doğrulaması için Node'un yerleşik `node:crypto` modülünü kullanır ve n8n Verified Community Node kurallarına uyar. Self-hosted kurulumlar `n8n-nodes-paymos` paketini **Settings → Community Nodes** üzerinden veya `npm install n8n-nodes-paymos` ile kurabilir.

### Paymos'u bir n8n AI Agent'a araç olarak bağlayabilir miyim?
Evet. `Paymos` düğümü `usableAsTool: true` olarak ayarlanmıştır; böylece n8n AI Agent iş akışları yalnızca Ödeme anahtarı (`pk_live_` veya `pk_test_`) kullanarak hosted checkout faturası oluşturabilir, ödeme durumunu sorgulayabilir, müşteri bazlı Ödeme Kanalları oluşturabilir ve sunucu taraflı hesaplanan fatura iadeleri başlatabilir. Self-hosted n8n'de `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true` ayarını yapın.

### Ödeme çıkışı anahtarları (`rk_`) ve Çekimler neden v1 kapsamının dışında?
Tasarım gereği `n8n-nodes-paymos` kesinlikle **Payment API sınırı** (`pk_live_` / `pk_test_`) içinde kalır; böylece otomasyonlar ve yapay zeka ajanları hazine çekim kimlik bilgilerine (`rk_`) sahip olmadan sabit coin/XAUT ödemesi kabul edebilir ve fatura iadesi işleyebilir.

### Hangi varlıklar, ağlar ve webhook olayları desteklenir?
Paymos **13 yatırma ağında** **5 varlığı** (4 sabit coin: **USDT, USDC, USD1, DAI** + altın destekli **XAUT**), **45 itibari fiyatlandırma para birimini** ve 300 saniyelik yeniden oynatma penceresiyle `rawBody` üzerinden doğrulanan **18 kanonik webhook olayının** tamamını (`invoice.*`, `payment_channel.deposit.*`, `withdrawal.*`) destekler.

## Geliştirme

```bash
npm ci
npm test
npm run check
npm run lint
npm run build
```

## Dokümantasyon ve Destek

- [Paymos n8n Entegrasyon Kılavuzu](https://paymos.io/tr/docs/n8n)
- [Paymos Merchant API Dokümantasyonu](https://paymos.io/tr/docs)
- [Webhooks Referansı](https://paymos.io/tr/docs/webhooks)
- [Sorun Bildirimi (Issues)](https://github.com/Paymos-labs/n8n-nodes-paymos/issues)

## Lisans

[MIT](../LICENSE)
