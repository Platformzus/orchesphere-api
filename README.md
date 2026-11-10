# OrcheSphere API

Public documentation, OpenAPI contract and client examples for OrcheSphere.

**Release status: pending.** This repository contains the prepared developer API contract and examples. The new REST service, developer application registration and API documentation domain have not yet completed a verified production rollout. The addresses below are the intended release addresses; wait for this notice to be removed before expecting the new flow to work.

- [Documentation](https://api.orchesphere.ai)
- [Register an application](https://orchesphere.ai/orchesphere/developers)
- [OpenAPI](https://api.orchesphere.ai/openapi.json)
- [OAuth guide](https://api.orchesphere.ai/authentication)
- [MCP reference](https://api.orchesphere.ai/reference/mcp)

The REST API exposes assigned workspaces, permitted connections and portals, tasks, and saved verification jobs. It applies the consenting user's current company and service permissions on every call. A provider directory entry or saved connection is not evidence of live provider access. There is no general provider business-record API.

## Addresses and authorization

| Purpose | Address |
| --- | --- |
| REST API | `https://api.orchesphere.ai/v1` |
| REST OAuth resource | `https://api.orchesphere.ai` |
| OAuth issuer | `https://orchesphere.ai` |
| MCP endpoint and resource | `https://orchesphere.ai/mcp` |

Register a public client with an exact redirect URI and explicit scopes. Use authorization code with PKCE S256; there is no client secret or client-credentials grant. REST and MCP tokens have distinct resources. Always send the same resource during authorization, code exchange and refresh. Scopes do not grant company access. Registered apps cannot request the internal platform-administration scope.

The first release supports backend and native clients. It does not enable cross-origin browser API calls. Keep tokens and PKCE verifiers out of URLs. An authorization code returns through the registered callback query; do not log or share callback URLs. Keep codes, tokens and verifiers out of logs, analytics, public repositories and browser storage.

## Try the OAuth example

Use Node.js 22 or later. In [My applications](https://orchesphere.ai/orchesphere/developers), register `http://127.0.0.1:8788/callback` exactly and allow `orchesphere.read` and `offline_access`.

```sh
git clone https://github.com/PlatformzHQ/orchesphere-api.git
cd orchesphere-api
export ORCH_CLIENT_ID="orch_app_YOUR_REGISTERED_ID"
node examples/oauth-client.mjs
```

On PowerShell, set `$env:ORCH_CLIENT_ID = 'orch_app_YOUR_REGISTERED_ID'` before running Node. The client ID is a public application identifier, not a secret.

The example opens a local callback listener, prints an authorization URL, validates the one-use state and issuer, exchanges the code, reads assigned workspaces, refreshes once and revokes the example grant. It keeps credentials in memory and prints only status/counts. It does not create tasks, configure connections or submit verification jobs. Run it deliberately with your registered application; the test suite uses synthetic requests and no live grants.

For an existing token supplied by your application's protected environment, `examples/api-client.mjs` provides a bounded JavaScript read helper and `examples/read-workspaces.py` provides a standard-library Python read client. See [Examples](https://api.orchesphere.ai/examples).

## Build and check the documentation

No package installation is required for the docs generator, examples or tests.

```sh
node --test tests/*.test.mjs
node scripts/build.mjs
node scripts/check-public.mjs
node scripts/preview.mjs
```

Open `http://127.0.0.1:4177`. The local preview serves the generated site through the Worker router and deliberately disables all live API forwarding. Build output goes to `dist/`; generated route data goes to `src/generated.mjs`. Neither belongs in source control.

The builder reads `openapi.json` and `reference.json` and rejects route disagreement or missing schemas. Each REST operation and MCP tool gets a searchable documentation page. Keep contract changes synchronized with the service implementation; changing this repository alone does not change the API.

## Request boundaries

REST requests use uncompressed JSON, at most 24,000 bytes. V1 accepts no query parameters, pagination offsets, trailing slashes or encoded path components. Lists are capped at 200 records, or 100 for jobs; `page.mayHaveMore` is conservative and is not an exact total.

Verification requires an `Idempotency-Key`. Reuse it only for the same submission. The proxy never retries a mutation. Task creation has no idempotent retry guarantee: reconcile a lost response before resubmitting. Current company allowance and permission checks can deny work even when the OAuth scope is present.

## Public Worker

`src/worker.mjs` serves an explicit static-file allowlist and forwards only the contract's supported REST methods and paths to a fixed OrcheSphere backend. It strips website cookies and unrelated headers, does not follow upstream redirects, and marks API responses private and non-cacheable. Authorization and tenant policy are enforced by the backend. No credentials or account identifiers are needed in this source tree.

`wrangler.jsonc` describes the public custom domain and static assets. Deployment requires an authorized Cloudflare account and is separate from a local preview or test run. Request observability is disabled in this Worker configuration; no application code logs tokens or request bodies.

`scripts/check-public.mjs` checks the explicit publication allowlist, rejects unexpected files and symlinks, and returns SHA-256 hashes. Generated output, local dependencies, credentials and private service source are excluded. The public tree contains no private application backend or customer records.

## Support and security

Use GitHub issues for reproducible documentation problems without tokens, authorization codes, customer data or private request bodies. For a security concern, use the contact route on the [OrcheSphere security page](https://orchesphere.ai/security). See the [privacy notice](https://orchesphere.ai/legal/privacy).
