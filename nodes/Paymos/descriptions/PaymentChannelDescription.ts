import type { INodeProperties } from 'n8n-workflow';
import { PAYMOS_ASSET_OPTIONS, PAYMOS_NETWORK_OPTIONS } from './InvoiceDescription';

export const paymentChannelOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['paymentChannel'],
			},
		},
		options: [
			{
				name: 'Block',
				value: 'block',
				description: 'Stop attributing new deposits to a payment channel',
				action: 'Block a payment channel',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Idempotently create or retrieve a permanent deposit identity for a customer',
				action: 'Create a payment channel',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve a payment channel with its provisioned network addresses and minimums',
				action: 'Get a payment channel',
			},
			{
				name: 'Get Many',
				value: 'getMany',
				description: 'Retrieve multiple payment channels using cursor pagination',
				action: 'Get many payment channels',
			},
			{
				name: 'Simulate Sandbox Deposit',
				value: 'simulateDeposit',
				description: 'Simulate a deposit on a Sandbox payment channel (pk_test_ only)',
				action: 'Simulate a sandbox channel deposit',
			},
			{
				name: 'Unblock',
				value: 'unblock',
				description: 'Resume attributing new deposits to a payment channel',
				action: 'Unblock a payment channel',
			},
		],
		default: 'create',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['paymentChannelDeposit'],
			},
		},
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve a single payment channel deposit by ID in any state',
				action: 'Get a payment channel deposit',
			},
			{
				name: 'Get Many',
				value: 'getMany',
				description: 'Poll one page of the confirmed payment channel deposit feed and return items plus next_cursor',
				action: 'Poll confirmed payment channel deposits',
			},
		],
		default: 'getMany',
	},
];

