import {
	NodeConnectionTypes,
	type ICredentialsDecrypted,
	type ICredentialTestFunctions,
	type IDataObject,
	type IHookFunctions,
	type INodeCredentialTestResult,
	type INodeType,
	type INodeTypeDescription,
	type IWebhookFunctions,
	type IWebhookResponseData,
} from 'n8n-workflow';
import {
	DEFAULT_WEBHOOK_TOLERANCE_SECONDS,
	parseWebhookEvent,
} from '../../src/crypto/webhooks';
import {
	runPaymosApiCredentialTest,
	validateWebhookSecret,
	type PaymosApiCredentials,
} from '../../src/transport/PaymosTransport';

export const PAYMOS_CANONICAL_WEBHOOK_EVENTS = [
	'invoice.awaiting_payment',
	'invoice.confirming',
	'invoice.underpaid_waiting',
	'invoice.paid',
	'invoice.paid_over',
	'invoice.underpaid',
	'invoice.expired',
	'invoice.cancelled',
	'invoice.paid_late',
	'payment_channel.deposit.confirming',
	'payment_channel.deposit.reorged',
	'payment_channel.deposit.confirmed',
	'withdrawal.created',
	'withdrawal.processing',
	'withdrawal.completed',
	'withdrawal.failed',
	'withdrawal.cancelled',
	'withdrawal.completion_rewound',
] as const;

interface RawBodyRequest {
	rawBody?: Buffer | string;
	headers?: Record<string, string | string[] | undefined>;
}

const INVALID_WEBHOOK_SIGNATURE_PROBLEM = {
	type: 'about:blank',
	title: 'Unauthorized',
	status: 401,
	detail: 'Invalid webhook signature.',
	code: 'webhook_signature_invalid',
} as const;

function rejectInvalidWebhookSignature(
	res: ReturnType<IWebhookFunctions['getResponseObject']>,
): IWebhookResponseData {
	res.setHeader?.('Content-Type', 'application/problem+json');
	res.status(401).json(INVALID_WEBHOOK_SIGNATURE_PROBLEM);
	return { noWebhookResponse: true };
}

function readSignatureHeader(
	headers: Record<string, string | string[] | undefined> | undefined,
): string {
	if (!headers) {
		return '';
	}
	for (const [key, value] of Object.entries(headers)) {
		if (key.toLowerCase() !== 'x-webhook-signature' || value === undefined) {
			continue;
		}
		return Array.isArray(value) ? (value[0] ?? '') : value;
	}
	return '';
}

