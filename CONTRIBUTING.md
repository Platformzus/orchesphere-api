# Updating the API reference

Update documentation in the same change as an API capability. Publish only implemented, reviewed contracts; keep planned capabilities on the coverage page without invented endpoint paths or release dates.

## Source files

- `openapi.json`: REST methods, paths, scopes, parameters, schemas and errors.
- `reference.json`: reviewed REST examples/guidance, exact MCP tool definitions, limits and provider identity coverage.
- `documentation.json`: dated reference revision, MCP explanations and synthetic results, OAuth/discovery endpoint guidance.
- `src/content.mjs` and `src/catalog-pages.mjs`: guides, coverage and dated changelog.

Keep descriptions for every schema field, including nested properties and path/header parameters. Each operation needs a useful name, purpose, current authority, inputs, result, effects, retry behavior and limitations. MCP definitions must match `tools/list`; MCP results are not REST envelopes.

## Required checks

```sh
node scripts/check-docs.mjs
node --test tests/*.test.mjs
node scripts/build.mjs
node scripts/check-public.mjs
```

The public workflow runs these checks on pushes and pull requests. No deployment credentials are required and this workflow does not deploy. Check failures must be resolved before publication.

For application changes, also run the private application's contract-sync test and required release tests. Those tests compare actual REST route/scope definitions and MCP `tools/list` with the packaged contracts. The private source preflight additionally checks that packaged contracts and this public export agree. Public CI alone cannot inspect private implementation or certify live provider access.

## Release record

1. Update the review date and revision in `documentation.json` and add a dated changelog entry describing behavior changes or documentation corrections.
2. Run the checks against the exact candidate and review the generated pages at desktop and mobile widths, including search and internal links.
3. Export only the explicit `PUBLIC_FILES` inventory. Never copy private source history, local configuration, customer data or credentials into this repository.
4. Publish through the existing reviewed release process. Recheck the currently deployed version to preserve concurrent changes.
5. Verify live page bytes, resource discovery and anonymous authorization boundaries. The generated `/documentation-version.json` identifies the review date and contract/guidance fingerprint.

Descriptions and tests need human review. The fingerprint identifies documentation inputs; it is not a backend deployment certificate. Keep real account tokens and production responses out of examples.
