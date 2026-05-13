# Defer the packages/db repository seam until tests exist

Every `apps/api/src/registry/*` module reaches into `@loadclass/db` and writes drizzle queries directly. The architecture review proposed extracting a `templateRepo` module to wrap those queries — locality for schema changes, leverage for tests. We are deferring it.

The decision rule we use for seams: *one adapter is a hypothetical seam; two are real.* A repo seam's second adapter is the fake the tests use. No tests cross any registry module today, so the seam would be pure indirection — ~7 files churned, every drizzle call rewrapped, for a benefit that only materializes when a schema change happens to land near a future maintainer.

**Trigger to reopen:** the first integration test for `publishing.ts`, `template-read-model.ts`, or `download-accounting.ts`. Once a test wants to substitute the DB, the repo seam earns its keep and the candidate is reclassified Strong.
