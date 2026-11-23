/* eslint-disable @n8n/community-nodes/no-restricted-imports */
import type { IDataObject, IExecuteFunctions, INode, INodePropertyOptions } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';
import { Paymos } from '../nodes/Paymos/Paymos.node';
import {
	paymosApiPaginate,
	paymosApiRequest,
	type PaymosApiCredentials,
	type PaymosHttpContext,
} from '../src/transport/PaymosTransport';

const sandboxCredentials: PaymosApiCredentials = {
	publicKey: 'pk_test_demo_key',
	secretKey: 'sk_test_demo_secret',
	baseUrl: 'https://api.paymos.io',
};

const productionCredentials: PaymosApiCredentials = {
	publicKey: 'pk_live_demo_key',
	secretKey: 'sk_live_demo_secret',
	baseUrl: 'https://api.paymos.io',
};

function createExecuteContext(options: {
	credentials?: Partial<PaymosApiCredentials>;
	params: Record<string, unknown>;
	itemCount?: number;
	continueOnFail?: boolean;
	httpRequest: ReturnType<typeof vi.fn>;
}): IExecuteFunctions {
	const itemCount = options.itemCount ?? 1;
	const inputItems = Array.from({ length: itemCount }, (_, i) => ({ json: { index: i } }));
	const node = { name: 'Paymos', type: 'n8n-nodes-paymos.paymos', typeVersion: 1 } as INode;

	return {
		getInputData: () => inputItems,
		getCredentials: vi.fn().mockResolvedValue(options.credentials ?? sandboxCredentials),
		getNodeParameter: (name: string, _itemIndex: number, fallback?: unknown) => {
			if (name in options.params) {
				return options.params[name];
			}
			return fallback;
		},
		continueOnFail: () => Boolean(options.continueOnFail),
		getNode: () => node,
		helpers: {
			httpRequest: options.httpRequest,
		},
	} as unknown as IExecuteFunctions;
}

