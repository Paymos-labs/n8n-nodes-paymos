/* eslint-disable @n8n/community-nodes/no-restricted-imports */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Paymos } from '../nodes/Paymos/Paymos.node';
import { PaymosTrigger } from '../nodes/PaymosTrigger/PaymosTrigger.node';
import { PAYMOS_N8N_USER_AGENT } from '../src/transport/PaymosTransport';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('n8n Verified Community Node compliance', () => {
	it('enforces zero runtime dependencies, files:[dist], keywords, and n8n manifest entrypoints', () => {
		const pkg = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')) as {
			name: string;
			version: string;
			keywords: string[];
			files: string[];
			dependencies?: Record<string, string>;
			peerDependencies?: Record<string, string>;
			n8n: {
				n8nNodesApiVersion: number;
				credentials: string[];
				nodes: string[];
			};
			scripts: Record<string, string>;
		};

		expect(pkg.name).toBe('n8n-nodes-paymos');
		expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
		expect(PAYMOS_N8N_USER_AGENT).toBe(`paymos-n8n/${pkg.version}`);
		expect(pkg.keywords).toContain('n8n-community-node-package');
		expect(Object.keys(pkg.dependencies ?? {})).toEqual([]);
		expect(pkg.peerDependencies?.['n8n-workflow']).toBe('*');
		expect(pkg.files).toEqual(['dist']);
		expect(pkg.files).not.toContain('tests');
		expect(pkg.files).not.toContain('conformance');

		expect(pkg.n8n.n8nNodesApiVersion).toBe(1);
		expect(pkg.n8n.credentials).toEqual(['dist/credentials/PaymosApi.credentials.js']);
		expect(pkg.n8n.nodes).toEqual([
			'dist/nodes/Paymos/Paymos.node.js',
			'dist/nodes/PaymosTrigger/PaymosTrigger.node.js',
		]);

		// Source TS counterparts always exist; if dist/ is built, verify compiled files exist too.
		const expectedSources = [
			'credentials/PaymosApi.credentials.ts',
			'nodes/Paymos/Paymos.node.ts',
			'nodes/PaymosTrigger/PaymosTrigger.node.ts',
		];
		for (const rel of expectedSources) {
			expect(existsSync(resolve(packageRoot, rel)), rel).toBe(true);
		}
		if (existsSync(resolve(packageRoot, 'dist'))) {
			for (const rel of [...pkg.n8n.credentials, ...pkg.n8n.nodes]) {
				expect(existsSync(resolve(packageRoot, rel)), rel).toBe(true);
			}
		}

		expect(pkg.scripts.lint).toContain('n8n-node lint');
		expect(pkg.scripts.build).toContain('n8n-node build');
		expect(pkg.scripts.check).toContain('tsc --noEmit');
		expect(pkg.scripts.test).toContain('vitest');
	});

	it('includes committed package-lock.json, .gitignore, and MIT LICENSE', () => {
		const lockPath = resolve(packageRoot, 'package-lock.json');
		expect(existsSync(lockPath)).toBe(true);
		const pkg = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')) as {
			name: string;
			version: string;
		};
		const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as {
			name: string;
			version: string;
			packages?: Record<string, { version?: string; dependencies?: Record<string, string> }>;
		};
		expect(lock.name).toBe(pkg.name);
		expect(lock.version).toBe(pkg.version);
		expect(lock.packages?.['']?.version).toBe(pkg.version);
		expect(Object.keys(lock.packages?.['']?.dependencies ?? {})).toEqual([]);

		const gitignore = readFileSync(resolve(packageRoot, '.gitignore'), 'utf8');
		for (const pattern of ['node_modules/', 'dist/', 'coverage/', '*.tsbuildinfo', '*.tgz']) {
			expect(gitignore).toContain(pattern);
		}

		const license = readFileSync(resolve(packageRoot, 'LICENSE'), 'utf8');
		expect(license).toContain('MIT License');
		expect(license).toContain('Paymos Labs');
	});

	it('sets usableAsTool: true on Paymos node and keeps SVG icons <= 10 KB', () => {
		const paymos = new Paymos();
		const trigger = new PaymosTrigger();

		expect(paymos.description.usableAsTool).toBe(true);
		expect(paymos.description.name).toBe('paymos');
		expect(trigger.description.name).toBe('paymosTrigger');

		for (const svgRel of ['nodes/Paymos/paymos.svg', 'nodes/Paymos/paymos.dark.svg']) {
			const svgPath = resolve(packageRoot, svgRel);
			expect(existsSync(svgPath), svgRel).toBe(true);
			const size = statSync(svgPath).size;
			expect(size, `${svgRel} size`).toBeGreaterThan(0);
			expect(size, `${svgRel} size <= 10 KB`).toBeLessThanOrEqual(10 * 1024);
			const content = readFileSync(svgPath, 'utf8');
			expect(content).toContain('<svg');
			expect(content).toContain('</svg>');
		}
	});

	it('contains no AI-agent instruction files (AGENTS.md / CLAUDE.md) in package root', () => {
		expect(existsSync(resolve(packageRoot, 'AGENTS.md'))).toBe(false);
		expect(existsSync(resolve(packageRoot, 'CLAUDE.md'))).toBe(false);
	});
});
