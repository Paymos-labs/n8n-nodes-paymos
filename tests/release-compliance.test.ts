/* eslint-disable @n8n/community-nodes/no-restricted-imports */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('Release provenance workflow & product-facts compliance', () => {
	it('configures .github/workflows/publish.yml with id-token: write, tag guard, lint, audit, zero-deps, and --provenance', () => {
		const workflow = readFileSync(resolve(packageRoot, '.github/workflows/publish.yml'), 'utf8');

		expect(workflow).toMatch(/id-token:\s*write/);
		expect(workflow).toMatch(/tags:\s*\["v\*"\]/);
		expect(workflow).toContain('GITHUB_REF_NAME#v');
		expect(workflow).toContain('npm ci');
		expect(workflow).toContain('npm audit --omit=dev --audit-level=high');
		expect(workflow).toContain('pkg.dependencies');
		expect(workflow).toContain('npm test');
		expect(workflow).toContain('npm run check');
		expect(workflow).toContain('npm run lint');
		expect(workflow).toContain('npm run build');
		expect(workflow).toContain('npm pack');
		expect(workflow).toContain('npm publish --access public --provenance');
	});

	it('keeps README.md and Creator Portal checklist faithful to Paymos product facts', () => {
		const readme = readFileSync(resolve(packageRoot, 'README.md'), 'utf8');
		const checklist = readFileSync(resolve(packageRoot, 'docs/CREATOR_PORTAL_CHECKLIST.md'), 'utf8');
		const changelog = readFileSync(resolve(packageRoot, 'CHANGELOG.md'), 'utf8');

		expect(changelog).toContain('## [Unreleased]');
		expect(changelog).toContain('## [0.1.0]');

		for (const doc of [readme, checklist]) {
			// Assets: 4 stablecoins + gold-backed XAUT (never call XAUT a stablecoin)
			expect(doc).toContain('USDT');
			expect(doc).toContain('USDC');
			expect(doc).toContain('USD1');
			expect(doc).toContain('DAI');
			expect(doc).toContain('XAUT');
			expect(doc).toMatch(/gold-backed/i);
			expect(doc).not.toMatch(/\bXAUT\b[^.\n]{0,40}\bstablecoin\b/i);
			expect(doc).not.toMatch(/\b5\s+stablecoins\b/i);

			// Networks & fiat & webhook counts
			expect(doc).toContain('13');
			expect(doc).toContain('11');
			expect(doc).toContain('45');
			expect(doc).toContain('18');

			// AI Agent tool flag & self-hosted env variable
			expect(doc).toContain('usableAsTool');
			expect(doc).toContain('N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true');

			// Forbidden internal/inaccurate terms
			expect(doc).not.toMatch(/\b1Click\b/i);
			expect(doc).not.toMatch(/\bOneClick\b/i);
			expect(doc).not.toMatch(/\bNEAR Intents\b/i);
			expect(doc).not.toMatch(/\bsegregated funds\b/i);
			expect(doc).not.toMatch(/\bno KYC ever\b/i);
		}
	});
});
