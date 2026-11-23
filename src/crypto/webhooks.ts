import { createHmac, timingSafeEqual } from 'node:crypto';

export const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300;

export class SignatureMismatchError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SignatureMismatchError';
	}
}

export class TimestampSkewError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'TimestampSkewError';
	}
}

export interface WebhookEventEnvelope<T = Record<string, unknown>> {
	event_id: string;
	event_type: string;
	version: number;
	occurred_at: number;
	data: T;
}

interface ParsedSignatureHeader {
	timestamp: number;
	signatures: string[];
}

function parseHeader(header: string): ParsedSignatureHeader | null {
	if (typeof header !== 'string') {
		return null;
	}
	let timestamp: number | undefined;
	let timestampCount = 0;
	const signatures: string[] = [];

	for (const part of header.split(',')) {
		const separator = part.indexOf('=');
		if (separator < 1) {
			continue;
		}
		const key = part.slice(0, separator).trim();
		const value = part.slice(separator + 1).trim();
		if (key === 't' && /^\d+$/.test(value)) {
			timestamp = Number(value);
			timestampCount += 1;
		}
		if (key === 'v1' && value !== '') {
			signatures.push(value);
		}
	}

	if (
		timestamp === undefined ||
		timestampCount !== 1 ||
		!Number.isSafeInteger(timestamp) ||
		signatures.length === 0
	) {
		return null;
	}

	return { timestamp, signatures };
}

function assertEventEnvelope(value: unknown): asserts value is WebhookEventEnvelope<Record<string, unknown>> {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		throw new TypeError('Webhook payload must be a JSON object.');
	}
	const event = value as Record<string, unknown>;
	if (typeof event.event_id !== 'string' || event.event_id.trim() === '') {
		throw new TypeError('Webhook event_id must be a non-empty string.');
	}
	if (typeof event.event_type !== 'string' || event.event_type.trim() === '') {
		throw new TypeError('Webhook event_type must be a non-empty string.');
	}
	if (typeof event.version !== 'number' || !Number.isSafeInteger(event.version) || event.version < 1) {
		throw new TypeError('Webhook version must be a positive integer.');
	}
	if (
		typeof event.occurred_at !== 'number' ||
		!Number.isSafeInteger(event.occurred_at) ||
		event.occurred_at < 0
	) {
		throw new TypeError('Webhook occurred_at must be a non-negative Unix timestamp.');
	}
	if (event.data === null || typeof event.data !== 'object' || Array.isArray(event.data)) {
		throw new TypeError('Webhook data must be an object.');
	}
}

export function assertValidWebhookSignature(
	rawBody: Buffer | string,
	signatureHeader: string,
	secret: string,
	toleranceSeconds = DEFAULT_WEBHOOK_TOLERANCE_SECONDS,
	nowSeconds = Math.floor(Date.now() / 1000),
): void {
	if (typeof secret !== 'string' || secret.trim() === '') {
		throw new TypeError('Webhook secret must be a non-empty string.');
	}
	if (!Number.isSafeInteger(toleranceSeconds) || toleranceSeconds < 0) {
		throw new TypeError('Webhook tolerance must be a non-negative integer.');
	}
	if (typeof rawBody !== 'string' && !Buffer.isBuffer(rawBody)) {
		throw new SignatureMismatchError('Webhook rawBody is missing.');
	}

	const parsed = parseHeader(signatureHeader);
	if (!parsed) {
		throw new SignatureMismatchError('Webhook signature header is missing or malformed.');
	}
	if (Math.abs(nowSeconds - parsed.timestamp) > toleranceSeconds) {
		throw new TimestampSkewError('Webhook timestamp is outside the allowed tolerance.');
	}

	const expected = createHmac('sha256', secret)
		.update(`${parsed.timestamp}.`)
		.update(rawBody)
		.digest();

	let matched = false;
	for (const signature of parsed.signatures) {
		if (!/^[0-9a-fA-F]{64}$/.test(signature)) {
			continue;
		}
		const candidate = Buffer.from(signature, 'hex');
		if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) {
			matched = true;
		}
	}

	if (!matched) {
		throw new SignatureMismatchError('Webhook signature does not match payload.');
	}
}

export function verifyWebhookSignature(
	rawBody: Buffer | string,
	signatureHeader: string,
	secret: string,
	toleranceSeconds = DEFAULT_WEBHOOK_TOLERANCE_SECONDS,
	nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
	try {
		assertValidWebhookSignature(rawBody, signatureHeader, secret, toleranceSeconds, nowSeconds);
		return true;
	} catch {
		return false;
	}
}

export function parseWebhookEvent<T = Record<string, unknown>>(
	rawBody: Buffer | string,
	signatureHeader: string,
	secret: string,
	toleranceSeconds = DEFAULT_WEBHOOK_TOLERANCE_SECONDS,
	nowSeconds = Math.floor(Date.now() / 1000),
): WebhookEventEnvelope<T> {
	assertValidWebhookSignature(rawBody, signatureHeader, secret, toleranceSeconds, nowSeconds);
	let parsed: unknown;
	try {
		const text = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
		parsed = JSON.parse(text);
	} catch (error) {
		throw new TypeError('Webhook payload is not valid JSON.', { cause: error });
	}
	assertEventEnvelope(parsed);
	return parsed as WebhookEventEnvelope<T>;
}

export class WebhookVerifier {
	constructor(
		private readonly secret: string,
		private readonly toleranceSeconds = DEFAULT_WEBHOOK_TOLERANCE_SECONDS,
	) {
		if (typeof secret !== 'string' || secret.trim() === '') {
			throw new TypeError('Webhook secret must be a non-empty string.');
		}
		if (!Number.isSafeInteger(toleranceSeconds) || toleranceSeconds < 0) {
			throw new TypeError('Webhook tolerance must be a non-negative integer.');
		}
	}

	verify(
		signatureHeader: string,
		rawBody: Buffer | string,
		nowSeconds = Math.floor(Date.now() / 1000),
	): boolean {
		return verifyWebhookSignature(rawBody, signatureHeader, this.secret, this.toleranceSeconds, nowSeconds);
	}

	assertValid(
		signatureHeader: string,
		rawBody: Buffer | string,
		nowSeconds = Math.floor(Date.now() / 1000),
	): void {
		assertValidWebhookSignature(rawBody, signatureHeader, this.secret, this.toleranceSeconds, nowSeconds);
	}

	constructEvent<T = Record<string, unknown>>(
		signatureHeader: string,
		rawBody: Buffer | string,
		nowSeconds = Math.floor(Date.now() / 1000),
	): WebhookEventEnvelope<T> {
		return parseWebhookEvent<T>(rawBody, signatureHeader, this.secret, this.toleranceSeconds, nowSeconds);
	}
}
