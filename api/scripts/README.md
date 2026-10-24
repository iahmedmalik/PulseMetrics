# Database role checks

From `api/`, with the two runtime URLs in the ignored `.env.local`:

```sh
node --env-file=.env.local scripts/check-security.mjs --expected-host=YOUR_DEVELOPMENT_DATABASE_HOST
```

Use the exact hostname from the development URLs, including `-pooler` when present. The script refuses a different host or different databases between the URLs. It uses the existing runtime roles and requires no database-owner password.

Checks cover runtime role attributes and membership, RLS on all seven tables, direct table privileges, ingest function privileges, owner A/B site isolation, an empty owner context and context reset after a transaction. Temporary account and site fixtures are rolled back even when a check fails. Actual event ingestion and report reads are also covered by the API integration tests.

The four authentication tables have explicit policies for the trusted backend application role. Better Auth must look up an account before an owner session exists, so these policies allow that backend role to manage authentication rows. They do not provide per-user isolation within those tables; the authentication API enforces that boundary. Database credentials belong only on the API server. The ingest role has no direct table privileges, and neither runtime may access the migration ledger.
