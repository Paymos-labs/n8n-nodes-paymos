import type {
	IAuthenticate,
	ICredentialDataDecryptedObject,
	ICredentialTestRequest,
	ICredentialType,
	IHttpRequestOptions,
	Icon,
	INodeProperties,
} from 'n8n-workflow';
import { signRequest, type QueryParams } from '../src/crypto/signing';
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
		let path: string;
		let inlineQuery: string | undefined;
		if (/^https?:\/\//i.test(rawUrl)) {
			const parsedUrl = new URL(rawUrl);
			path = parsedUrl.pathname || '/';
			inlineQuery = parsedUrl.search ? parsedUrl.search.slice(1) : undefined;
		} else {
			const [pathPart, queryPart] = rawUrl.split('?', 2);
			path = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
			inlineQuery = queryPart;
		}
		const mergedQuery: QueryParams = { ...((requestOptions.qs as QueryParams | undefined) ?? {}) };
		if (inlineQuery !== undefined && inlineQuery !== '') {
			for (const [k, v] of new URLSearchParams(inlineQuery).entries()) {
				const existing = mergedQuery[k];
				if (existing === undefined) {
					mergedQuery[k] = v;
				} else if (Array.isArray(existing)) {
					existing.push(v);
				} else {
					mergedQuery[k] = [String(existing), v];
				}
			}
		}
		const query: QueryParams | undefined =
			Object.keys(mergedQuery).length > 0 ? mergedQuery : undefined;
		const body =
			requestOptions.body === undefined || requestOptions.body === null
				? ''
				: typeof requestOptions.body === 'string'
					? requestOptions.body
					: JSON.stringify(requestOptions.body);

		const signedHeaders = signRequest({
			method,
			path,
			query,
			body,
			publicKey: validated.publicKey,
			secretKey: validated.secretKey,
		});

		return {
			...requestOptions,
			baseURL: validated.baseUrl,
			headers: {
				...(requestOptions.headers ?? {}),
				...signedHeaders,
				Accept: 'application/json',
				'User-Agent': PAYMOS_N8N_USER_AGENT,
			},
		};
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
