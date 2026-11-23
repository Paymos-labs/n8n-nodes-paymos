import {
	sleep as n8nSleep,
	type ICredentialsDecrypted,
	type ICredentialTestFunctions,
	type IDataObject,
	type IHttpRequestMethods,
	type IHttpRequestOptions,
	type INodeCredentialTestResult,
} from 'n8n-workflow';
import { canonicalizeQuery, signRequest, type QueryParams } from '../crypto/signing';

export const PAYMOS_DEFAULT_BASE_URL = 'https://api.paymos.io';
export const PAYMOS_N8N_USER_AGENT = 'paymos-n8n/0.2.0';
export const PAYMOS_MAX_PAGE_LIMIT = 100;
export const PAYMOS_DEFAULT_PAGE_LIMIT = 20;
export const PAYMOS_DEFAULT_MAX_PAGES = 100;
export const PAYMOS_DEFAULT_MAX_RETRIES = 2;
export const PAYMOS_DEFAULT_BASE_DELAY_MS = 150;
const PAYMOS_MAX_RETRY_DELAY_MS = 30_000;

export type PaymosEnvironment = 'production' | 'sandbox';

export interface PaymosApiCredentials {
	publicKey: string;
	secretKey: string;
	webhookSecret?: string;
	baseUrl?: string;
}

export interface ValidatedPaymosCredentials {
	publicKey: string;
	secretKey: string;
	webhookSecret: string;
	baseUrl: string;
	environment: PaymosEnvironment;
}

export interface PaymosProblemError {
	code: string;
	field?: string | null;
	message: string;
}

export interface PaymosProblemDetails {
	type?: string;
	title?: string;
	status?: number;
	detail?: string;
	code?: string;
	field?: string | null;
	errors?: PaymosProblemError[];
	trace_id?: string;
}

export interface PaymosFullHttpResponse {
	statusCode: number;
	headers?: Record<string, string | string[] | undefined>;
	body?: unknown;
}

export interface PaymosHttpContext {
	helpers: {
		httpRequest: (options: IHttpRequestOptions) => Promise<unknown>;
	};
}

export interface PaymosRequestOptions {
	method: Extract<IHttpRequestMethods, 'GET' | 'POST'>;
	path: string;
	query?: QueryParams;
	body?: IDataObject;
	requireSandbox?: boolean;
	maxRetries?: number;
	baseDelayMs?: number;
	sleep?: (ms: number) => Promise<void>;
	now?: () => number;
}

export interface PaymosPaginateOptions {
	path: string;
	query?: QueryParams;
	returnAll: boolean;
	limit?: number;
	maxPages?: number;
	maxRetries?: number;
	baseDelayMs?: number;
	sleep?: (ms: number) => Promise<void>;
	now?: () => number;
}

export class PaymosApiError extends Error {
	readonly status: number;

	readonly code: string;

	readonly detail: string;

	readonly field: string | null;

	readonly errors: readonly PaymosProblemError[];

	readonly problem: PaymosProblemDetails | null;

	readonly responseBody: string;

	constructor(status: number, responseBody: string) {
		const problem = parseProblemDetails(responseBody);
		const detail = problem?.detail || problem?.code || problem?.title || responseBody || 'Empty response';
		super(`Paymos API ${status}: ${detail}`);
		this.name = 'PaymosApiError';
		this.status = status;
		this.code = problem?.code ?? '';
		this.detail = detail;
		this.field = problem?.field ?? null;
		this.errors = Array.isArray(problem?.errors) ? problem.errors : [];
		this.problem = problem;
		this.responseBody = responseBody;
	}
}

function parseProblemDetails(rawBody: string): PaymosProblemDetails | null {
	if (!rawBody || rawBody.trim() === '') {
		return null;
	}
	try {
		const parsed: unknown = JSON.parse(rawBody);
		if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
			return null;
		}
		return parsed as PaymosProblemDetails;
	} catch {
		return null;
	}
}

function normalizeBaseUrl(rawValue: string): string {
	let parsed: URL;
	try {
		parsed = new URL(rawValue);
	} catch {
		throw new Error('Paymos API Base URL is not a valid URL.');
	}
	const host = parsed.hostname.toLowerCase();
	const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
	if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLoopback)) {
		throw new Error('Paymos API Base URL must use HTTPS (HTTP is allowed only for loopback tests).');
	}
	return rawValue.endsWith('/') ? rawValue.slice(0, -1) : rawValue;
}

