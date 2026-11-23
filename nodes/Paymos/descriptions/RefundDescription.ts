import type { INodeProperties } from 'n8n-workflow';

export const refundOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['refund'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a server-calculated full or overpayment refund for an invoice',
				action: 'Create a refund',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve a refund by its withdrawal identifier',
				action: 'Get a refund',
			},
			{
				name: 'Get Many',
				value: 'getMany',
				description: 'Retrieve multiple refunds using cursor pagination',
				action: 'Get many refunds',
			},
			{
				name: 'Simulate Sandbox Refund',
				value: 'simulate',
				description: 'Drive a Sandbox refund to a terminal outcome (pk_test_ only)',
				action: 'Simulate a sandbox refund',
			},
		],
		default: 'create',
	},
];

export const refundFields: INodeProperties[] = [
	// ── Create ───────────────────────────────────────────────
	{
		displayName: 'Invoice ID',
		name: 'refundInvoiceId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'inv_...',
		description: 'Prefixed invoice identifier (inv_...) to refund',
		displayOptions: {
			show: {
				resource: ['refund'],
				operation: ['create'],
			},
		},
	},
	{
		displayName: 'Mode',
		name: 'refundMode',
		type: 'options',
		required: true,
		options: [
			{ name: 'Full', value: 'full' },
			{ name: 'Overpayment', value: 'overpayment' },
		],
		default: 'full',
		description: 'Server-calculated refund mode (full invoice refund or overpayment excess only)',
		displayOptions: {
			show: {
				resource: ['refund'],
				operation: ['create'],
			},
		},
	},
	{
		displayName: 'External Order ID',
		name: 'refundExternalOrderId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'refund-order-1',
		description: 'Your unique idempotency key for this refund request',
		displayOptions: {
			show: {
				resource: ['refund'],
				operation: ['create'],
			},
		},
	},

	// ── Shared Refund ID ─────────────────────────────────────
	{
		displayName: 'Refund ID',
		name: 'refundId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'wdr_...',
		description: 'Prefixed refund identifier (withdrawal ID, wdr_...)',
		displayOptions: {
			show: {
				resource: ['refund'],
				operation: ['get', 'simulate'],
			},
		},
	},

	// ── Simulate Sandbox Refund ──────────────────────────────
	{
		displayName: 'Status',
		name: 'refundStatus',
		type: 'options',
		required: true,
		options: [
			{ name: 'Cancelled', value: 'cancelled' },
			{ name: 'Completed', value: 'completed' },
			{ name: 'Failed', value: 'failed' },
		],
		default: 'completed',
		description: 'Terminal status to simulate for the Sandbox refund',
		displayOptions: {
			show: {
				resource: ['refund'],
				operation: ['simulate'],
			},
		},
	},

	// ── Get Many ─────────────────────────────────────────────
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: {
			show: {
				resource: ['refund'],
				operation: ['getMany'],
			},
		},
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: {
			minValue: 1,
			maxValue: 100,
		},
		default: 50,
		description: 'Max number of results to return',
		displayOptions: {
			show: {
				resource: ['refund'],
				operation: ['getMany'],
				returnAll: [false],
			},
		},
	},
	{
		displayName: 'Filters',
		name: 'refundFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: {
				resource: ['refund'],
				operation: ['getMany'],
			},
		},
		options: [
			{
				displayName: 'Created From (RFC 3339)',
				name: 'createdFrom',
				type: 'string',
				default: '',
				placeholder: '2026-01-01T00:00:00Z',
				description: 'Inclusive lower bound as an RFC 3339 timestamp with timezone',
			},
			{
				displayName: 'Created To (RFC 3339)',
				name: 'createdTo',
				type: 'string',
				default: '',
				placeholder: '2026-01-02T00:00:00Z',
				description: 'Exclusive upper bound as an RFC 3339 timestamp with timezone',
			},
			{
				displayName: 'Cursor',
				name: 'cursor',
				type: 'string',
				default: '',
				description: 'Optional opaque pagination cursor to start listing from',
			},
			{
				displayName: 'Invoice ID',
				name: 'invoiceId',
				type: 'string',
				default: '',
				placeholder: 'inv_...',
				description: 'Filter refunds linked to a specific invoice (inv_...)',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'multiOptions',
				options: [
					{ name: 'Cancelled', value: 'cancelled' },
					{ name: 'Cancelling', value: 'cancelling' },
					{ name: 'Completed', value: 'completed' },
					{ name: 'Created', value: 'created' },
					{ name: 'Failed', value: 'failed' },
					{ name: 'Pending Review', value: 'pending_review' },
					{ name: 'Signed', value: 'signed' },
				],
				default: [],
				description: 'Filter by one or more refund statuses',
			},
		],
	},
];