describe('Paymos action node', () => {
	it('exposes exactly 4 resources (18 operations) and excludes Withdrawal and Balance', () => {
		const node = new Paymos();
		const resourceProp = node.description.properties.find((p) => p.name === 'resource');
		const resources = (resourceProp?.options as INodePropertyOptions[]).map((o) => o.value);
		expect(resources).toEqual(['invoice', 'paymentChannel', 'paymentChannelDeposit', 'refund']);
		expect(resources).not.toContain('withdrawal');
		expect(resources).not.toContain('balance');

		const opsByResource = new Map<string, string[]>();
		for (const prop of node.description.properties) {
			if (prop.name !== 'operation') continue;
			const targetResource = prop.displayOptions?.show?.resource?.[0] as string;
			const opValues = (prop.options as INodePropertyOptions[]).map((o) => String(o.value));
			opsByResource.set(targetResource, opValues);
		}

		expect(opsByResource.get('invoice')).toHaveLength(6);
		expect(opsByResource.get('paymentChannel')).toHaveLength(6);
		expect(opsByResource.get('paymentChannelDeposit')).toHaveLength(2);
		expect(opsByResource.get('refund')).toHaveLength(4);

		// Payment Channel Deposit: Get Many must NOT have returnAll
		const depositReturnAll = node.description.properties.find(
			(p) =>
				p.name === 'returnAll' &&
				p.displayOptions?.show?.resource?.includes('paymentChannelDeposit'),
		);
		expect(depositReturnAll).toBeUndefined();
	});

	it('creates an invoice with optional products[] and signs exact snake_case wire body', async () => {
		const httpRequest = vi.fn().mockResolvedValue({
			statusCode: 201,
			headers: {},
			body: JSON.stringify({
				invoice_id: 'inv_prod_1',
				status: 'awaiting_client',
				payment_url: 'https://pay.paymos.io/i/inv_prod_1',
			}),
		});
		const node = new Paymos();
		const ctx = createExecuteContext({
			httpRequest,
			params: {
				resource: 'invoice',
				operation: 'create',
				projectId: 'prj_1',
				amount: '47.00',
				currency: 'USD',
				externalOrderId: 'order-1',
				additionalFields: {
					clientId: 'cust-7',
					customerFeePercent: 50,
					products: {
						productValues: [
							{
								title: 'Studio Pro',
								description: 'One-month access',
								quantity: 2,
								unitAmount: '24.50',
							},
							{
								title: 'Priority Support',
								description: '',
								quantity: 1,
								unitAmount: '12.00',
							},
						],
					},
				},
			},
		});

		const output = await node.execute.call(ctx);
		expect(output[0]).toHaveLength(1);
		expect(output[0][0].json.invoice_id).toBe('inv_prod_1');
		expect(output[0][0].pairedItem).toEqual({ item: 0 });

		const call = httpRequest.mock.calls[0]?.[0] as { method: string; url: string; body: string };
		expect(call.method).toBe('POST');
		expect(call.url).toBe('https://api.paymos.io/v1/invoices');
		expect(JSON.parse(call.body)).toEqual({
			project_id: 'prj_1',
			amount: '47.00',
			currency: 'USD',
			external_order_id: 'order-1',
			customer_fee_percent: 50,
			client_id: 'cust-7',
			products: [
				{
					title: 'Studio Pro',
					description: 'One-month access',
					quantity: 2,
					unit_amount: '24.50',
				},
				{
					title: 'Priority Support',
					quantity: 1,
					unit_amount: '12.00',
				},
			],
		});
	});

	it('sends empty body on Payment Channel Block/Unblock and strict 3-field body on Refund Create', async () => {
		const httpRequest = vi
			.fn()
			.mockResolvedValueOnce({
				statusCode: 200,
				headers: {},
				body: JSON.stringify({ id: 'pch_1', status: 'blocked' }),
			})
			.mockResolvedValueOnce({
				statusCode: 201,
				headers: {},
				body: JSON.stringify({ withdrawal_id: 'wdr_1', invoice_id: 'inv_1', mode: 'overpayment' }),
			});

		const node = new Paymos();

		const blockOut = await node.execute.call(
			createExecuteContext({
				httpRequest,
				params: {
					resource: 'paymentChannel',
					operation: 'block',
					paymentChannelId: 'pch_1',
				},
			}),
		);
		expect(blockOut[0][0].json.status).toBe('blocked');
		const blockReq = httpRequest.mock.calls[0]?.[0] as {
			method: string;
			url: string;
			body?: string;
			headers: Record<string, string>;
		};
		expect(blockReq.method).toBe('POST');
		expect(blockReq.url).toBe('https://api.paymos.io/v1/payment-channels/pch_1/block');
		expect(blockReq.body).toBeUndefined();
		expect(blockReq.headers['Content-Type']).toBeUndefined();

		const refundOut = await node.execute.call(
			createExecuteContext({
				httpRequest,
				params: {
					resource: 'refund',
					operation: 'create',
					refundInvoiceId: 'inv_1',
					refundMode: 'overpayment',
					refundExternalOrderId: 'ref-1',
				},
			}),
		);
		expect(refundOut[0][0].json.withdrawal_id).toBe('wdr_1');
		const refundReq = httpRequest.mock.calls[1]?.[0] as { method: string; url: string; body: string };
		expect(refundReq.url).toBe('https://api.paymos.io/v1/refunds');
		expect(Object.keys(JSON.parse(refundReq.body)).sort()).toEqual([
			'external_order_id',
			'invoice_id',
			'mode',
		]);
	});

	it('allows /v1/sandbox/* with pk_test_ and rejects pk_live_ before any HTTP request', async () => {
		const node = new Paymos();
		const sandboxCases = [
			{
				params: {
					resource: 'invoice',
					operation: 'simulatePayment',
					invoiceId: 'inv_1',
					stage: 'paid',
				},
				expectedUrl: 'https://api.paymos.io/v1/sandbox/invoices/inv_1/simulate-payment',
			},
			{
				params: {
					resource: 'paymentChannel',
					operation: 'simulateDeposit',
					paymentChannelId: 'pch_1',
					depositAmount: '100.00',
					depositCurrency: 'USDT',
					depositNetwork: 'TRC20',
					depositStage: 'confirmed',
				},
				expectedUrl: 'https://api.paymos.io/v1/sandbox/payment-channels/pch_1/simulate-deposit',
			},
			{
				params: {
					resource: 'refund',
					operation: 'simulate',
					refundId: 'wdr_1',
					refundStatus: 'completed',
				},
				expectedUrl: 'https://api.paymos.io/v1/sandbox/refunds/wdr_1/simulate',
			},
		];

		for (const testCase of sandboxCases) {
			const liveHttp = vi.fn();
			await expect(
				node.execute.call(
					createExecuteContext({
						credentials: productionCredentials,
						httpRequest: liveHttp,
						params: testCase.params,
					}),
				),
			).rejects.toThrow(/pk_test_/);
			expect(liveHttp).not.toHaveBeenCalled();

			const testHttp = vi.fn().mockResolvedValue({
				statusCode: 200,
				headers: {},
				body: JSON.stringify({ ok: true }),
			});
			const out = await node.execute.call(
				createExecuteContext({
					credentials: sandboxCredentials,
					httpRequest: testHttp,
					params: testCase.params,
				}),
			);
			expect(out[0][0].json).toEqual({ ok: true });
			expect((testHttp.mock.calls[0]?.[0] as { url: string }).url).toBe(testCase.expectedUrl);
		}
	});

	it('paginates finite keyset lists with returnAll=true and aborts on repeated cursor', async () => {
		const httpRequest = vi
			.fn()
			.mockResolvedValueOnce({
				statusCode: 200,
				headers: {},
				body: JSON.stringify({
					items: [{ invoice_id: 'inv_1' }, { invoice_id: 'inv_2' }],
					next_cursor: 'cur_2',
				}),
			})
			.mockResolvedValueOnce({
				statusCode: 200,
				headers: {},
				body: JSON.stringify({
					items: [{ invoice_id: 'inv_3' }],
					next_cursor: null,
				}),
			});

		const node = new Paymos();
		const output = await node.execute.call(
			createExecuteContext({
				httpRequest,
				params: {
					resource: 'invoice',
					operation: 'getMany',
					returnAll: true,
					filters: { status: ['paid', 'paid_over'] },
				},
			}),
		);

		expect(httpRequest).toHaveBeenCalledTimes(2);
		expect(output[0].map((item) => item.json.invoice_id)).toEqual(['inv_1', 'inv_2', 'inv_3']);

		// Repeated cursor guard
		const loopHttp = vi
			.fn()
			.mockResolvedValueOnce({
				statusCode: 200,
				headers: {},
				body: JSON.stringify({ items: [{ id: 'pch_1' }], next_cursor: 'cur_stuck' }),
			})
			.mockResolvedValueOnce({
				statusCode: 200,
				headers: {},
				body: JSON.stringify({ items: [{ id: 'pch_2' }], next_cursor: 'cur_stuck' }),
			});

		await expect(
			paymosApiPaginate({ helpers: { httpRequest: loopHttp } } as PaymosHttpContext, sandboxCredentials, {
				path: '/v1/payment-channels',
				returnAll: true,
			}),
		).rejects.toThrow(/same pagination cursor twice/);

		// paymosApiPaginate must refuse /v1/payment-channel-deposits directly
		await expect(
			paymosApiPaginate({ helpers: { httpRequest: vi.fn() } } as PaymosHttpContext, sandboxCredentials, {
				path: '/v1/payment-channel-deposits',
				returnAll: true,
			}),
		).rejects.toThrow(/finite keyset list/);
	});

	it('polls Payment Channel Deposit: Get Many in a single request and returns { items, next_cursor, blocked? }', async () => {
		const quietBlockedPage = {
			items: [],
			next_cursor: 'feed_cursor_42',
			blocked: {
				deposit_id: 'pcd_stuck_1',
				reason: 'booked_auth_missing',
			},
		};
		const httpRequest = vi.fn().mockResolvedValue({
			statusCode: 200,
			headers: {},
			body: JSON.stringify(quietBlockedPage),
		});

		const node = new Paymos();
		const output = await node.execute.call(
			createExecuteContext({
				httpRequest,
				params: {
					resource: 'paymentChannelDeposit',
					operation: 'getMany',
					depositFeedLimit: 50,
					depositFeedCursor: 'feed_cursor_41',
					depositFilters: {
						projectId: 'prj_1',
						paymentChannelId: 'pch_9',
						confirmedFrom: 1700000000,
					},
				},
			}),
		);

		expect(httpRequest).toHaveBeenCalledTimes(1);
		const reqUrl = (httpRequest.mock.calls[0]?.[0] as { url: string }).url;
		expect(reqUrl).toBe(
			'https://api.paymos.io/v1/payment-channel-deposits?confirmed_from=1700000000&cursor=feed_cursor_41&limit=50&payment_channel_id=pch_9&project_id=prj_1',
		);
		expect(output[0]).toHaveLength(1);
		expect(output[0][0].json).toEqual(quietBlockedPage);
	});

	it('retries 429/5xx strictly for GET (honoring Retry-After) and never retries POST mutations', async () => {
		const sleepMock = vi.fn().mockResolvedValue(undefined);
		const getHttp = vi
			.fn()
			.mockResolvedValueOnce({
				statusCode: 429,
				headers: { 'Retry-After': '1' },
				body: JSON.stringify({ status: 429, detail: 'Rate limit exceeded', code: 'rate_limit' }),
			})
			.mockResolvedValueOnce({
				statusCode: 503,
				headers: {},
				body: 'Service Unavailable',
			})
			.mockResolvedValueOnce({
				statusCode: 200,
				headers: {},
				body: JSON.stringify({ invoice_id: 'inv_ok' }),
			});

		const res = await paymosApiRequest<IDataObject>(
			{ helpers: { httpRequest: getHttp } } as PaymosHttpContext,
			sandboxCredentials,
			{
				method: 'GET',
				path: '/v1/invoices/inv_ok',
				maxRetries: 2,
				baseDelayMs: 10,
				sleep: sleepMock,
			},
		);
		expect(res.invoice_id).toBe('inv_ok');
		expect(getHttp).toHaveBeenCalledTimes(3);
		expect(sleepMock).toHaveBeenNthCalledWith(1, 1000);
		expect(sleepMock).toHaveBeenNthCalledWith(2, 20);

		// POST must NOT retry on 429 or 500
		const postHttp = vi.fn().mockResolvedValue({
			statusCode: 500,
			headers: {},
			body: JSON.stringify({ status: 500, detail: 'Internal error', code: 'internal_error' }),
		});
		await expect(
			paymosApiRequest(
				{ helpers: { httpRequest: postHttp } } as PaymosHttpContext,
				sandboxCredentials,
				{
					method: 'POST',
					path: '/v1/invoices',
					body: { project_id: 'prj_1', amount: '10.00', currency: 'USD', external_order_id: 'o1' },
					sleep: sleepMock,
				},
			),
		).rejects.toThrow(/Paymos API 500/);
		expect(postHttp).toHaveBeenCalledTimes(1);
	});

	it('returns structured error items with pairedItem when continueOnFail() is enabled', async () => {
		const httpRequest = vi
			.fn()
			.mockResolvedValueOnce({
				statusCode: 409,
				headers: {},
				body: JSON.stringify({
					type: 'about:blank',
					title: 'Conflict',
					status: 409,
					detail: 'Invoice cannot be cancelled.',
					code: 'invoice_cannot_be_cancelled',
				}),
			})
			.mockResolvedValueOnce({
				statusCode: 200,
				headers: {},
				body: JSON.stringify({ invoice_id: 'inv_2', status: 'cancelled' }),
			});

		const node = new Paymos();
		const ctx = createExecuteContext({
			httpRequest,
			itemCount: 2,
			continueOnFail: true,
			params: {
				resource: 'invoice',
				operation: 'cancel',
				invoiceId: 'inv_1',
				reason: 'Duplicate order',
			},
		});

		const output = await node.execute.call(ctx);
		expect(output[0]).toHaveLength(2);
		expect(output[0][0]).toEqual({
			json: {
				error: 'Paymos API 409: Invoice cannot be cancelled.',
				status: 409,
				code: 'invoice_cannot_be_cancelled',
				problem: {
					type: 'about:blank',
					title: 'Conflict',
					status: 409,
					detail: 'Invoice cannot be cancelled.',
					code: 'invoice_cannot_be_cancelled',
				},
			},
			pairedItem: { item: 0 },
		});
		expect(output[0][1]).toEqual({
			json: { invoice_id: 'inv_2', status: 'cancelled' },
			pairedItem: { item: 1 },
		});
	});

	it('executes invoice:get and invoice:confirmPayment with expected methods, paths, and payloads', async () => {
		const node = new Paymos();

		const getHttp = vi.fn().mockResolvedValue({
			statusCode: 200,
			headers: {},
			body: JSON.stringify({ invoice_id: 'inv_42', status: 'awaiting_payment' }),
		});
		const getOut = await node.execute.call(
			createExecuteContext({
				httpRequest: getHttp,
				params: {
					resource: 'invoice',
					operation: 'get',
					invoiceId: 'inv_42',
				},
			}),
		);
		expect(getOut[0][0].json).toEqual({ invoice_id: 'inv_42', status: 'awaiting_payment' });
		expect(getHttp.mock.calls[0][0]).toMatchObject({
			method: 'GET',
			url: 'https://api.paymos.io/v1/invoices/inv_42',
		});

		const confirmHttp = vi.fn().mockResolvedValue({
			statusCode: 200,
			headers: {},
			body: JSON.stringify({ invoice_id: 'inv_42', status: 'awaiting_payment', deposit_address: 'TAddr1' }),
		});
		const confirmOut = await node.execute.call(
			createExecuteContext({
				httpRequest: confirmHttp,
				params: {
					resource: 'invoice',
					operation: 'confirmPayment',
					invoiceId: 'inv_42',
					paymentCurrency: 'USDT',
					paymentNetwork: 'TRC20',
				},
			}),
		);
		expect(confirmOut[0][0].json).toMatchObject({ invoice_id: 'inv_42', deposit_address: 'TAddr1' });
		expect(confirmHttp.mock.calls[0][0]).toMatchObject({
			method: 'POST',
			url: 'https://api.paymos.io/v1/invoices/inv_42/confirm-payment',
		});
		expect(JSON.parse(confirmHttp.mock.calls[0][0].body as string)).toEqual({
			currency: 'USDT',
			network: 'TRC20',
		});
	});

	it('executes paymentChannel create, get, getMany, unblock and paymentChannelDeposit:get', async () => {
		const node = new Paymos();

		const createHttp = vi.fn().mockResolvedValue({
			statusCode: 200,
			headers: {},
			body: JSON.stringify({ payment_channel_id: 'pch_42', external_id: 'cust-42' }),
		});
		const createOut = await node.execute.call(
			createExecuteContext({
				httpRequest: createHttp,
				params: {
					resource: 'paymentChannel',
					operation: 'create',
					channelProjectId: 'prj_9',
					externalId: 'cust-42',
				},
			}),
		);
		expect(createOut[0][0].json).toEqual({ payment_channel_id: 'pch_42', external_id: 'cust-42' });
		expect(createHttp.mock.calls[0][0]).toMatchObject({
			method: 'POST',
			url: 'https://api.paymos.io/v1/payment-channels',
		});
		expect(JSON.parse(createHttp.mock.calls[0][0].body as string)).toEqual({
			project_id: 'prj_9',
			external_id: 'cust-42',
		});

		const getHttp = vi.fn().mockResolvedValue({
			statusCode: 200,
			headers: {},
			body: JSON.stringify({ payment_channel_id: 'pch_42', status: 'active' }),
		});
		const getOut = await node.execute.call(
			createExecuteContext({
				httpRequest: getHttp,
				params: {
					resource: 'paymentChannel',
					operation: 'get',
					paymentChannelId: 'pch_42',
				},
			}),
		);
		expect(getOut[0][0].json).toEqual({ payment_channel_id: 'pch_42', status: 'active' });
		expect(getHttp.mock.calls[0][0]).toMatchObject({
			method: 'GET',
			url: 'https://api.paymos.io/v1/payment-channels/pch_42',
		});

		const listHttp = vi
			.fn()
			.mockResolvedValueOnce({
				statusCode: 200,
				headers: {},
				body: JSON.stringify({
					items: [{ payment_channel_id: 'pch_1' }],
					next_cursor: 'ch_cur_2',
				}),
			})
			.mockResolvedValueOnce({
				statusCode: 200,
				headers: {},
				body: JSON.stringify({
					items: [{ payment_channel_id: 'pch_2' }],
					next_cursor: null,
				}),
			});
		const listOut = await node.execute.call(
			createExecuteContext({
				httpRequest: listHttp,
				params: {
					resource: 'paymentChannel',
					operation: 'getMany',
					returnAll: true,
					channelFilters: {
						projectId: 'prj_9',
						externalId: 'cust-42',
						status: ['active', 'blocked'],
					},
				},
			}),
		);
		expect(listOut[0].map((item) => item.json.payment_channel_id)).toEqual(['pch_1', 'pch_2']);
		expect(listHttp).toHaveBeenCalledTimes(2);
		expect(listHttp.mock.calls[0][0].url).toBe(
			'https://api.paymos.io/v1/payment-channels?external_id=cust-42&limit=100&project_id=prj_9&status=active&status=blocked',
		);
		expect(listHttp.mock.calls[1][0].url).toBe(
			'https://api.paymos.io/v1/payment-channels?cursor=ch_cur_2&external_id=cust-42&limit=100&project_id=prj_9&status=active&status=blocked',
		);

		const unblockHttp = vi.fn().mockResolvedValue({
			statusCode: 200,
			headers: {},
			body: JSON.stringify({ payment_channel_id: 'pch_42', status: 'active' }),
		});
		const unblockOut = await node.execute.call(
			createExecuteContext({
				httpRequest: unblockHttp,
				params: {
					resource: 'paymentChannel',
					operation: 'unblock',
					paymentChannelId: 'pch_42',
				},
			}),
		);
		expect(unblockOut[0][0].json).toEqual({ payment_channel_id: 'pch_42', status: 'active' });
		expect(unblockHttp.mock.calls[0][0]).toMatchObject({
			method: 'POST',
			url: 'https://api.paymos.io/v1/payment-channels/pch_42/unblock',
		});

		const depositGetHttp = vi.fn().mockResolvedValue({
			statusCode: 200,
			headers: {},
			body: JSON.stringify({ deposit_id: 'pcd_42', status: 'confirmed' }),
		});
		const depositGetOut = await node.execute.call(
			createExecuteContext({
				httpRequest: depositGetHttp,
				params: {
					resource: 'paymentChannelDeposit',
					operation: 'get',
					depositId: 'pcd_42',
				},
			}),
		);
		expect(depositGetOut[0][0].json).toEqual({ deposit_id: 'pcd_42', status: 'confirmed' });
		expect(depositGetHttp.mock.calls[0][0]).toMatchObject({
			method: 'GET',
			url: 'https://api.paymos.io/v1/payment-channel-deposits/pcd_42',
		});
	});

	it('executes refund:get and refund:getMany with RFC 3339 timestamps, invoice_id, and cursor pagination', async () => {
		const node = new Paymos();

		const getHttp = vi.fn().mockResolvedValue({
			statusCode: 200,
			headers: {},
			body: JSON.stringify({ withdrawal_id: 'wdr_42', status: 'completed' }),
		});
		const getOut = await node.execute.call(
			createExecuteContext({
				httpRequest: getHttp,
				params: {
					resource: 'refund',
					operation: 'get',
					refundId: 'wdr_42',
				},
			}),
		);
		expect(getOut[0][0].json).toEqual({ withdrawal_id: 'wdr_42', status: 'completed' });
		expect(getHttp.mock.calls[0][0]).toMatchObject({
			method: 'GET',
			url: 'https://api.paymos.io/v1/refunds/wdr_42',
		});

		const listHttp = vi
			.fn()
			.mockResolvedValueOnce({
				statusCode: 200,
				headers: {},
				body: JSON.stringify({
					items: [{ withdrawal_id: 'wdr_1' }],
					next_cursor: 'ref_cur_2',
				}),
			})
			.mockResolvedValueOnce({
				statusCode: 200,
				headers: {},
				body: JSON.stringify({
					items: [{ withdrawal_id: 'wdr_2' }],
					next_cursor: null,
				}),
			});
		const listOut = await node.execute.call(
			createExecuteContext({
				httpRequest: listHttp,
				params: {
					resource: 'refund',
					operation: 'getMany',
					returnAll: false,
					limit: 5,
					refundFilters: {
						invoiceId: 'inv_99',
						status: ['completed', 'pending'],
						createdFrom: '2026-11-01T00:00:00Z',
						createdTo: '2026-11-23T23:59:59Z',
					},
				},
			}),
		);
		expect(listOut[0].map((item) => item.json.withdrawal_id)).toEqual(['wdr_1', 'wdr_2']);
		expect(listHttp).toHaveBeenCalledTimes(2);
		expect(listHttp.mock.calls[0][0].url).toBe(
			'https://api.paymos.io/v1/refunds?created_from=2026-11-01T00%3A00%3A00Z&created_to=2026-11-23T23%3A59%3A59Z&invoice_id=inv_99&limit=5&status=completed&status=pending',
		);
		expect(listHttp.mock.calls[1][0].url).toBe(
			'https://api.paymos.io/v1/refunds?created_from=2026-11-01T00%3A00%3A00Z&created_to=2026-11-23T23%3A59%3A59Z&cursor=ref_cur_2&invoice_id=inv_99&limit=4&status=completed&status=pending',
		);
	});

	it('rejects empty or whitespace path IDs before sending any HTTP request across all ID-based operations', async () => {
		const node = new Paymos();
		const cases: Array<{ params: Record<string, unknown>; expectedMessage: RegExp }> = [
			{ params: { resource: 'invoice', operation: 'get', invoiceId: '' }, expectedMessage: /Invoice ID/ },
			{
				params: { resource: 'invoice', operation: 'confirmPayment', invoiceId: '   ', paymentCurrency: 'USDT', paymentNetwork: 'TRC20' },
				expectedMessage: /Invoice ID/,
			},
			{ params: { resource: 'invoice', operation: 'cancel', invoiceId: '', reason: 'r' }, expectedMessage: /Invoice ID/ },
			{
				params: { resource: 'invoice', operation: 'simulatePayment', invoiceId: ' ', stage: 'paid' },
				expectedMessage: /Invoice ID/,
			},
			{
				params: { resource: 'paymentChannel', operation: 'get', paymentChannelId: '' },
				expectedMessage: /Payment Channel ID/,
			},
			{
				params: { resource: 'paymentChannel', operation: 'block', paymentChannelId: '  ' },
				expectedMessage: /Payment Channel ID/,
			},
			{
				params: { resource: 'paymentChannel', operation: 'unblock', paymentChannelId: '' },
				expectedMessage: /Payment Channel ID/,
			},
			{
				params: {
					resource: 'paymentChannel',
					operation: 'simulateDeposit',
					paymentChannelId: '',
					depositAmount: '10',
					depositCurrency: 'USDT',
					depositNetwork: 'TRC20',
				},
				expectedMessage: /Payment Channel ID/,
			},
			{
				params: { resource: 'paymentChannelDeposit', operation: 'get', depositId: '   ' },
				expectedMessage: /Deposit ID/,
			},
			{ params: { resource: 'refund', operation: 'get', refundId: '' }, expectedMessage: /Refund ID/ },
			{
				params: { resource: 'refund', operation: 'simulate', refundId: '  ', refundStatus: 'completed' },
				expectedMessage: /Refund ID/,
			},
		];

		for (const testCase of cases) {
			const httpRequest = vi.fn();
			await expect(
				node.execute.call(createExecuteContext({ httpRequest, params: testCase.params })),
			).rejects.toThrow(testCase.expectedMessage);
			expect(httpRequest).not.toHaveBeenCalled();
		}

		// With continueOnFail enabled, empty ID returns structured error item and still sends 0 HTTP requests.
		const continueHttp = vi.fn();
		const continueOut = await node.execute.call(
			createExecuteContext({
				httpRequest: continueHttp,
				continueOnFail: true,
				params: { resource: 'invoice', operation: 'get', invoiceId: '   ' },
			}),
		);
		expect(continueHttp).not.toHaveBeenCalled();
		expect(continueOut[0]).toEqual([
			{
				json: { error: 'Invoice ID is required and cannot be empty.' },
				pairedItem: { item: 0 },
			},
		]);
	});
});
