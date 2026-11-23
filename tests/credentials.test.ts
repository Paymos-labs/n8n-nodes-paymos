/* eslint-disable @n8n/community-nodes/no-restricted-imports */
import type { ICredentialsDecrypted, ICredentialTestFunctions } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';
import { PaymosApi } from '../credentials/PaymosApi.credentials';
import { Paymos } from '../nodes/Paymos/Paymos.node';
import { PaymosTrigger } from '../nodes/PaymosTrigger/PaymosTrigger.node';
import { validatePaymentApiCredentials } from '../src/transport/PaymosTransport';

describe('PaymosApi credential & programmatic paymosApiTest', () => {
	it('defines the PaymosApi credential contract strictly per n8n naming conventions', () => {
		const credential = new PaymosApi();
		expect(credential.name).toBe('paymosApi');
		expect(credential.displayName).toBe('Paymos API');
		expect(credential.documentationUrl).toBe('https://paymos.io/docs/n8n');

		const fields = new Map(credential.properties.map((prop) => [prop.name, prop]));
		expect(fields.get('publicKey')?.required).toBe(true);
		expect(fields.get('secretKey')?.required).toBe(true);
		expect(fields.get('secretKey')?.typeOptions).toEqual({ password: true });
		expect(fields.get('webhookSecret')?.required).toBe(false);
		expect(fields.get('webhookSecret')?.typeOptions).toEqual({ password: true });
		expect(fields.get('baseUrl')?.default).toBe('https://api.paymos.io');

		// Declarative credential test & HMAC authenticate function for n8n Creator Portal scanner
		expect(credential.test).toEqual({
			request: {
				baseURL: '={{$credentials.baseUrl}}',
				url: '/v1/invoices',
				method: 'GET',
				qs: {
					limit: 1,
				},
			},
		});
		expect(typeof credential.authenticate).toBe('function');
	});

	it('signs declarative test requests via PaymosApi.authenticate and rejects rk_ keys', async () => {
		const credential = new PaymosApi();
		if (typeof credential.authenticate !== 'function') {
			throw new Error('Expected functional authenticate');
		}
		const signed = await credential.authenticate(
			{
				publicKey: 'pk_test_decl',
				secretKey: 'sk_test_secret',
				baseUrl: 'https://api.paymos.io',
			},
			{
				baseURL: 'https://api.paymos.io',
				url: '/v1/invoices',
				method: 'GET',
				qs: { limit: 1 },
			},
		);
		expect(signed.baseURL).toBe('https://api.paymos.io');
		expect((signed.headers as Record<string, string>).Authorization).toMatch(
			/^HMAC-SHA256 pk_test_decl:[A-Za-z0-9+/=]+$/,
		);
		expect((signed.headers as Record<string, string>)['X-Request-Timestamp']).toMatch(/^\d+$/);

		const signedAbsolute = await credential.authenticate(
			{
				publicKey: 'pk_test_decl',
				secretKey: 'sk_test_secret',
				baseUrl: 'https://api.paymos.io',
			},
			{
				url: 'https://api.paymos.io/v1/invoices?limit=1',
				method: 'GET',
			},
		);
		expect((signedAbsolute.headers as Record<string, string>).Authorization).toMatch(
			/^HMAC-SHA256 pk_test_decl:[A-Za-z0-9+/=]+$/,
		);

		await expect(
			credential.authenticate(
				{
					publicKey: 'rk_live_payout',
					secretKey: 'sk_live_secret',
				},
				{ url: '/v1/invoices', method: 'GET' },
			),
		).rejects.toThrow(/Payout API keys \(rk_\) are not supported/);
	});

	it('accepts pk_live_ (production) and pk_test_ (sandbox) and rejects rk_ and invalid prefixes', () => {
		const prod = validatePaymentApiCredentials({
			publicKey: 'pk_live_abc',
			secretKey: 'sk_live_secret',
		});
		expect(prod.environment).toBe('production');
		expect(prod.baseUrl).toBe('https://api.paymos.io');

		const sandbox = validatePaymentApiCredentials({
			publicKey: 'pk_test_xyz',
			secretKey: 'sk_test_secret',
			baseUrl: 'https://api.paymos.io/',
		});
		expect(sandbox.environment).toBe('sandbox');
		expect(sandbox.baseUrl).toBe('https://api.paymos.io');

		expect(() =>
			validatePaymentApiCredentials({
				publicKey: 'rk_live_payout',
				secretKey: 'sk_live_secret',
			}),
		).toThrow(/Payout API keys \(rk_\) are not supported/);

		expect(() =>
			validatePaymentApiCredentials({
				publicKey: 'rk_test_payout',
				secretKey: 'sk_test_secret',
			}),
		).toThrow(/Payout API keys \(rk_\) are not supported/);

		expect(() =>
			validatePaymentApiCredentials({
				publicKey: 'bad_prefix_123',
				secretKey: 'sk_test_secret',
			}),
		).toThrow(/Invalid Paymos Public Key prefix/);

		expect(() =>
			validatePaymentApiCredentials({
				publicKey: 'pk_test_xyz',
				secretKey: '',
			}),
		).toThrow(/Secret Key is required/);

		expect(() =>
			validatePaymentApiCredentials({
				publicKey: 'pk_test_xyz',
				secretKey: 'sk_test_secret',
				baseUrl: 'http://api.paymos.io',
			}),
		).toThrow(/must use HTTPS/);

		const local = validatePaymentApiCredentials({
			publicKey: 'pk_test_xyz',
			secretKey: 'sk_test_secret',
			baseUrl: 'http://127.0.0.1:5000',
		});
		expect(local.baseUrl).toBe('http://127.0.0.1:5000');
	});

	it('wires testedBy: paymosApiTest on both Paymos and PaymosTrigger and signs GET /v1/invoices?limit=1', async () => {
		const paymosNode = new Paymos();
		const triggerNode = new PaymosTrigger();

		expect(paymosNode.description.credentials).toEqual([
			{ name: 'paymosApi', required: true, testedBy: 'paymosApiTest' },
		]);
		expect(triggerNode.description.credentials).toEqual([
			{ name: 'paymosApi', required: true, testedBy: 'paymosApiTest' },
		]);

		const httpRequest = vi.fn().mockResolvedValue({
			statusCode: 200,
			headers: {},
			body: JSON.stringify({ items: [], next_cursor: null }),
		});
		const context = { helpers: { httpRequest } } as unknown as ICredentialTestFunctions;

		const okResult = await paymosNode.methods.credentialTest.paymosApiTest.call(context, {
			id: '1',
			name: 'Paymos Sandbox',
			type: 'paymosApi',
			data: {
				publicKey: 'pk_test_key',
				secretKey: 'sk_test_secret',
				baseUrl: 'https://api.paymos.io',
			},
		} as ICredentialsDecrypted);

		expect(okResult.status).toBe('OK');
		expect(okResult.message).toContain('sandbox');
		expect(httpRequest).toHaveBeenCalledTimes(1);
		const req = httpRequest.mock.calls[0]?.[0] as {
			method: string;
			url: string;
			headers: Record<string, string>;
		};
		expect(req.method).toBe('GET');
		expect(req.url).toBe('https://api.paymos.io/v1/invoices?limit=1');
		expect(req.headers.Authorization).toMatch(/^HMAC-SHA256 pk_test_key:[A-Za-z0-9+/=]+$/);
		expect(req.headers['X-Request-Timestamp']).toMatch(/^\d+$/);

		// rk_ payout key must fail BEFORE issuing any HTTP request
		httpRequest.mockClear();
		const rkResult = await triggerNode.methods.credentialTest.paymosApiTest.call(context, {
			id: '2',
			name: 'Wrong Key',
			type: 'paymosApi',
			data: {
				publicKey: 'rk_live_payout',
				secretKey: 'sk_live_secret',
				baseUrl: 'https://api.paymos.io',
			},
		} as ICredentialsDecrypted);

		expect(rkResult.status).toBe('Error');
		expect(rkResult.message).toContain('rk_');
		expect(httpRequest).not.toHaveBeenCalled();

		// 401 from API surfaces as Error
		httpRequest.mockResolvedValueOnce({
			statusCode: 401,
			headers: {},
			body: JSON.stringify({
				type: 'about:blank',
				title: 'Unauthorized',
				status: 401,
				detail: 'Invalid HMAC signature.',
				code: 'invalid_signature',
			}),
		});
		const failResult = await paymosNode.methods.credentialTest.paymosApiTest.call(context, {
			id: '3',
			name: 'Bad Secret',
			type: 'paymosApi',
			data: {
				publicKey: 'pk_live_key',
				secretKey: 'sk_wrong',
				baseUrl: 'https://api.paymos.io',
			},
		} as ICredentialsDecrypted);

		expect(failResult.status).toBe('Error');
		expect(failResult.message).toContain('401');
	});
});
