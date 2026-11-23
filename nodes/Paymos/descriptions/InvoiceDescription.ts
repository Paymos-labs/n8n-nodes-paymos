import type { INodeProperties } from 'n8n-workflow';

export const PAYMOS_NETWORK_OPTIONS = [
	{ name: 'Arbitrum (ARBITRUM)', value: 'ARBITRUM' },
	{ name: 'Avalanche (AVAX)', value: 'AVAX' },
	{ name: 'Base (BASE)', value: 'BASE' },
	{ name: 'BNB Smart Chain (BEP20)', value: 'BEP20' },
	{ name: 'Ethereum (ERC20)', value: 'ERC20' },
	{ name: 'NEAR (NEAR)', value: 'NEAR' },
	{ name: 'Optimism (OPTIMISM)', value: 'OPTIMISM' },
	{ name: 'Plasma (PLASMA)', value: 'PLASMA' },
	{ name: 'Polygon (POLYGON)', value: 'POLYGON' },
	{ name: 'Solana (SOL)', value: 'SOL' },
	{ name: 'Sui (SUI)', value: 'SUI' },
	{ name: 'TON (TON)', value: 'TON' },
	{ name: 'Tron (TRC20)', value: 'TRC20' },
];

export const PAYMOS_ASSET_OPTIONS = [
	{ name: 'DAI (Stablecoin)', value: 'DAI' },
	{ name: 'USD1 (Stablecoin)', value: 'USD1' },
	{ name: 'USDC (Stablecoin)', value: 'USDC' },
	{ name: 'USDT (Stablecoin)', value: 'USDT' },
	{ name: 'XAUT (Gold-Backed)', value: 'XAUT' },
];

export const invoiceOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['invoice'],
			},
		},
		options: [
			{
				name: 'Cancel',
				value: 'cancel',
				description: 'Cancel an invoice while it is still awaiting client selection',
				action: 'Cancel an invoice',
			},
			{
				name: 'Confirm Payment',
				value: 'confirmPayment',
				description: 'Lock the exchange rate and allocate a deposit address for a fiat invoice',
				action: 'Confirm payment token and network',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new payment invoice in fiat or crypto',
				action: 'Create an invoice',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve a single invoice by ID',
				action: 'Get an invoice',
			},
			{
				name: 'Get Many',
				value: 'getMany',
				description: 'Retrieve multiple invoices using cursor pagination',
				action: 'Get many invoices',
			},
			{
				name: 'Simulate Sandbox Payment',
				value: 'simulatePayment',
				description: 'Simulate a payment lifecycle outcome on a Sandbox invoice (pk_test_ only)',
				action: 'Simulate a sandbox invoice payment',
			},
		],
		default: 'create',
	},
];

