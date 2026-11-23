# Changelog

All notable changes to `n8n-nodes-paymos` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-11-23

### Added

- `PaymosApi` credential (`paymosApi`) with Payment API key validation (`pk_live_` / `pk_test_`, rejecting `rk_` payout keys), optional `whsec_` webhook secret, HMAC-SHA256 request signing on built-in `node:crypto`, and programmatic `paymosApiTest` (`GET /v1/invoices?limit=1`).
- `Paymos` action node with `usableAsTool: true` for n8n AI Agent workflows and 18 operations across 4 resources:
  - **Invoice**: Create, Get, Get Many (cursor pagination), Confirm Payment, Cancel, Simulate Sandbox Payment.
  - **Payment Channel**: Create, Get, Get Many (cursor pagination), Block, Unblock, Simulate Sandbox Deposit.
  - **Payment Channel Deposit**: Get, Get Many (single-page cursor feed polling returning `{ items, next_cursor, blocked? }`).
  - **Refund**: Create (`full` or `overpayment`), Get, Get Many (cursor pagination), Simulate Sandbox Refund.
- `Paymos Trigger` webhook node covering all 18 canonical Paymos webhook events plus wildcard (`*`), raw-body `X-Webhook-Signature` verification with multi-`v1=` rotation support and 300-second timestamp tolerance.
- Zero runtime npm dependencies (`"dependencies": {}`), `@n8n/node-cli` compliance, SDK conformance vectors, and GitHub Actions npm `--provenance` release workflow.
