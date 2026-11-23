import type { Icon, ICredentialType, INodeProperties } from 'n8n-workflow';

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
}
