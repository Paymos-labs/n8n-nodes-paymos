import {
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
	type ICredentialsDecrypted,
	type ICredentialTestFunctions,
	type IDataObject,
	type IExecuteFunctions,
	type INode,
	type INodeCredentialTestResult,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type JsonObject,
} from 'n8n-workflow';
import { encodePathSegment, type QueryParams } from '../../src/crypto/signing';
import {
	PaymosApiError,
	paymosApiPaginate,
	paymosApiRequest,
	runPaymosApiCredentialTest,
	type PaymosApiCredentials,
} from '../../src/transport/PaymosTransport';
import { invoiceFields, invoiceOperations } from './descriptions/InvoiceDescription';
import {
	paymentChannelFields,
	paymentChannelOperations,
} from './descriptions/PaymentChannelDescription';
import { refundFields, refundOperations } from './descriptions/RefundDescription';

interface ProductInput {
	title?: string;
	description?: string;
	quantity?: number;
	unitAmount?: string;
}

function requireNonEmptyParam(
	node: INode,
	rawValue: unknown,
	label: string,
	itemIndex: number,
): string {
	const value = typeof rawValue === 'string' ? rawValue.trim() : '';
	if (value === '') {
		throw new NodeOperationError(node, `${label} is required and cannot be empty.`, {
			itemIndex,
		});
	}
	return value;
}