export class PaymosTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Paymos Trigger',
		name: 'paymosTrigger',
		icon: {
			light: 'file:../Paymos/paymos.svg',
			dark: 'file:../Paymos/paymos.dark.svg',
		},
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts a workflow when verified Paymos webhook events arrive',
		defaults: {
			name: 'Paymos Trigger',
		},
		usableAsTool: undefined,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'paymosApi',
				required: true,
				testedBy: 'paymosApiTest',
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				default: ['invoice.paid'],
				description:
					'Paymos webhook events that should trigger this workflow. Add the webhook URL in Paymos Dashboard → Developer → Webhooks and configure whsec_ in Paymos API credentials.',
				options: [
					{
						name: 'All Events (*)',
						value: '*',
						description: 'Trigger on any verified Paymos webhook event',
					},
					{
						name: 'Invoice Awaiting Payment',
						value: 'invoice.awaiting_payment',
						description: 'A deep reorg regressed the invoice back to awaiting_payment',
					},
					{
						name: 'Invoice Cancelled',
						value: 'invoice.cancelled',
						description: 'The merchant cancelled the invoice',
					},
					{
						name: 'Invoice Confirming',
						value: 'invoice.confirming',
						description: 'A payment was detected and is waiting for blockchain finality',
					},
					{
						name: 'Invoice Expired',
						value: 'invoice.expired',
						description: 'The invoice expired without a qualifying payment',
					},
					{
						name: 'Invoice Paid',
						value: 'invoice.paid',
						description: 'The expected invoice amount was paid',
					},
					{
						name: 'Invoice Paid Late',
						value: 'invoice.paid_late',
						description: 'Funds covered the invoice after it already closed as expired or underpaid',
					},
					{
						name: 'Invoice Paid Over',
						value: 'invoice.paid_over',
						description: 'More than the expected amount was paid and credited in full',
					},
					{
						name: 'Invoice Underpaid',
						value: 'invoice.underpaid',
						description: 'The invoice reached a final underpaid state',
					},
					{
						name: 'Invoice Underpaid Waiting',
						value: 'invoice.underpaid_waiting',
						description: 'A partial payment arrived and the invoice still accepts more funds',
					},
					{
						name: 'Payment Channel Deposit Confirmed',
						value: 'payment_channel.deposit.confirmed',
						description: 'A channel deposit reached finality and credited your balance',
					},
					{
						name: 'Payment Channel Deposit Confirming',
						value: 'payment_channel.deposit.confirming',
						description: 'A transfer arrived at a channel address and awaits confirmation (advisory)',
					},
					{
						name: 'Payment Channel Deposit Reorged',
						value: 'payment_channel.deposit.reorged',
						description: 'A chain reorg dropped an unconfirmed deposit (advisory)',
					},
					{
						name: 'Withdrawal Cancelled',
						value: 'withdrawal.cancelled',
						description: 'A withdrawal or refund was cancelled before completion',
					},
					{
						name: 'Withdrawal Completed',
						value: 'withdrawal.completed',
						description: 'A withdrawal or refund completed on-chain',
					},
					{
						name: 'Withdrawal Completion Rewound',
						value: 'withdrawal.completion_rewound',
						description: 'A chain reorg rewound a completed payout back to signed',
					},
					{
						name: 'Withdrawal Created',
						value: 'withdrawal.created',
						description: 'A withdrawal or refund was accepted and created',
					},
					{
						name: 'Withdrawal Failed',
						value: 'withdrawal.failed',
						description: 'A withdrawal or refund failed and returned funds to available balance',
					},
					{
						name: 'Withdrawal Processing',
						value: 'withdrawal.processing',
						description: 'An outgoing transaction was broadcast on-chain with a tx hash',
					},
				],
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Timestamp Tolerance (Seconds)',
						name: 'toleranceSeconds',
						type: 'number',
						typeOptions: {
							minValue: 0,
							maxValue: 3600,
						},
						default: DEFAULT_WEBHOOK_TOLERANCE_SECONDS,
						description: 'Maximum allowed clock skew between X-Webhook-Signature timestamp and server time',
					},
				],
			},
		],
	};

	methods = {
		credentialTest: {
			async paymosApiTest(
				this: ICredentialTestFunctions,
				credential: ICredentialsDecrypted,
			): Promise<INodeCredentialTestResult> {
				return runPaymosApiCredentialTest(this, credential);
			},
		},
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const credentials = (await this.getCredentials('paymosApi')) as Partial<PaymosApiCredentials>;
				validateWebhookSecret(credentials);
				return true;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				const credentials = (await this.getCredentials('paymosApi')) as Partial<PaymosApiCredentials>;
				validateWebhookSecret(credentials);
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject() as unknown as RawBodyRequest;
		const res = this.getResponseObject();

		let webhookSecret: string;
		try {
			const credentials = (await this.getCredentials('paymosApi')) as Partial<PaymosApiCredentials>;
			webhookSecret = validateWebhookSecret(credentials);
		} catch {
			return rejectInvalidWebhookSignature(res);
		}

		const rawBody = req?.rawBody;
		if (rawBody === undefined || rawBody === null || (typeof rawBody !== 'string' && !Buffer.isBuffer(rawBody))) {
			return rejectInvalidWebhookSignature(res);
		}

		const headerData = this.getHeaderData() as Record<string, string | string[] | undefined> | undefined;
		const signatureHeader = readSignatureHeader(headerData) || readSignatureHeader(req?.headers);
		const options = this.getNodeParameter('options', {}) as IDataObject;
		const toleranceSeconds =
			typeof options.toleranceSeconds === 'number'
				? options.toleranceSeconds
				: DEFAULT_WEBHOOK_TOLERANCE_SECONDS;

		let event;
		try {
			event = parseWebhookEvent<IDataObject>(rawBody, signatureHeader, webhookSecret, toleranceSeconds);
		} catch {
			return rejectInvalidWebhookSignature(res);
		}

		const subscribedEvents = this.getNodeParameter('events', []) as string[];
		const matched = subscribedEvents.includes('*') || subscribedEvents.includes(event.event_type);

		if (!matched) {
			return {
				webhookResponse: { received: true, ignored: true },
			};
		}

		return {
			webhookResponse: { received: true },
			workflowData: [this.helpers.returnJsonArray([event as unknown as IDataObject])],
		};
	}
}