export function validatePaymentApiCredentials(
	raw: Partial<PaymosApiCredentials> | undefined,
): ValidatedPaymosCredentials {
	if (!raw || typeof raw !== 'object') {
		throw new Error('Paymos API credentials are required.');
	}

	const publicKey = String(raw.publicKey ?? '').trim();
	const secretKey = String(raw.secretKey ?? '').trim();
	const webhookSecret = String(raw.webhookSecret ?? '').trim();
	const rawBaseUrl = String(raw.baseUrl ?? PAYMOS_DEFAULT_BASE_URL).trim() || PAYMOS_DEFAULT_BASE_URL;

	if (!publicKey) {
		throw new Error('Paymos Public Key is required (expected pk_live_... or pk_test_...).');
	}
	if (publicKey.startsWith('rk_')) {
		throw new Error(
			'Payout API keys (rk_) are not supported in n8n-nodes-paymos v1. Use a Payment API key starting with pk_live_ (Production) or pk_test_ (Sandbox).',
		);
	}

	let environment: PaymosEnvironment;
	if (publicKey.startsWith('pk_live_')) {
		environment = 'production';
	} else if (publicKey.startsWith('pk_test_')) {
		environment = 'sandbox';
	} else {
		throw new Error(
			'Invalid Paymos Public Key prefix. Expected a Payment API key starting with pk_live_ (Production) or pk_test_ (Sandbox).',
		);
	}

	if (!secretKey) {
		throw new Error('Paymos Secret Key is required.');
	}

	const baseUrl = normalizeBaseUrl(rawBaseUrl);

	return {
		publicKey,
		secretKey,
		webhookSecret,
		baseUrl,
		environment,
	};
}

export function validateWebhookSecret(raw: Partial<PaymosApiCredentials> | undefined): string {
	const secret = String(raw?.webhookSecret ?? '').trim();
	if (!secret || !secret.startsWith('whsec_')) {
		throw new Error(
			'Paymos Trigger requires a Webhook Signing Secret (whsec_...) in your Paymos API credentials. Add this node webhook URL in Paymos Dashboard → Developer → Webhooks and paste the generated whsec_ secret.',
		);
	}
	return secret;
}

function normalizeHeaderLookup(
	headers: Record<string, string | string[] | undefined> | undefined,
	name: string,
): string | null {
	if (!headers) {
		return null;
	}
	const lower = name.toLowerCase();
	for (const [key, value] of Object.entries(headers)) {
		if (key.toLowerCase() !== lower || value === undefined) {
			continue;
		}
		return Array.isArray(value) ? (value[0] ?? null) : value;
	}
	return null;
}

function parseRetryAfterMs(headerValue: string | null, nowMs: number): number | null {
	if (!headerValue) {
		return null;
	}
	const trimmed = headerValue.trim();
	if (/^\d+$/.test(trimmed)) {
		return Number(trimmed) * 1000;
	}
	const parsedDate = Date.parse(trimmed);
	return Number.isNaN(parsedDate) ? null : Math.max(0, parsedDate - nowMs);
}

function isFullHttpResponse(value: unknown): value is PaymosFullHttpResponse {
	return (
		value !== null &&
		typeof value === 'object' &&
		'statusCode' in value &&
		typeof (value as PaymosFullHttpResponse).statusCode === 'number'
	);
}

function stringifyBody(body: unknown): string {
	if (body === undefined || body === null) {
		return '';
	}
	if (typeof body === 'string') {
		return body;
	}
	if (Buffer.isBuffer(body)) {
		return body.toString('utf8');
	}
	return JSON.stringify(body);
}

function parseJsonResponse<T>(body: unknown): T {
	if (body === undefined || body === null) {
		return {} as T;
	}
	if (typeof body === 'string') {
		if (body.trim() === '') {
			return {} as T;
		}
		try {
			return JSON.parse(body) as T;
		} catch (error) {
			throw new Error('Paymos API returned invalid JSON.', { cause: error });
		}
	}
	if (Buffer.isBuffer(body)) {
		const text = body.toString('utf8');
		if (text.trim() === '') {
			return {} as T;
		}
		try {
			return JSON.parse(text) as T;
		} catch (error) {
			throw new Error('Paymos API returned invalid JSON.', { cause: error });
		}
	}
	return body as T;
}

