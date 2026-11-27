# n8n-nodes-paymos — Paymos 官方 n8n 社区节点

[English](../README.md) | **简体中文** | [Русский](README.ru.md) | [Español](README.es.md) | [Deutsch](README.de.md) | [Türkçe](README.tr.md)

[Paymos](https://paymos.io/zh-hans) 官方 n8n 社区节点包 — 跨 **13 条网络**接收稳定币（**USDT、USDC、USD1、DAI**）和黄金锚定资产 **XAUT** 支付，管理按客户分配的支付通道（Payment Channels）及服务端计算的发票退款，并通过经过签名验证的 Paymos Webhook 触发自动化工作流。

同时支持 **n8n Cloud** 与**自托管 n8n（Self-Hosted n8n）**，**零运行时依赖**（`"dependencies": {}`），内置基于 `node:crypto` 的 HMAC-SHA256 请求签名与原始请求体 Webhook 签名验证，并原生支持 AI Agent 工具调用（`usableAsTool: true`）。

[![观看视频：10 分钟 Paymos API 快速入门 — 从沙盒到签名 Webhook](https://i.ytimg.com/vi/aHQfHszuRBo/maxresdefault.jpg)](https://www.youtube.com/watch?v=aHQfHszuRBo)

> **视频演示（1:22，提供 6 种语言字幕）：** [在 YouTube 上观看](https://www.youtube.com/watch?v=aHQfHszuRBo)

## 核心特性

- **13 条入金网络支持 5 种资产：** 覆盖 4 种稳定币（**USDT、USDC、USD1、DAI**）与 1 种黄金锚定资产（**XAUT**），支持 **TRC20、ERC20、BEP20、POLYGON、ARBITRUM、OPTIMISM、BASE、TON、AVAX、SOL、NEAR、SUI、PLASMA**（提现支持 11 条网络——NEAR 与 Sui 仅支持入金——并在本节点 v1 中刻意不包含提现操作）。
- **45 种法币计价货币：** 支持按 45 种法币计价或直接以加密资产计价创建发票。
- **仅收款（Payment-only）API 密钥边界：** 仅使用 Paymos 收款 API 密钥（生产环境 `pk_live_` 或沙盒环境 `pk_test_`）和密钥（`sk_...`）连接。发送任何请求前即会拦截出款密钥（`rk_...`）；v1 不包含 `Withdrawal`（提现）与 `Balance`（余额）操作。
- **零运行时 npm 依赖：** 所有 HMAC-SHA256 请求签名与 `X-Webhook-Signature` 校验均基于 Node.js 内置的 `node:crypto` 和 n8n 的 `this.helpers.httpRequest` 完成。
- **原生支持 AI Agent 工具（`usableAsTool: true`）：** 可直接将 `Paymos` 节点作为工具挂载到 n8n AI Agent 工作流中。
- **全部 18 种标准 Webhook 事件 + `*`：** `Paymos Trigger` 针对精确的 `rawBody` 执行常量时间比较的 `X-Webhook-Signature` 校验，支持多 `v1=` 密钥轮换与 300 秒防重放时间窗口。

## 安装方式

### n8n Cloud 与自托管（Community Nodes 界面）

1. 在 n8n 实例中打开 **Settings → Community Nodes**。
2. 选择 **Install a community node**。
3. 输入 `n8n-nodes-paymos` 并确认安装。

### 自托管（手动 / Docker）

```bash
npm install n8n-nodes-paymos
```

如需在自托管 n8n 中允许将 `Paymos` 节点作为 **AI Agent 工具**使用，请配置环境变量：

```bash
N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true
```

## 快速上手（3 分钟）

1. **复制项目 ID（`prj_...`）：** 前往 **Paymos Dashboard → Projects → Details** 获取。
2. **复制收款 API 密钥对（`pk_` + `sk_`）：** 前往 **Paymos Dashboard → Developer → API Keys**（打开顶部栏 **Test** 开关获取沙盒密钥 `pk_test_...` / `sk_test_...`，关闭则获取生产密钥 `pk_live_...` / `sk_live_...`）。
3. **在 n8n 中创建 `Paymos API` 凭证**，点击 **Save**（或 **Retry / Test**）验证连通性。
4. **添加 `Paymos` 节点**（`Invoice` → `Create`），填入 `project_id`、`amount`、`currency` 及唯一的 `external_order_id`，然后将 `={{ $json.payment_url }}` 发送给客户。
5. **添加 `Paymos Trigger` 工作流**监听 `invoice.paid` 与 `invoice.paid_over`，将其 **Production URL** 注册到 **Paymos Dashboard → Developer → Webhooks**，把生成的 `whsec_...` 填入你的 **Paymos API** 凭证，即可使用 `={{ $json.data.invoice_id }}` 和 `={{ $json.data.order.external_id }}` 完成订单履约。

## 凭证配置（`Paymos API`）

使用 **Paymos Dashboard → Developer → API Keys** 中的密钥在 n8n 中创建 **Paymos API** 凭证：

| 字段 | 是否必填 | 说明 |
| --- | --- | --- |
| **Public Key** | 是 | 收款 API 公钥：`pk_live_...`（生产）或 `pk_test_...`（沙盒）。出款密钥（`rk_...`）会被拒绝。 |
| **Secret Key** | 是 | 用于 HMAC-SHA256 请求签名的完整收款 API 密钥（`sk_...`）。 |
| **Webhook Signing Secret** | 仅 Trigger 需要 | 来自 **Dashboard → Developer → Webhooks** 的 `whsec_...` 签名密钥。启用 `Paymos Trigger` 时必填。 |
| **API Base URL** | 是 | 默认为 `https://api.paymos.io`（根据密钥前缀自动路由至生产或沙盒环境）。 |

点击 **Save** / **Test** 会向 Paymos 商户稳定币支付 API 发起一次签名的 `GET /v1/invoices?limit=1` 连通性检查。建议同时保留两套凭证——**Paymos Sandbox**（`pk_test_...`）和 **Paymos Production**（`pk_live_...`）——先完成端到端沙盒验证，再切至生产流量。

## 常见工作流场景

- **新订单自动生成托管收银台链接：** 触发器（Telegram / Webhook / 表单 / CRM）→ **Paymos**（`Invoice: Create`）→ 发送 `={{ $json.payment_url }}` 并保存 `={{ $json.invoice_id }}`。
- **自动订单履约：** **Paymos Trigger**（`invoice.paid`、`invoice.paid_over`）→ 按 `={{ $json.data.invoice_id }}` + `={{ $json.event_id }}` 去重 → 使用 `={{ $json.data.order.external_id }}` 开通权限或将 CRM 商机标记为已支付。
- **客户固定专属充值地址：** **Paymos**（使用稳定的客户 `external_id` 调用 `Payment Channel: Create`）→ 通过 `payment_channel.deposit.confirmed` 事件入账，或通过定时任务调用 `Payment Channel Deposit: Get Many` 并持久化 `={{ $json.next_cursor }}`。
- **无需出款密钥的客服退款：** 工单/CRM 触发器 → **Paymos**（`Refund: Create`，传入 `invoice_id`、`mode: full | overpayment`、`external_order_id`）→ 可选在 **Paymos Trigger** 中监听 `withdrawal.completed` / `withdrawal.failed`。
- **AI Agent 收银与客服工具：** 将 **Paymos Tool** 挂载到 n8n **AI Agent**，在提示词中指示其传入你的 `project_id`、使用唯一 `external_order_id`、返回 `payment_url`，并在确认收款前通过 `Invoice: Get` 核实状态。

## 节点操作（`Paymos` 节点 — 共 18 项操作）

### Invoice 发票（6 项操作）

- **Create**（`POST /v1/invoices`）— 以 45 种法币或支持的加密资产创建发票，支持幂等键 `external_order_id`、可选 `network`、`customer_fee_percent`、`client_id` 以及可选的收银台商品明细（`products[]`）。
- **Get**（`GET /v1/invoices/{id}`）— 按 ID（`inv_...`）查询单笔发票。
- **Get Many**（`GET /v1/invoices`）— 基于键集游标分页列出发票（`returnAll` 或 `limit`），支持按 `project_id`、`status`、`external_order_id`、`created_from` / `created_to`（Unix 秒级时间戳）筛选。
- **Confirm Payment**（`POST /v1/invoices/{id}/confirm-payment`）— 为法币计价发票锁定汇率并分配充值地址（Host-to-Host 自建收银台）。
- **Cancel**（`POST /v1/invoices/{id}/cancel`）— 取消仍处于 `awaiting_client` 状态的发票并附带原因。
- **Simulate Sandbox Payment**（`POST /v1/sandbox/invoices/{id}/simulate-payment`）— 仅限沙盒（必须使用 `pk_test_`，`pk_live_` 会在客户端被直接拦截）。将发票模拟推进至 `paid`、`overpaid`、`underpay`、`cancel` 或 `paid_late`。

### Payment Channel 支付通道（6 项操作）

- **Create**（`POST /v1/payment-channels`）— 按 `project_id` + `external_id` 幂等创建或获取客户的永久多网络充值通道身份。
- **Get**（`GET /v1/payment-channels/{id}`）— 查询支付通道及其已分配地址与各代币实时 `minimum_deposit`。
- **Get Many**（`GET /v1/payment-channels`）— 基于键集游标分页列出支付通道（`returnAll` 或 `limit`），支持按 `project_id`、`status`、`external_id` 筛选。
- **Block**（`POST /v1/payment-channels/{id}/block`）— 停止将新充值归属到该支付通道。
- **Unblock**（`POST /v1/payment-channels/{id}/unblock`）— 恢复向该支付通道归属充值。
- **Simulate Sandbox Deposit**（`POST /v1/sandbox/payment-channels/{id}/simulate-deposit`）— 仅限沙盒（需 `pk_test_`）。在通道上模拟一笔 `confirming`、`reorged` 或 `confirmed` 充值。

### Payment Channel Deposit 通道充值（2 项操作）

- **Get**（`GET /v1/payment-channel-deposits/{id}`）— 查询任意状态（`confirming`、`reorged`、`confirmed`）的单笔充值（`pcd_...`）。
- **Get Many**（`GET /v1/payment-channel-deposits`）— 单页游标轮询已确认充值流（`cursor`、`limit`、`project_id`、`payment_channel_id`、`confirmed_from`）。由于无限充值流中的 `next_cursor` 永远不为 `null`，本操作不会执行 `returnAll` 循环，始终返回 `{ items, next_cursor, blocked? }`——请将 `next_cursor` 持久化到工作流状态中，并在下次轮询时传入。

### Refund 退款（4 项操作）

- **Create**（`POST /v1/refunds`）— 创建由服务端计算金额的 `full`（全额）或 `overpayment`（超付）发票退款，原路退回首个已记录的付款地址（`invoice_id`、`mode`、`external_order_id`）。
- **Get**（`GET /v1/refunds/{id}`）— 按提现单号（`wdr_...`）查询退款详情。
- **Get Many**（`GET /v1/refunds`）— 基于键集游标分页列出退款（`returnAll` 或 `limit`），支持按 `invoice_id`、`status`、`created_from` / `created_to`（RFC 3339 时间戳）筛选。
- **Simulate Sandbox Refund**（`POST /v1/sandbox/refunds/{id}/simulate`）— 仅限沙盒（需 `pk_test_`）。将沙盒退款模拟推进至 `completed`、`failed` 或 `cancelled`。

> **v1 范围说明：** 主动对外提现（`Withdrawal`）和余额查询（`Balance`）需要出款 API 密钥（`rk_...`），在 `n8n-nodes-paymos` v1 中未开放。

## Webhook 触发器（`Paymos Trigger`）

1. 在工作流中添加 **Paymos Trigger** 并复制其 **Production URL**（仅在编辑器内交互调试时使用 **Test URL**）。
2. 在 **Paymos Dashboard → Developer → Webhooks** 中使用该 URL 创建 HTTPS 端点，并勾选需要的事件类别（`Invoice`、`Payment channel`、`Withdrawal`）。
3. 将生成的 `whsec_...` 签名密钥复制到 n8n 中 **Paymos API** 凭证的 **Webhook Signing Secret** 字段。
4. 在触发器节点上勾选具体事件或 `*`（全部事件），然后激活工作流。

支持的标准事件（共 **18** 种）：

- **Invoice（9 种）：** `invoice.awaiting_payment`、`invoice.confirming`、`invoice.underpaid_waiting`、`invoice.paid`、`invoice.paid_over`、`invoice.underpaid`、`invoice.expired`、`invoice.cancelled`、`invoice.paid_late`
- **Payment Channel Deposit（3 种）：** `payment_channel.deposit.confirming`、`payment_channel.deposit.reorged`、`payment_channel.deposit.confirmed`
- **Withdrawal（6 种）：** `withdrawal.created`、`withdrawal.processing`、`withdrawal.completed`、`withdrawal.failed`、`withdrawal.cancelled`、`withdrawal.completion_rewound`

缺少 `rawBody`、HMAC-SHA256 签名验证失败或超出 300 秒时间戳容差的推送会直接收到 HTTP `401`，且绝不会触发工作流。签名有效但属于未勾选事件的推送会返回 HTTP `200 { "received": true, "ignored": true }`，同样不会启动工作流。

## 故障排查

| 现象 / 错误 | 解决方法 |
| --- | --- |
| `Payout API keys (rk_) are not supported` | 请改用 **Dashboard → Developer → API Keys** 中的**收款（Payment）**密钥（`pk_live_` 或 `pk_test_`）。 |
| `Paymos API 401: Invalid API credential or signature` | 重新复制完整的 `sk_` 密钥，确认密钥处于启用状态，并检查自托管 n8n 服务器的 NTP 时钟同步。 |
| `Paymos Trigger requires a Webhook Signing Secret (whsec_...)` | 从 **Dashboard → Developer → Webhooks** 复制 `whsec_...` 填入 **Paymos API** 凭证，然后重新激活工作流。 |
| 自托管 n8n 收不到 Webhook 或返回 `401` | 确保注册的是触发器的 **Production URL**，正确配置公网 HTTPS `N8N_WEBHOOK_URL`，且反向代理原样转发原始请求体（不要重新序列化 JSON）。 |
| `Sandbox simulation operations require a Sandbox Payment API key (pk_test_)` | 切换为沙盒 `pk_test_` 凭证，或在上线前移除 `Simulate Sandbox *` 节点。 |
| AI Agent 工具列表中看不到 **Paymos**（自托管） | 设置 `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true` 并重启 n8n。 |

## 常见问题

### `n8n-nodes-paymos` 是否同时支持 n8n Cloud 与自托管 n8n？
支持。本包零外部运行时 npm 依赖（`"dependencies": {}`），完全基于 Node 内置的 `node:crypto` 实现 HMAC-SHA256 签名与原始请求体 `X-Webhook-Signature` 校验，并遵循 n8n Verified Community Node 规范。自托管实例既可通过 **Settings → Community Nodes** 安装，也可运行 `npm install n8n-nodes-paymos`。

### 可以将 Paymos 作为工具挂载给 n8n AI Agent 吗？
可以。`Paymos` 节点启用了 `usableAsTool: true`，使 n8n AI Agent 工作流能使用仅收款密钥（`pk_live_` 或 `pk_test_`）创建托管收银台发票、查询支付状态、为客户分配支付通道并发起服务端计算的发票退款。自托管 n8n 需设置 `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true`。

### 为什么 v1 不包含出款密钥（`rk_`）和提现操作？
这是刻意的安全边界设计：`n8n-nodes-paymos` 严格限定在 **Payment API 边界**（`pk_live_` / `pk_test_`）内，让自动化工作流和 AI Agent 能够安全地接收稳定币/XAUT 支付并处理发票退款，而无需持有资金库出款凭证（`rk_`）。

### 支持哪些资产、网络和 Webhook 事件？
Paymos 支持 **5 种资产**（4 种稳定币：**USDT、USDC、USD1、DAI** + 黄金锚定资产 **XAUT**）、**13 条入金网络**、**45 种法币计价货币**以及全部 **18 种标准 Webhook 事件**（`invoice.*`、`payment_channel.deposit.*`、`withdrawal.*`），全部基于 `rawBody` 验证并带有 300 秒防重放窗口。

## 本地开发

```bash
npm ci
npm test
npm run check
npm run lint
npm run build
```

## 文档与支持

- [Paymos n8n 集成指南](https://paymos.io/zh-hans/docs/n8n)
- [Paymos 商户 API 文档](https://paymos.io/zh-hans/docs)
- [Webhook 参考文档](https://paymos.io/zh-hans/docs/webhooks)
- [提交 Issue](https://github.com/Paymos-labs/n8n-nodes-paymos/issues)

## 许可证

[MIT](../LICENSE)
