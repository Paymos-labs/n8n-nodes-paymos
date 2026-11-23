/* eslint-disable @n8n/community-nodes/no-restricted-imports */
import { createHmac } from 'node:crypto';
import type {
	IDataObject,
	IHookFunctions,
	INodePropertyOptions,
	IWebhookFunctions,
} from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';
import {
	PAYMOS_CANONICAL_WEBHOOK_EVENTS,
	PaymosTrigger,
} from '../nodes/PaymosTrigger/PaymosTrigger.node';

function makeSignature(secret: string, timestamp: number, rawBody: string | Buffer): string {
	return createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest('hex');
}

function createWebhookMock(options: {
	credentials?: Record<string, unknown>;
	events?: string[];
	toleranceSeconds?: number;
	rawBody?: Buffer | string;
	body?: unknown;
	headers?: Record<string, string | string[] | undefined>;
}) {
	const setHeaderMock = vi.fn();
	const jsonMock = vi.fn();
	const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
	const res = { setHeader: setHeaderMock, status: statusMock, json: jsonMock };
	const req = {
		rawBody: options.rawBody,
		body: options.body,
		headers: options.headers ?? {},
	};

	const context = {
		getRequestObject: () => req,
		getResponseObject: () => res,
		getHeaderData: () => options.headers ?? {},
		getCredentials: vi.fn().mockResolvedValue(
			options.credentials ?? {
				publicKey: 'pk_test_1',
				secretKey: 'sk_test_1',
				webhookSecret: 'whsec_trigger_secret',
			},
		),
		getNodeParameter: (name: string, fallback?: unknown) => {
			if (name === 'events') return options.events ?? ['invoice.paid'];
			if (name === 'options') {
				return options.toleranceSeconds !== undefined
					? { toleranceSeconds: options.toleranceSeconds }
					: {};
			}
			return fallback;
		},
		helpers: {
			returnJsonArray: (items: IDataObject[]) => items.map((json) => ({ json })),
		},
	} as unknown as IWebhookFunctions;

	return { context, setHeaderMock, statusMock, jsonMock };
}