export const invoiceFields: INodeProperties[] = [
	// ── Create ───────────────────────────────────────────────
	{
		displayName: 'Project ID',
		name: 'projectId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'prj_...',
		description: 'Prefixed project identifier (prj_...) that receives the invoice',
		displayOptions: {
			show: {
				resource: ['invoice'],
				operation: ['create'],
			},
		},
	},
	{
		displayName: 'Amount',
		name: 'amount',
		type: 'string',
		required: true,
		default: '',
		placeholder: '49.95',
		description: 'Exact order total as a decimal string (e.g. "49.95")',
		displayOptions: {
			show: {
				resource: ['invoice'],
				operation: ['create'],
			},
		},
	},
	{
		displayName: 'Currency',
		name: 'currency',
		type: 'string',
		required: true,
		default: 'USD',
		placeholder: 'USD, EUR, USDT, USDC, USD1, DAI, or XAUT',
		description: 'One of 45 supported fiat currency codes or a supported asset symbol (USDT, USDC, USD1, DAI, XAUT)',
		displayOptions: {
			show: {
				resource: ['invoice'],
				operation: ['create'],
			},
		},
	},
	{
		displayName: 'External Order ID',
		name: 'externalOrderId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'order-10042',
		description: 'Your unique order identifier (max 128 chars) used for idempotency per project',
		displayOptions: {
			show: {
				resource: ['invoice'],
				operation: ['create'],
			},
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['invoice'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Client ID',
				name: 'clientId',
				type: 'string',
				default: '',
				description: 'Your customer identifier (max 200 chars), echoed back on invoice reads and list items',
			},
			{
				displayName: 'Customer Fee Percent',
				name: 'customerFeePercent',
				type: 'number',
				typeOptions: {
					minValue: 0,
					maxValue: 100,
				},
				default: 0,
				description: 'Percentage of the processing fee passed to the payer (0-100), overriding the project default',
			},
			{
				displayName: 'Network',
				name: 'network',
				type: 'options',
				options: [
					{ name: 'Let Customer Choose', value: '' },
					...PAYMOS_NETWORK_OPTIONS,
				],
				default: '',
				description: 'Blockchain network to lock a crypto-denominated invoice to',
			},
			{
				displayName: 'Products',
				name: 'products',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				description: 'Optional list of 1 to 50 line items shown on hosted checkout',
				options: [
					{
						name: 'productValues',
						displayName: 'Product',
						values: [
							{
								displayName: 'Title',
								name: 'title',
								type: 'string',
								required: true,
								default: '',
								description: 'Product title (max 200 characters)',
							},
							{
								displayName: 'Description',
								name: 'description',
								type: 'string',
								default: '',
								description: 'Optional plain-text product description (max 2000 characters)',
							},
							{
								displayName: 'Quantity',
								name: 'quantity',
								type: 'number',
								typeOptions: {
									minValue: 1,
									numberPrecision: 0,
								},
								required: true,
								default: 1,
								description: 'Positive integer item quantity',
							},
							{
								displayName: 'Unit Amount',
								name: 'unitAmount',
								type: 'string',
								required: true,
								default: '',
								placeholder: '24.50',
								description: 'Unit price as a decimal string in the invoice currency',
							},
						],
					},
				],
			},
		],
	},

	// ── Shared Invoice ID ────────────────────────────────────
	{
		displayName: 'Invoice ID',
		name: 'invoiceId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'inv_...',
		description: 'Prefixed Paymos invoice identifier (inv_...)',
		displayOptions: {
			show: {
				resource: ['invoice'],
				operation: ['get', 'confirmPayment', 'cancel', 'simulatePayment'],
			},
		},
	},

	// ── Confirm Payment ──────────────────────────────────────
	{
		displayName: 'Asset',
		name: 'paymentCurrency',
		type: 'options',
		required: true,
		options: PAYMOS_ASSET_OPTIONS,
		default: 'USDT',
		description: 'Supported asset the customer chose to pay with',
		displayOptions: {
			show: {
				resource: ['invoice'],
				operation: ['confirmPayment'],
			},
		},
	},
	{
		displayName: 'Network',
		name: 'paymentNetwork',
		type: 'options',
		required: true,
		options: PAYMOS_NETWORK_OPTIONS,
		default: 'TRC20',
		description: 'Blockchain network the customer chose to pay on',
		displayOptions: {
			show: {
				resource: ['invoice'],
				operation: ['confirmPayment'],
			},
		},
	},

	// ── Cancel ───────────────────────────────────────────────
	{
		displayName: 'Reason',
		name: 'reason',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'Customer cancelled order',
		description: 'Cancellation reason stored on the invoice record (1 to 500 characters)',
		displayOptions: {
			show: {
				resource: ['invoice'],
				operation: ['cancel'],
			},
		},
	},

	// ── Simulate Sandbox Payment ─────────────────────────────
	{
		displayName: 'Stage',
		name: 'stage',
		type: 'options',
		required: true,
		options: [
			{ name: 'Cancel', value: 'cancel' },
			{ name: 'Overpaid', value: 'overpaid' },
			{ name: 'Paid', value: 'paid' },
			{ name: 'Paid Late', value: 'paid_late' },
			{ name: 'Underpay', value: 'underpay' },
		],
		default: 'paid',
		description: 'Sandbox outcome stage to simulate',
		displayOptions: {
			show: {
				resource: ['invoice'],
				operation: ['simulatePayment'],
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
				resource: ['invoice'],
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
				resource: ['invoice'],
				operation: ['getMany'],
				returnAll: [false],
			},
		},
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: {
				resource: ['invoice'],
				operation: ['getMany'],
			},
		},
		options: [
			{
				displayName: 'Created From (Unix Seconds)',
				name: 'createdFrom',
				type: 'number',
				default: 0,
				description: 'Filter invoices created at or after this Unix timestamp in seconds',
			},
			{
				displayName: 'Created To (Unix Seconds)',
				name: 'createdTo',
				type: 'number',
				default: 0,
				description: 'Filter invoices created before this Unix timestamp in seconds',
			},
			{
				displayName: 'Cursor',
				name: 'cursor',
				type: 'string',
				default: '',
				description: 'Optional opaque pagination cursor to start listing from',
			},
			{
				displayName: 'External Order ID',
				name: 'externalOrderId',
				type: 'string',
				default: '',
				description: 'Filter by exact merchant external order identifier',
			},
			{
				displayName: 'Project ID',
				name: 'projectId',
				type: 'string',
				default: '',
				placeholder: 'prj_...',
				description: 'Filter invoices belonging to a specific project (prj_...)',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'multiOptions',
				options: [
					{ name: 'Awaiting Client', value: 'awaiting_client' },
					{ name: 'Awaiting Payment', value: 'awaiting_payment' },
					{ name: 'Cancelled', value: 'cancelled' },
					{ name: 'Confirming', value: 'confirming' },
					{ name: 'Expired', value: 'expired' },
					{ name: 'Paid', value: 'paid' },
					{ name: 'Paid Over', value: 'paid_over' },
					{ name: 'Underpaid', value: 'underpaid' },
					{ name: 'Underpaid Waiting', value: 'underpaid_waiting' },
				],
				default: [],
				description: 'Filter by one or more invoice statuses',
			},
		],
	},
];