export async function paymosApiRequest<T = IDataObject>(
	context: PaymosHttpContext,
	rawCredentials: Partial<PaymosApiCredentials>,
	options: PaymosRequestOptions,
): Promise<T> {
	const creds = validatePaymentApiCredentials(rawCredentials);
	const method = options.method.toUpperCase() as 'GET' | 'POST';

	if ((options.requireSandbox || options.path.startsWith('/v1/sandbox/')) && creds.environment !== 'sandbox') {
		throw new Error(
			'Sandbox simulation operations require a Sandbox Payment API key (pk_test_). Production keys (pk_live_) cannot call /v1/sandbox/* endpoints.',
		);
	}

	const queryString = options.query ? canonicalizeQuery(options.query) : '';
	const bodyString = options.body !== undefined ? JSON.stringify(options.body) : '';
	const url = `${creds.baseUrl}${options.path}${queryString}`;

	const isGet = method === 'GET';
	const maxRetries = isGet ? (options.maxRetries ?? PAYMOS_DEFAULT_MAX_RETRIES) : 0;
	const baseDelayMs = options.baseDelayMs ?? PAYMOS_DEFAULT_BASE_DELAY_MS;
	const wait = options.sleep ?? n8nSleep;
	const now = options.now ?? (() => Date.now());

	let attempt = 0;

	while (true) {
		const timestamp = Math.floor(now() / 1000);
		const signed = signRequest({
			method,
			path: options.path,
			query: queryString,
			body: bodyString,
			publicKey: creds.publicKey,
			secretKey: creds.secretKey,
			timestamp,
		});

		const headers: IDataObject = {
			Authorization: signed.Authorization,
			'X-Request-Timestamp': signed['X-Request-Timestamp'],
			Accept: 'application/json',
			'User-Agent': PAYMOS_N8N_USER_AGENT,
		};
		if (bodyString !== '') {
			headers['Content-Type'] = 'application/json';
		}

		const requestOptions: IHttpRequestOptions = {
			method,
			url,
			headers,
			json: false,
			returnFullResponse: true,
			ignoreHttpStatusErrors: true,
		};
		if (bodyString !== '') {
			requestOptions.body = bodyString;
		}

		try {
			const response = await context.helpers.httpRequest(requestOptions);

			if (!isFullHttpResponse(response)) {
				return parseJsonResponse<T>(response);
			}

			const { statusCode, headers: responseHeaders, body } = response;
			if ((statusCode === 429 || (statusCode >= 500 && statusCode <= 599)) && isGet && attempt < maxRetries) {
				const retryAfter = parseRetryAfterMs(normalizeHeaderLookup(responseHeaders, 'retry-after'), now());
				const backoff = baseDelayMs * 2 ** attempt;
				const delayMs = Math.min(Math.max(backoff, retryAfter ?? 0), PAYMOS_MAX_RETRY_DELAY_MS);
				attempt += 1;
				if (delayMs > 0) {
					await wait(delayMs);
				}
				continue;
			}

			if (statusCode < 200 || statusCode >= 300) {
				throw new PaymosApiError(statusCode, stringifyBody(body));
			}

			return parseJsonResponse<T>(body);
		} catch (error) {
			if (error instanceof PaymosApiError) {
				throw error;
			}
			if (isGet && attempt < maxRetries) {
				const delayMs = Math.min(baseDelayMs * 2 ** attempt, PAYMOS_MAX_RETRY_DELAY_MS);
				attempt += 1;
				if (delayMs > 0) {
					await wait(delayMs);
				}
				continue;
			}
			throw error;
		}
	}
}

interface CursorPageResponse<T> {
	items: T[];
	next_cursor: string | null;
}

const FINITE_KEYSET_PATHS = new Set<string>([
	'/v1/invoices',
	'/v1/payment-channels',
	'/v1/refunds',
]);

