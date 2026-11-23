/* eslint-disable @n8n/community-nodes/no-restricted-imports */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	authorizationHeader,
	canonicalizeQuery,
	encodePathSegment,
	sha256Hex,
	signRequest,
} from '../src/crypto/signing';
import { WebhookVerifier } from '../src/crypto/webhooks';

const testDir = dirname(fileURLToPath(import.meta.url));
const localContractPath = resolve(testDir, '../conformance/contract.json');
const monorepoContractPath = resolve(testDir, '../../sdk-conformance/contract.json');

interface SigningVector {
	api_key: string;
	api_secret: string;
	timestamp: string;
	method: string;
	path: string;
	query: string;
	body: string;
	body_sha256?: string;
	signature: string;
	authorization?: string;
}

interface TonWebhookVector {
	name: string;
	event_id: string;
	event_type: string;
	version: number;
	header: string;
	raw_body: string;
	expect: Array<{ path: string[]; value: string | boolean | number }>;
}

interface ConformanceContract {
	vectors: {
		post_signing: SigningVector & { authorization: string; body_sha256: string };
		post_empty_body_signing: SigningVector & { authorization: string; body_sha256: string };
		get_query_signing: SigningVector;
		webhook: {
			secret: string;
			timestamp: number;
			now: number;
			tolerance_seconds: number;
			raw_body: string;
			signature: string;
			header: string;
		};
		ton_webhooks: {
			secret: string;
			now: number;
			vectors: TonWebhookVector[];
		};
	};
}

const contract = JSON.parse(readFileSync(localContractPath, 'utf8')) as ConformanceContract;

describe('Paymos SDK signing & webhook conformance', () => {
	it('matches plugins/sdk-conformance/contract.json byte-for-byte when running inside the monorepo', () => {
		expect(existsSync(localContractPath)).toBe(true);
		if (existsSync(monorepoContractPath)) {
			const localBytes = readFileSync(localContractPath);
			const monorepoBytes = readFileSync(monorepoContractPath);
			expect(Buffer.compare(localBytes, monorepoBytes)).toBe(0);
		}
	});

	it('matches POST JSON body signing vector', () => {
		const vector = contract.vectors.post_signing;
		expect(sha256Hex(vector.body)).toBe(vector.body_sha256);
		expect(
			authorizationHeader(
				vector.api_key,
				vector.api_secret,
				vector.timestamp,
				vector.method,
				vector.path,
				vector.query,
				vector.body,
			),
		).toBe(vector.authorization);

		const signed = signRequest({
			method: vector.method,
			path: vector.path,
			query: vector.query,
			body: vector.body,
			publicKey: vector.api_key,
			secretKey: vector.api_secret,
			timestamp: vector.timestamp,
		});
		expect(signed).toEqual({
			Authorization: vector.authorization,
			'X-Request-Timestamp': vector.timestamp,
		});
	});

	it('signs empty POST body as an empty string rather than sha256("")', () => {
		const vector = contract.vectors.post_empty_body_signing;
		expect(sha256Hex('')).toBe('');
		expect(sha256Hex(Buffer.alloc(0))).toBe('');
		expect(sha256Hex(vector.body)).toBe(vector.body_sha256);
		expect(
			authorizationHeader(
				vector.api_key,
				vector.api_secret,
				vector.timestamp,
				vector.method,
				vector.path,
				vector.query,
				vector.body,
			),
		).toBe(vector.authorization);
	});

	it('matches GET canonical RFC 3986 query signing vector', () => {
		const vector = contract.vectors.get_query_signing;
		const canonical = canonicalizeQuery({
			status: ['paid_over', 'paid'],
			project_id: 'prj/a',
			limit: 50,
		});
		expect(canonical).toBe(vector.query);

		const signed = signRequest({
			method: vector.method,
			path: vector.path,
			query: {
				status: ['paid_over', 'paid'],
				project_id: 'prj/a',
				limit: 50,
			},
			body: vector.body,
			publicKey: vector.api_key,
			secretKey: vector.api_secret,
			timestamp: vector.timestamp,
		});
		expect(signed.Authorization).toBe(`HMAC-SHA256 ${vector.api_key}:${vector.signature}`);
		expect(signed['X-Request-Timestamp']).toBe(vector.timestamp);
	});

	it('encodes RFC 3986 reserved characters in path segments and queries', () => {
		expect(encodePathSegment("inv/1 !'()*")).toBe('inv%2F1%20%21%27%28%29%2A');
		expect(canonicalizeQuery({ a: "x!*'()" })).toBe('?a=x%21%2A%27%28%29');
		expect(canonicalizeQuery({})).toBe('');
		expect(() => canonicalizeQuery({ status: [] })).toThrow(TypeError);
		expect(() => canonicalizeQuery({ project_id: '' })).toThrow(TypeError);
	});

	it('verifies the rotated multi-v1 webhook vector', () => {
		const vector = contract.vectors.webhook;
		const verifier = new WebhookVerifier(vector.secret, vector.tolerance_seconds);
		expect(verifier.verify(vector.header, vector.raw_body, vector.now)).toBe(true);
		expect(verifier.verify(vector.header, Buffer.from(vector.raw_body, 'utf8'), vector.now)).toBe(true);
		const event = verifier.constructEvent(vector.header, vector.raw_body, vector.now);
		expect(event.event_id).toBe('evt_123');
		expect(event.event_type).toBe('invoice.paid');
	});

	it('verifies all 16 literal v1/v2 TON webhook vectors and rejects 1-byte tamper', () => {
		const fixtures = contract.vectors.ton_webhooks;
		expect(fixtures.vectors).toHaveLength(16);
		const verifier = new WebhookVerifier(fixtures.secret);
		for (const vector of fixtures.vectors) {
			expect(verifier.verify(vector.header, vector.raw_body, fixtures.now), vector.name).toBe(true);
			const event = verifier.constructEvent<Record<string, unknown>>(
				vector.header,
				vector.raw_body,
				fixtures.now,
			);
			expect(event.event_id).toBe(vector.event_id);
			expect(event.event_type).toBe(vector.event_type);
			expect(event.version).toBe(vector.version);
			expect(event.occurred_at).toBe(fixtures.now);
			for (const expected of vector.expect) {
				let cursor: unknown = event.data;
				for (const segment of expected.path) {
					expect(cursor, `${vector.name}.${segment}`).toHaveProperty(segment);
					cursor = (cursor as Record<string, unknown>)[segment];
				}
				expect(cursor, vector.name).toBe(expected.value);
			}
			expect(verifier.verify(vector.header, `${vector.raw_body} `, fixtures.now), vector.name).toBe(false);
		}
	});
});