export const paymentChannelFields: INodeProperties[] = [
	// ── Payment Channel: Create ──────────────────────────────
	{
		displayName: 'Project ID',
		name: 'channelProjectId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'prj_...',
		description: 'Prefixed project identifier (prj_...) that owns the payment channel',
		displayOptions: {
			show: {
				resource: ['paymentChannel'],
				operation: ['create'],
			},
		},
	},
	{
		displayName: 'External ID',
		name: 'externalId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'customer-42',
		description: 'Your stable customer identifier (max 128 chars). Repeating the same project and external ID returns the existing channel.',
		displayOptions: {
			show: {
				resource: ['paymentChannel'],
				operation: ['create'],
			},
		},
	},

	// ── Payment Channel: Shared ID ───────────────────────────
	{
		displayName: 'Payment Channel ID',
		name: 'paymentChannelId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'pch_...',
		description: 'Prefixed payment channel identifier (pch_...)',
		displayOptions: {
			show: {
				resource: ['paymentChannel'],
				operation: ['get', 'block', 'unblock', 'simulateDeposit'],
			},
		},
	},

	// ── Payment Channel: Simulate Sandbox Deposit ────────────
	{
		displayName: 'Amount',
		name: 'depositAmount',
		type: 'string',
		required: true,
		default: '',
		placeholder: '100.00',
		description: 'Simulated deposit amount as a decimal string (e.g. "100.00")',
		displayOptions: {
			show: {
				resource: ['paymentChannel'],
				operation: ['simulateDeposit'],
			},
		},
	},
	{
		displayName: 'Asset',
		name: 'depositCurrency',
		type: 'options',
		required: true,
		options: PAYMOS_ASSET_OPTIONS,
		default: 'USDT',
		description: 'Supported asset enabled on the project',
		displayOptions: {
			show: {
				resource: ['paymentChannel'],
				operation: ['simulateDeposit'],
			},
		},
	},
	{
		displayName: 'Network',
		name: 'depositNetwork',
		type: 'options',
		required: true,
		options: PAYMOS_NETWORK_OPTIONS,
		default: 'TRC20',
		description: 'Blockchain network code for the simulated deposit',
		displayOptions: {
			show: {
				resource: ['paymentChannel'],
				operation: ['simulateDeposit'],
			},
		},
	},
	{
		displayName: 'Stage',
		name: 'depositStage',
		type: 'options',
		options: [
			{ name: 'Confirmed', value: 'confirmed' },
			{ name: 'Confirming', value: 'confirming' },
			{ name: 'Reorged', value: 'reorged' },
		],
		default: 'confirmed',
		description: 'Lifecycle stage to drive the simulated deposit to',
		displayOptions: {
			show: {
				resource: ['paymentChannel'],
				operation: ['simulateDeposit'],
			},
		},
	},

	// ── Payment Channel: Get Many ────────────────────────────
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: {
			show: {
				resource: ['paymentChannel'],
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
				resource: ['paymentChannel'],
				operation: ['getMany'],
				returnAll: [false],
			},
		},
	},
	{
		displayName: 'Filters',
		name: 'channelFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: {
				resource: ['paymentChannel'],
				operation: ['getMany'],
			},
		},
		options: [
			{
				displayName: 'Cursor',
				name: 'cursor',
				type: 'string',
				default: '',
				description: 'Optional opaque pagination cursor to start listing from',
			},
			{
				displayName: 'External ID',
				name: 'externalId',
				type: 'string',
				default: '',
				description: 'Filter by exact customer external ID',
			},
			{
				displayName: 'Project ID',
				name: 'projectId',
				type: 'string',
				default: '',
				placeholder: 'prj_...',
				description: 'Filter channels belonging to a specific project (prj_...)',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'multiOptions',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Blocked', value: 'blocked' },
					{ name: 'Provisioning', value: 'provisioning' },
				],
				default: [],
				description: 'Filter by one or more payment channel statuses',
			},
		],
	},

	// ── Payment Channel Deposit: Get ─────────────────────────
	{
		displayName: 'Deposit ID',
		name: 'depositId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'pcd_...',
		description: 'Prefixed payment channel deposit identifier (pcd_...)',
		displayOptions: {
			show: {
				resource: ['paymentChannelDeposit'],
				operation: ['get'],
			},
		},
	},

	// ── Payment Channel Deposit: Get Many (single-page cursor poll) ──
	{
		displayName: 'Limit',
		name: 'depositFeedLimit',
		type: 'number',
		typeOptions: {
			minValue: 1,
			maxValue: 100,
		},
		default: 20,
		description: 'Max number of confirmed deposits to fetch in this single poll page (1-100)',
		displayOptions: {
			show: {
				resource: ['paymentChannelDeposit'],
				operation: ['getMany'],
			},
		},
	},
	{
		displayName: 'Cursor',
		name: 'depositFeedCursor',
		type: 'string',
		default: '',
		description: 'Watermark cursor returned as next_cursor by the previous poll. Store and pass on every subsequent poll.',
		displayOptions: {
			show: {
				resource: ['paymentChannelDeposit'],
				operation: ['getMany'],
			},
		},
	},
	{
		displayName: 'Filters',
		name: 'depositFilters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: {
				resource: ['paymentChannelDeposit'],
				operation: ['getMany'],
			},
		},
		options: [
			{
				displayName: 'Confirmed From (Unix Seconds)',
				name: 'confirmedFrom',
				type: 'number',
				default: 0,
				description: 'Initial-sync lower bound in Unix seconds (used on the first poll before resuming via cursor)',
			},
			{
				displayName: 'Payment Channel ID',
				name: 'paymentChannelId',
				type: 'string',
				default: '',
				placeholder: 'pch_...',
				description: 'Filter confirmed deposits belonging to a specific payment channel (pch_...)',
			},
			{
				displayName: 'Project ID',
				name: 'projectId',
				type: 'string',
				default: '',
				placeholder: 'prj_...',
				description: 'Filter confirmed deposits belonging to a specific project (prj_...)',
			},
		],
	},
];