describe('PaymosTrigger webhook node', () => {
	it('declares all 18 canonical Paymos events plus wildcard (*)', () => {
		const trigger = new PaymosTrigger();
		expect(PAYMOS_CANONICAL_WEBHOOK_EVENTS).toHaveLength(18);

		const eventsProp = trigger.description.properties.find((p) => p.name === 'events');
		const optionValues = (eventsProp?.options as INodePropertyOptions[]).map((o) => String(o.value));

		expect(optionValues).toHaveLength(19);
		expect(optionValues).toContain('*');
		for (const eventName of PAYMOS_CANONICAL_WEBHOOK_EVENTS) {
			expect(optionValues, eventName).toContain(eventName);
		}
	});

	it('requires a non-empty whsec_ secret in checkExists and create without remote API CRUD', async () => {
		const trigger = new PaymosTrigger();

		const missingCtx = {
			getCredentials: vi.fn().mockResolvedValue({
				publicKey: 'pk_test_1',
				secretKey: 'sk_test_1',
				webhookSecret: '',
			}),
		} as unknown as IHookFunctions;

		await expect(trigger.webhookMethods.default.checkExists.call(missingCtx)).rejects.toThrow(/whsec_/);
		await expect(trigger.webhookMethods.default.create.call(missingCtx)).rejects.toThrow(/whsec_/);

		const badPrefixCtx = {
			getCredentials: vi.fn().mockResolvedValue({
				publicKey: 'pk_test_1',
				secretKey: 'sk_test_1',
				webhookSecret: 'not_a_webhook_secret',
			}),
		} as unknown as IHookFunctions;
		await expect(trigger.webhookMethods.default.create.call(badPrefixCtx)).rejects.toThrow(/whsec_/);

		const validCtx = {
			getCredentials: vi.fn().mockResolvedValue({
				publicKey: 'pk_test_1',
				secretKey: 'sk_test_1',
				webhookSecret: 'whsec_valid_123',
			}),
		} as unknown as IHookFunctions;
		expect(await trigger.webhookMethods.default.checkExists.call(validCtx)).toBe(true);
		expect(await trigger.webhookMethods.default.create.call(validCtx)).toBe(true);
		expect(await trigger.webhookMethods.default.delete.call(validCtx)).toBe(true);
	});

	it('returns 401 + { noWebhookResponse: true } on missing rawBody, tamper, or timestamp skew', async () => {
		const trigger = new PaymosTrigger();
		const secret = 'whsec_trigger_secret';
		const now = Math.floor(Date.now() / 1000);
		const payload = {
			event_id: 'evt_1',
			event_type: 'invoice.paid',
			version: 1,
			occurred_at: now,
			data: { invoice_id: 'inv_1', status: 'paid' },
		};
		const rawBody = JSON.stringify(payload);
		const validSig = makeSignature(secret, now, rawBody);

		const expectedProblem = {
			type: 'about:blank',
			title: 'Unauthorized',
			status: 401,
			detail: 'Invalid webhook signature.',
			code: 'webhook_signature_invalid',
		};

		// 1. Missing rawBody (even if parsed req.body is present: NO fallback allowed!)
		const missingRaw = createWebhookMock({
			rawBody: undefined,
			body: payload,
			headers: { 'x-webhook-signature': `t=${now},v1=${validSig}` },
		});
		const missingRes = await trigger.webhook.call(missingRaw.context);
		expect(missingRes).toEqual({ noWebhookResponse: true });
		expect(missingRaw.setHeaderMock).toHaveBeenCalledWith('Content-Type', 'application/problem+json');
		expect(missingRaw.statusMock).toHaveBeenCalledWith(401);
		expect(missingRaw.jsonMock).toHaveBeenCalledWith(expectedProblem);

		// 2. Tampered rawBody
		const tampered = createWebhookMock({
			rawBody: Buffer.from(`${rawBody} `, 'utf8'),
			headers: { 'X-Webhook-Signature': `t=${now},v1=${validSig}` },
		});
		const tamperedRes = await trigger.webhook.call(tampered.context);
		expect(tamperedRes).toEqual({ noWebhookResponse: true });
		expect(tampered.setHeaderMock).toHaveBeenCalledWith('Content-Type', 'application/problem+json');
		expect(tampered.statusMock).toHaveBeenCalledWith(401);
		expect(tampered.jsonMock).toHaveBeenCalledWith(expectedProblem);

		// 3. Expired timestamp (> 300s skew)
		const staleTs = now - 301;
		const staleSig = makeSignature(secret, staleTs, rawBody);
		const stale = createWebhookMock({
			rawBody: Buffer.from(rawBody, 'utf8'),
			headers: { 'x-webhook-signature': `t=${staleTs},v1=${staleSig}` },
		});
		const staleRes = await trigger.webhook.call(stale.context);
		expect(staleRes).toEqual({ noWebhookResponse: true });
		expect(stale.setHeaderMock).toHaveBeenCalledWith('Content-Type', 'application/problem+json');
		expect(stale.statusMock).toHaveBeenCalledWith(401);
		expect(stale.jsonMock).toHaveBeenCalledWith(expectedProblem);
	});

	it('returns { webhookResponse: { received: true, ignored: true } } without calling res.json for non-selected events', async () => {
		const trigger = new PaymosTrigger();
		const secret = 'whsec_trigger_secret';
		const now = Math.floor(Date.now() / 1000);
		const rawBody = JSON.stringify({
			event_id: 'evt_ignored',
			event_type: 'invoice.expired',
			version: 1,
			occurred_at: now,
			data: { invoice_id: 'inv_2', status: 'expired' },
		});
		const sig = makeSignature(secret, now, rawBody);

		const mock = createWebhookMock({
			events: ['invoice.paid'],
			rawBody: Buffer.from(rawBody, 'utf8'),
			headers: { 'x-webhook-signature': `t=${now},v1=${'0'.repeat(64)},v1=${sig}` },
		});

		const result = await trigger.webhook.call(mock.context);
		expect(result).toEqual({
			webhookResponse: { received: true, ignored: true },
		});
		expect(result.workflowData).toBeUndefined();
		expect(mock.statusMock).not.toHaveBeenCalled();
		expect(mock.jsonMock).not.toHaveBeenCalled();
	});

	it('returns { webhookResponse: { received: true }, workflowData } without calling res.json on matched multi-v1 delivery', async () => {
		const trigger = new PaymosTrigger();
		const secret = 'whsec_trigger_secret';
		const now = Math.floor(Date.now() / 1000);
		const event = {
			event_id: 'evt_paid_1',
			event_type: 'payment_channel.deposit.confirmed',
			version: 1,
			occurred_at: now,
			data: { id: 'pcd_1', status: 'confirmed', is_final: true, gross: '25.00' },
		};
		const rawBody = JSON.stringify(event);
		const sig = makeSignature(secret, now, rawBody);

		// Explicit event match with rotated multi-v1 signature
		const matched = createWebhookMock({
			events: ['payment_channel.deposit.confirmed'],
			rawBody: Buffer.from(rawBody, 'utf8'),
			headers: { 'X-Webhook-Signature': `t=${now},v1=${'a'.repeat(64)},v1=${sig}` },
		});
		const matchedRes = await trigger.webhook.call(matched.context);
		expect(matchedRes).toEqual({
			webhookResponse: { received: true },
			workflowData: [[{ json: event }]],
		});
		expect(matched.statusMock).not.toHaveBeenCalled();
		expect(matched.jsonMock).not.toHaveBeenCalled();

		// Wildcard (*) match
		const wildcard = createWebhookMock({
			events: ['*'],
			rawBody: Buffer.from(rawBody, 'utf8'),
			headers: { 'x-webhook-signature': `t=${now},v1=${sig}` },
		});
		const wildcardRes = await trigger.webhook.call(wildcard.context);
		expect(wildcardRes).toEqual({
			webhookResponse: { received: true },
			workflowData: [[{ json: event }]],
		});
		expect(wildcard.statusMock).not.toHaveBeenCalled();
		expect(wildcard.jsonMock).not.toHaveBeenCalled();
	});
});
