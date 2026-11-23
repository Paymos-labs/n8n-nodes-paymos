/* eslint-disable @n8n/community-nodes/no-restricted-imports */
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
	assertValidWebhookSignature,
	parseWebhookEvent,
	SignatureMismatchError,
	TimestampSkewError,
	verifyWebhookSignature,
	WebhookVerifier,
} from '../src/crypto/webhooks';

function signWebhook(secret: string, timestamp: number, rawBody: string | Buffer): string {
	return createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest('hex');
}

describe('WebhookVerifier & rawBody HMAC verification', () => {
	const secret = 'whsec_unit_secret_123';
	const now = 1_700_000_000;
	const rawBody = JSON.stringify({
		event_id: 'evt_test_1',
		event_type: 'invoice.paid',
		version: 1,
		occurred_at: now,
		data: { invoice_id: 'inv_1', status: 'paid', is_final: true },
	});

	it('accepts valid signatures for both string and Buffer rawBody', () => {
		const sig = signWebhook(secret, now, rawBody);
		const header = `t=${now},v1=${sig}`;

		expect(verifyWebhookSignature(rawBody, header, secret, 300, now)).toBe(true);
		expect(verifyWebhookSignature(Buffer.from(rawBody, 'utf8'), header, secret, 300, now)).toBe(true);

		const event = parseWebhookEvent(Buffer.from(rawBody, 'utf8'), header, secret, 300, now);
		expect(event.event_id).toBe('evt_test_1');
		expect(event.event_type).toBe('invoice.paid');
		expect(event.data).toEqual({ invoice_id: 'inv_1', status: 'paid', is_final: true });
	});

	it('accepts rotated multi-v1 headers when either v1 matches', () => {
		const validSig = signWebhook(secret, now, rawBody);
		const wrongSig = '0'.repeat(64);
		const verifier = new WebhookVerifier(secret, 300);

		expect(verifier.verify(`t=${now},v1=${wrongSig},v1=${validSig}`, rawBody, now)).toBe(true);
		expect(verifier.verify(`t=${now},v1=${validSig},v1=${wrongSig}`, rawBody, now)).toBe(true);
		expect(verifier.verify(`t=${now},v1=${wrongSig},v1=${'f'.repeat(64)}`, rawBody, now)).toBe(false);
	});

	it('enforces exact 300-second timestamp tolerance boundaries', () => {
		const sigAtNow = signWebhook(secret, now, rawBody);
		const header = `t=${now},v1=${sigAtNow}`;

		expect(verifyWebhookSignature(rawBody, header, secret, 300, now + 300)).toBe(true);
		expect(verifyWebhookSignature(rawBody, header, secret, 300, now - 300)).toBe(true);

		expect(() => assertValidWebhookSignature(rawBody, header, secret, 300, now + 301)).toThrow(
			TimestampSkewError,
		);
		expect(() => assertValidWebhookSignature(rawBody, header, secret, 300, now - 301)).toThrow(
			TimestampSkewError,
		);
	});

	it('rejects tampered payloads, wrong secrets, malformed headers, and invalid envelopes', () => {
		const sig = signWebhook(secret, now, rawBody);
		const header = `t=${now},v1=${sig}`;

		expect(() => assertValidWebhookSignature(`${rawBody} `, header, secret, 300, now)).toThrow(
			SignatureMismatchError,
		);
		expect(() => assertValidWebhookSignature(rawBody, header, 'whsec_other', 300, now)).toThrow(
			SignatureMismatchError,
		);
		expect(() => assertValidWebhookSignature(rawBody, '', secret, 300, now)).toThrow(
			SignatureMismatchError,
		);
		expect(() => assertValidWebhookSignature(rawBody, `t=${now},t=${now},v1=${sig}`, secret, 300, now)).toThrow(
			SignatureMismatchError,
		);
		expect(() => assertValidWebhookSignature(rawBody, `t=${now},v1=not-hex`, secret, 300, now)).toThrow(
			SignatureMismatchError,
		);

		const badJson = '{not-json';
		const badJsonHeader = `t=${now},v1=${signWebhook(secret, now, badJson)}`;
		expect(() => parseWebhookEvent(badJson, badJsonHeader, secret, 300, now)).toThrow(TypeError);

		const missingFields = JSON.stringify({ event_id: 'evt_1' });
		const missingHeader = `t=${now},v1=${signWebhook(secret, now, missingFields)}`;
		expect(() => parseWebhookEvent(missingFields, missingHeader, secret, 300, now)).toThrow(TypeError);
	});
});