export async function paymosApiPaginate<T = IDataObject>(
	context: PaymosHttpContext,
	rawCredentials: Partial<PaymosApiCredentials>,
	options: PaymosPaginateOptions,
): Promise<T[]> {
	if (!FINITE_KEYSET_PATHS.has(options.path)) {
		throw new Error(
			`paymosApiPaginate supports only finite keyset list endpoints (/v1/invoices, /v1/payment-channels, /v1/refunds). Got: ${options.path}`,
		);
	}

	const maxPages = options.maxPages ?? PAYMOS_DEFAULT_MAX_PAGES;
	const targetLimit = options.returnAll
		? Number.POSITIVE_INFINITY
		: Math.max(1, Math.floor(options.limit ?? PAYMOS_DEFAULT_PAGE_LIMIT));

	const baseQuery: QueryParams = { ...(options.query ?? {}) };
	let cursor =
		typeof baseQuery.cursor === 'string' && baseQuery.cursor !== ''
			? baseQuery.cursor
			: undefined;
	delete baseQuery.cursor;
	delete baseQuery.limit;

	const seenCursors = new Set<string>();
	if (cursor !== undefined) {
		seenCursors.add(cursor);
	}

	const results: T[] = [];

	for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
		const remaining = targetLimit - results.length;
		if (remaining <= 0) {
			break;
		}
		const pageLimit = options.returnAll
			? PAYMOS_MAX_PAGE_LIMIT
			: Math.min(remaining, PAYMOS_MAX_PAGE_LIMIT);

		const pageQuery: QueryParams = {
			...baseQuery,
			limit: pageLimit,
		};
		if (cursor !== undefined) {
			pageQuery.cursor = cursor;
		}

		const page = await paymosApiRequest<CursorPageResponse<T>>(context, rawCredentials, {
			method: 'GET',
			path: options.path,
			query: pageQuery,
			maxRetries: options.maxRetries,
			baseDelayMs: options.baseDelayMs,
			sleep: options.sleep,
			now: options.now,
		});

		const items = Array.isArray(page.items) ? page.items : [];
		results.push(...items);

		if (!options.returnAll && results.length >= targetLimit) {
			return results.slice(0, targetLimit);
		}

		const nextCursor =
			typeof page.next_cursor === 'string' && page.next_cursor !== ''
				? page.next_cursor
				: null;
		if (nextCursor === null) {
			break;
		}
		if (nextCursor === cursor || seenCursors.has(nextCursor)) {
			throw new Error('Paymos API returned the same pagination cursor twice.');
		}
		seenCursors.add(nextCursor);
		cursor = nextCursor;
	}

	return options.returnAll ? results : results.slice(0, targetLimit);
}

interface CredentialTestHelperLike {
	httpRequest?: (options: IHttpRequestOptions) => Promise<unknown>;
	request?: (options: Record<string, unknown>) => Promise<unknown>;
}

export async function runPaymosApiCredentialTest(
	context: ICredentialTestFunctions,
	credential: ICredentialsDecrypted,
): Promise<INodeCredentialTestResult> {
	let validated: ValidatedPaymosCredentials;
	try {
		validated = validatePaymentApiCredentials(credential.data as Partial<PaymosApiCredentials>);
	} catch (error) {
		return {
			status: 'Error',
			message: error instanceof Error ? error.message : String(error),
		};
	}

	const helpers = context.helpers as unknown as CredentialTestHelperLike;
	const httpContext: PaymosHttpContext = {
		helpers: {
			httpRequest: async (requestOptions: IHttpRequestOptions) => {
				if (typeof helpers.httpRequest === 'function') {
					return helpers.httpRequest(requestOptions);
				}
				if (typeof helpers.request === 'function') {
					const raw = await helpers.request({
						method: requestOptions.method,
						uri: requestOptions.url,
						headers: requestOptions.headers,
						resolveWithFullResponse: true,
						simple: false,
						json: false,
					});
					return raw;
				}
				throw new Error('n8n credential test HTTP helper is unavailable.');
			},
		},
	};

	try {
		await paymosApiRequest(httpContext, validated, {
			method: 'GET',
			path: '/v1/invoices',
			query: { limit: 1 },
			maxRetries: 0,
		});
		return {
			status: 'OK',
			message: `Connection successful (${validated.environment} environment).`,
		};
	} catch (error) {
		return {
			status: 'Error',
			message: error instanceof Error ? error.message : 'Paymos API credential test failed.',
		};
	}
}
