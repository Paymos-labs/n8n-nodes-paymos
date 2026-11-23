import type {
	IAuthenticate,
	ICredentialDataDecryptedObject,
	ICredentialTestRequest,
	ICredentialType,
	IDataObject,
	IHttpRequestOptions,
	Icon,
	INodeProperties,
} from 'n8n-workflow';
import { canonicalizeQuery, signRequest, type QueryParams } from '../src/crypto/signing';
import {
	PAYMOS_N8N_USER_AGENT,
	validatePaymentApiCredentials,
} from '../src/transport/PaymosTransport';

export class PaymosApi implements ICredentialType {
	name = 'paymosApi';

	displayName = 'Paymos API';

	icon: Icon = {
		light: 'file:../nodes/Paymos/paymos.svg',
		dark: 'file:../nodes/Paymos/paymos.dark.svg',
	};

	documentationUrl = 'https://paymos.io/docs/n8n';

	properties: INodeProperties[] = [
		{
			displayName: 'Public Key',
			name: 'publicKey',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'pk_live_... or pk_test_...',
			description:
				'Payment API public key (pk_live_ for Production or pk_test_ for Sandbox). Payout keys (rk_) are not supported.',
		},
		{
			displayName: 'Secret Key',
			name: 'secretKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			placeholder: 'sk_live_... or sk_test_...',
			description: 'Payment API secret key used to sign Merchant API requests with HMAC-SHA256',
		},
		{
			displayName: 'Webhook Signing Secret',
			name: 'webhookSecret',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: false,
			placeholder: 'whsec_...',
			description:
				'Optional signing secret (whsec_...) from Dashboard → Developer → Webhooks. Required only when activating the Paymos Trigger node.',
		},
		{
			displayName: 'API Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.paymos.io',
			required: true,
			description:
				'Paymos Merchant API base URL. Keep https://api.paymos.io for both Production and Sandbox.',
		},
	];

	authenticate: IAuthenticate = async (
		credentials: ICredentialDataDecryptedObject,
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> => {
		const validated = validatePaymentApiCredentials({
			publicKey: String(credentials.publicKey ?? ''),
			secretKey: String(credentials.secretKey ?? ''),
			webhookSecret:
				credentials.webhookSecret === undefined ? undefined : String(credentials.webhookSecret),
			baseUrl: credentials.baseUrl === undefined ? undefined : String(credentials.baseUrl),
		});

		const method = (requestOptions.method ?? 'GET').toUpperCase();
		const rawUrl = typeof requestOptions.url === 'string' ? requestOptions.url : '/v1/invoices';
		const isAbsolute = /^https?:\/\//i.test(rawUrl);
		let originPrefix = '';
		let path: string;
		let inlineQuery: string | undefined;
		if (isAbsolute) {
			const parsedUrl = new URL(rawUrl);
			originPrefix = parsedUrl.origin;
			path = parsedUrl.pathname || '/';
			inlineQuery = parsedUrl.search ? parsedUrl.search.slice(1) : undefined;
		} else {
			const withoutHash = rawUrl.split('#')[0] ?? rawUrl;
			const queryIdx = withoutHash.indexOf('?');
			const pathPart = queryIdx === -1 ? withoutHash : withoutHash.slice(0, queryIdx);
			inlineQuery = queryIdx === -1 ? undefined : withoutHash.slice(queryIdx + 1);
			path = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
		}

		const mergedQuery: QueryParams = {};
		const rawQs = requestOptions.qs as QueryParams | undefined;
		if (rawQs) {
			for (const [k, v] of Object.entries(rawQs)) {
				mergedQuery[k] = Array.isArray(v) ? [...v] : v;
			}
		}
		if (inlineQuery !== undefined && inlineQuery !== '') {
			for (const [k, v] of new URLSearchParams(inlineQuery).entries()) {
				const existing = mergedQuery[k];
				if (existing === undefined) {
					mergedQuery[k] = v;
				} else if (Array.isArray(existing)) {
					mergedQuery[k] = [...existing, v];
				} else {
					mergedQuery[k] = [String(existing), v];
				}
			}
		}
		const canonicalQuery =
			Object.keys(mergedQuery).length > 0 ? canonicalizeQuery(mergedQuery) : '';

		let serializedBody = '';
		let replaceBody = false;
		if (requestOptions.body !== undefined && requestOptions.body !== null) {
			if (typeof requestOptions.body === 'string') {
				serializedBody = requestOptions.body;
			} else if (Buffer.isBuffer(requestOptions.body)) {
				serializedBody = requestOptions.body.toString('utf8');
			} else {
				serializedBody = JSON.stringify(requestOptions.body);
				replaceBody = true;
			}
		}

		const signedHeaders = signRequest({
			method,
			path,
			query: canonicalQuery,
			body: serializedBody,
			publicKey: validated.publicKey,
			secretKey: validated.secretKey,
		});

		const existingHeaders = { ...(requestOptions.headers ?? {}) };
		const hasContentType = Object.keys(existingHeaders).some(
			(key) => key.toLowerCase() === 'content-type',
		);
		const headers: IDataObject = {
			...existingHeaders,
			...signedHeaders,
			Accept: 'application/json',
			'User-Agent': PAYMOS_N8N_USER_AGENT,
		};
		if (replaceBody && serializedBody !== '' && !hasContentType) {
			headers['Content-Type'] = 'application/json';
		}

		const nextOptions: IHttpRequestOptions = {
			...requestOptions,
			url: isAbsolute ? `${originPrefix}${path}${canonicalQuery}` : `${path}${canonicalQuery}`,
			qs: undefined,
			headers,
		};
		if (!isAbsolute) {
			nextOptions.baseURL = validated.baseUrl;
		}
		if (replaceBody) {
			nextOptions.body = serializedBody;
			nextOptions.json = false;
		}
		return nextOptions;
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/v1/invoices',
			method: 'GET',
			qs: {
				limit: 1,
			},
		},
	};
}