export class Paymos implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Paymos',
		name: 'paymos',
		icon: {
			light: 'file:paymos.svg',
			dark: 'file:paymos.dark.svg',
		},
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Accept stablecoin (USDT, USDC, USD1, DAI) and gold-backed XAUT payments, manage Payment Channels, and issue refunds via the Paymos Merchant API',
		defaults: {
			name: 'Paymos',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'paymosApi',
				required: true,
				testedBy: 'paymosApiTest',
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Invoice',
						value: 'invoice',
					},
					{
						name: 'Payment Channel',
						value: 'paymentChannel',
					},
					{
						name: 'Payment Channel Deposit',
						value: 'paymentChannelDeposit',
					},
					{
						name: 'Refund',
						value: 'refund',
					},
				],
				default: 'invoice',
			},
			...invoiceOperations,
			...invoiceFields,
			...paymentChannelOperations,
			...paymentChannelFields,
			...refundOperations,
			...refundFields,
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

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = (await this.getCredentials('paymosApi')) as Partial<PaymosApiCredentials>;

		for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
			try {
				const resource = this.getNodeParameter('resource', itemIndex) as string;
				const operation = this.getNodeParameter('operation', itemIndex) as string;

				if (resource === 'invoice') {
					if (operation === 'create') {
						const projectId = (this.getNodeParameter('projectId', itemIndex) as string).trim();
						const amount = (this.getNodeParameter('amount', itemIndex) as string).trim();
						const currency = (this.getNodeParameter('currency', itemIndex) as string).trim();
						const externalOrderId = (this.getNodeParameter('externalOrderId', itemIndex) as string).trim();
						const additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;

						const body: IDataObject = {
							project_id: projectId,
							amount,
							currency,
							external_order_id: externalOrderId,
						};

						if (typeof additionalFields.network === 'string' && additionalFields.network.trim() !== '') {
							body.network = additionalFields.network.trim();
						}
						if (
							additionalFields.customerFeePercent !== undefined &&
							additionalFields.customerFeePercent !== ''
						) {
							body.customer_fee_percent = Number(additionalFields.customerFeePercent);
						}
						if (typeof additionalFields.clientId === 'string' && additionalFields.clientId.trim() !== '') {
							body.client_id = additionalFields.clientId.trim();
						}

						const productsCollection = additionalFields.products as
							| { productValues?: ProductInput[] }
							| undefined;
						if (
							productsCollection?.productValues &&
							Array.isArray(productsCollection.productValues) &&
							productsCollection.productValues.length > 0
						) {
							body.products = productsCollection.productValues.map((product) => {
								const wireProduct: IDataObject = {
									title: String(product.title ?? ''),
									quantity: Number(product.quantity ?? 1),
									unit_amount: String(product.unitAmount ?? ''),
								};
								if (typeof product.description === 'string' && product.description.trim() !== '') {
									wireProduct.description = product.description;
								}
								return wireProduct;
							});
						}

						const response = await paymosApiRequest(this, credentials, {
							method: 'POST',
							path: '/v1/invoices',
							body,
						});
						returnData.push({ json: response, pairedItem: { item: itemIndex } });
					} else if (operation === 'get') {
						const invoiceId = requireNonEmptyParam(
							this.getNode(),
							this.getNodeParameter('invoiceId', itemIndex),
							'Invoice ID',
							itemIndex,
						);
						const response = await paymosApiRequest(this, credentials, {
							method: 'GET',
							path: `/v1/invoices/${encodePathSegment(invoiceId)}`,
						});
						returnData.push({ json: response, pairedItem: { item: itemIndex } });
					} else if (operation === 'getMany') {
						const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;
						const limit = returnAll ? undefined : (this.getNodeParameter('limit', itemIndex) as number);
						const filters = this.getNodeParameter('filters', itemIndex, {}) as IDataObject;

						const query: QueryParams = {};
						if (typeof filters.projectId === 'string' && filters.projectId.trim() !== '') {
							query.project_id = filters.projectId.trim();
						}
						if (typeof filters.externalOrderId === 'string' && filters.externalOrderId.trim() !== '') {
							query.external_order_id = filters.externalOrderId.trim();
						}
						if (Array.isArray(filters.status) && filters.status.length > 0) {
							query.status = filters.status.map((value) => String(value));
						}
						if (typeof filters.createdFrom === 'number' && filters.createdFrom > 0) {
							query.created_from = Math.floor(filters.createdFrom);
						}
						if (typeof filters.createdTo === 'number' && filters.createdTo > 0) {
							query.created_to = Math.floor(filters.createdTo);
						}
						if (typeof filters.cursor === 'string' && filters.cursor.trim() !== '') {
							query.cursor = filters.cursor.trim();
						}

						const rows = await paymosApiPaginate(this, credentials, {
							path: '/v1/invoices',
							query,
							returnAll,
							limit,
						});
						for (const row of rows) {
							returnData.push({ json: row, pairedItem: { item: itemIndex } });
						}
					} else if (operation === 'confirmPayment') {
						const invoiceId = requireNonEmptyParam(
							this.getNode(),
							this.getNodeParameter('invoiceId', itemIndex),
							'Invoice ID',
							itemIndex,
						);
						const currency = (this.getNodeParameter('paymentCurrency', itemIndex) as string).trim();
						const network = (this.getNodeParameter('paymentNetwork', itemIndex) as string).trim();
						const response = await paymosApiRequest(this, credentials, {
							method: 'POST',
							path: `/v1/invoices/${encodePathSegment(invoiceId)}/confirm-payment`,
							body: { currency, network },
						});
						returnData.push({ json: response, pairedItem: { item: itemIndex } });
					} else if (operation === 'cancel') {
						const invoiceId = requireNonEmptyParam(
							this.getNode(),
							this.getNodeParameter('invoiceId', itemIndex),
							'Invoice ID',
							itemIndex,
						);
						const reason = (this.getNodeParameter('reason', itemIndex) as string).trim();
						const response = await paymosApiRequest(this, credentials, {
							method: 'POST',
							path: `/v1/invoices/${encodePathSegment(invoiceId)}/cancel`,
							body: { reason },
						});
						returnData.push({ json: response, pairedItem: { item: itemIndex } });
					} else if (operation === 'simulatePayment') {
						const invoiceId = requireNonEmptyParam(
							this.getNode(),
							this.getNodeParameter('invoiceId', itemIndex),
							'Invoice ID',
							itemIndex,
						);
						const stage = (this.getNodeParameter('stage', itemIndex) as string).trim();
						const response = await paymosApiRequest(this, credentials, {
							method: 'POST',
							path: `/v1/sandbox/invoices/${encodePathSegment(invoiceId)}/simulate-payment`,
							body: { stage },
							requireSandbox: true,
						});
						returnData.push({ json: response, pairedItem: { item: itemIndex } });
					} else {
						throw new NodeOperationError(this.getNode(), `Unsupported Invoice operation: ${operation}`, {
							itemIndex,
						});
					}
				} else if (resource === 'paymentChannel') {
					if (operation === 'create') {
						const projectId = (this.getNodeParameter('channelProjectId', itemIndex) as string).trim();
						const externalId = (this.getNodeParameter('externalId', itemIndex) as string).trim();
						const response = await paymosApiRequest(this, credentials, {
							method: 'POST',
							path: '/v1/payment-channels',
							body: {
								project_id: projectId,
								external_id: externalId,
							},
						});
						returnData.push({ json: response, pairedItem: { item: itemIndex } });
					} else if (operation === 'get') {
						const paymentChannelId = requireNonEmptyParam(
							this.getNode(),
							this.getNodeParameter('paymentChannelId', itemIndex),
							'Payment Channel ID',
							itemIndex,
						);
						const response = await paymosApiRequest(this, credentials, {
							method: 'GET',
							path: `/v1/payment-channels/${encodePathSegment(paymentChannelId)}`,
						});
						returnData.push({ json: response, pairedItem: { item: itemIndex } });
					} else if (operation === 'getMany') {
						const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;
						const limit = returnAll ? undefined : (this.getNodeParameter('limit', itemIndex) as number);
						const filters = this.getNodeParameter('channelFilters', itemIndex, {}) as IDataObject;

						const query: QueryParams = {};
						if (typeof filters.projectId === 'string' && filters.projectId.trim() !== '') {
							query.project_id = filters.projectId.trim();
						}
						if (typeof filters.externalId === 'string' && filters.externalId.trim() !== '') {
							query.external_id = filters.externalId.trim();
						}
						if (Array.isArray(filters.status) && filters.status.length > 0) {
							query.status = filters.status.map((value) => String(value));
						}
						if (typeof filters.cursor === 'string' && filters.cursor.trim() !== '') {
							query.cursor = filters.cursor.trim();
						}

						const rows = await paymosApiPaginate(this, credentials, {
							path: '/v1/payment-channels',
							query,
							returnAll,
							limit,
						});
						for (const row of rows) {
							returnData.push({ json: row, pairedItem: { item: itemIndex } });
						}
					} else if (operation === 'block') {
						const paymentChannelId = requireNonEmptyParam(
							this.getNode(),
							this.getNodeParameter('paymentChannelId', itemIndex),
							'Payment Channel ID',
							itemIndex,
						);
						const response = await paymosApiRequest(this, credentials, {
							method: 'POST',
							path: `/v1/payment-channels/${encodePathSegment(paymentChannelId)}/block`,
						});
						returnData.push({ json: response, pairedItem: { item: itemIndex } });
					} else if (operation === 'unblock') {
						const paymentChannelId = requireNonEmptyParam(
							this.getNode(),
							this.getNodeParameter('paymentChannelId', itemIndex),
							'Payment Channel ID',
							itemIndex,
						);
						const response = await paymosApiRequest(this, credentials, {
							method: 'POST',
							path: `/v1/payment-channels/${encodePathSegment(paymentChannelId)}/unblock`,
						});
						returnData.push({ json: response, pairedItem: { item: itemIndex } });
					} else if (operation === 'simulateDeposit') {
						const paymentChannelId = requireNonEmptyParam(
							this.getNode(),
							this.getNodeParameter('paymentChannelId', itemIndex),
							'Payment Channel ID',
							itemIndex,
						);
						const amount = (this.getNodeParameter('depositAmount', itemIndex) as string).trim();
						const currency = (this.getNodeParameter('depositCurrency', itemIndex) as string).trim();
						const network = (this.getNodeParameter('depositNetwork', itemIndex) as string).trim();
						const stage = (this.getNodeParameter('depositStage', itemIndex, 'confirmed') as string).trim();
						const body: IDataObject = {
							amount,
							currency,
							network,
						};
						if (stage !== '') {
							body.stage = stage;
						}
						const response = await paymosApiRequest(this, credentials, {
							method: 'POST',
							path: `/v1/sandbox/payment-channels/${encodePathSegment(paymentChannelId)}/simulate-deposit`,
							body,
							requireSandbox: true,
						});
						returnData.push({ json: response, pairedItem: { item: itemIndex } });
					} else {
						throw new NodeOperationError(
							this.getNode(),
							`Unsupported Payment Channel operation: ${operation}`,
							{ itemIndex },
						);
					}
				} else if (resource === 'paymentChannelDeposit') {
					if (operation === 'get') {
						const depositId = requireNonEmptyParam(
							this.getNode(),
							this.getNodeParameter('depositId', itemIndex),
							'Deposit ID',
							itemIndex,
						);
						const response = await paymosApiRequest(this, credentials, {
							method: 'GET',
							path: `/v1/payment-channel-deposits/${encodePathSegment(depositId)}`,
						});
						returnData.push({ json: response, pairedItem: { item: itemIndex } });
					} else if (operation === 'getMany') {
						// Single-page cursor feed poll: next_cursor is non-nullable and never terminates.
						const limit = this.getNodeParameter('depositFeedLimit', itemIndex, 20) as number;
						const cursor = (this.getNodeParameter('depositFeedCursor', itemIndex, '') as string).trim();
						const filters = this.getNodeParameter('depositFilters', itemIndex, {}) as IDataObject;

						const query: QueryParams = {
							limit,
						};
						if (cursor !== '') {
							query.cursor = cursor;
						}
						if (typeof filters.projectId === 'string' && filters.projectId.trim() !== '') {
							query.project_id = filters.projectId.trim();
						}
						if (
							typeof filters.paymentChannelId === 'string' &&
							filters.paymentChannelId.trim() !== ''
						) {
							query.payment_channel_id = filters.paymentChannelId.trim();
						}
						if (typeof filters.confirmedFrom === 'number' && filters.confirmedFrom > 0) {
							query.confirmed_from = Math.floor(filters.confirmedFrom);
						}

						const page = await paymosApiRequest(this, credentials, {
							method: 'GET',
							path: '/v1/payment-channel-deposits',
							query,
						});
						returnData.push({ json: page, pairedItem: { item: itemIndex } });
					} else {
						throw new NodeOperationError(
							this.getNode(),
							`Unsupported Payment Channel Deposit operation: ${operation}`,
							{ itemIndex },
						);
					}
				} else if (resource === 'refund') {
					if (operation === 'create') {
						const invoiceId = (this.getNodeParameter('refundInvoiceId', itemIndex) as string).trim();
						const mode = (this.getNodeParameter('refundMode', itemIndex) as string).trim();
						const externalOrderId = (
							this.getNodeParameter('refundExternalOrderId', itemIndex) as string
						).trim();
						const response = await paymosApiRequest(this, credentials, {
							method: 'POST',
							path: '/v1/refunds',
							body: {
								invoice_id: invoiceId,
								mode,
								external_order_id: externalOrderId,
							},
						});
						returnData.push({ json: response, pairedItem: { item: itemIndex } });
					} else if (operation === 'get') {
						const refundId = requireNonEmptyParam(
							this.getNode(),
							this.getNodeParameter('refundId', itemIndex),
							'Refund ID',
							itemIndex,
						);
						const response = await paymosApiRequest(this, credentials, {
							method: 'GET',
							path: `/v1/refunds/${encodePathSegment(refundId)}`,
						});
						returnData.push({ json: response, pairedItem: { item: itemIndex } });
					} else if (operation === 'getMany') {
						const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;
						const limit = returnAll ? undefined : (this.getNodeParameter('limit', itemIndex) as number);
						const filters = this.getNodeParameter('refundFilters', itemIndex, {}) as IDataObject;

						const query: QueryParams = {};
						if (typeof filters.invoiceId === 'string' && filters.invoiceId.trim() !== '') {
							query.invoice_id = filters.invoiceId.trim();
						}
						if (Array.isArray(filters.status) && filters.status.length > 0) {
							query.status = filters.status.map((value) => String(value));
						}
						if (typeof filters.createdFrom === 'string' && filters.createdFrom.trim() !== '') {
							query.created_from = filters.createdFrom.trim();
						}
						if (typeof filters.createdTo === 'string' && filters.createdTo.trim() !== '') {
							query.created_to = filters.createdTo.trim();
						}
						if (typeof filters.cursor === 'string' && filters.cursor.trim() !== '') {
							query.cursor = filters.cursor.trim();
						}

						const rows = await paymosApiPaginate(this, credentials, {
							path: '/v1/refunds',
							query,
							returnAll,
							limit,
						});
						for (const row of rows) {
							returnData.push({ json: row, pairedItem: { item: itemIndex } });
						}
					} else if (operation === 'simulate') {
						const refundId = requireNonEmptyParam(
							this.getNode(),
							this.getNodeParameter('refundId', itemIndex),
							'Refund ID',
							itemIndex,
						);
						const status = (this.getNodeParameter('refundStatus', itemIndex) as string).trim();
						const response = await paymosApiRequest(this, credentials, {
							method: 'POST',
							path: `/v1/sandbox/refunds/${encodePathSegment(refundId)}/simulate`,
							body: { status },
							requireSandbox: true,
						});
						returnData.push({ json: response, pairedItem: { item: itemIndex } });
					} else {
						throw new NodeOperationError(
							this.getNode(),
							`Unsupported Refund operation: ${operation}`,
							{ itemIndex },
						);
					}
				} else {
					throw new NodeOperationError(this.getNode(), `Unsupported resource: ${resource}`, {
						itemIndex,
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					const errorPayload: IDataObject = {
						error: error instanceof Error ? error.message : String(error),
					};
					if (error instanceof PaymosApiError) {
						errorPayload.status = error.status;
						if (error.code !== '') {
							errorPayload.code = error.code;
						}
						if (error.field !== null) {
							errorPayload.field = error.field;
						}
						if (error.problem !== null) {
							errorPayload.problem = error.problem as IDataObject;
						}
					}
					returnData.push({
						json: errorPayload,
						pairedItem: { item: itemIndex },
					});
					continue;
				}
				if (error instanceof PaymosApiError) {
					const errorBody: JsonObject = {
						message: error.message,
						httpCode: String(error.status),
						...(error.code !== '' ? { code: error.code } : {}),
						...(error.field !== null ? { field: error.field } : {}),
					};
					throw new NodeApiError(this.getNode(), errorBody, {
						itemIndex,
						httpCode: String(error.status),
						message: error.message,
					});
				}
				throw new NodeOperationError(
					this.getNode(),
					error instanceof Error ? error : new Error(String(error)),
					{ itemIndex },
				);
			}
		}

		return [returnData];
	}
}
