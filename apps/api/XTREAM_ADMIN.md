# Xtream server administration

Xtream server credentials are managed only by authenticated tenant administrators through the Admin API.

## Required API configuration

Set `XTREAM_ENCRYPTION_KEY` on every API instance to a randomly generated 32-byte key encoded as 64 hexadecimal characters:

```sh
openssl rand -hex 32
```

Keep the same key across API instances and backups. Store it in the deployment secret manager; never commit the real value. Losing this key makes stored Xtream passwords unrecoverable.

Apply the migration and regenerate Prisma Client from `apps/api`:

```sh
npx prisma migrate deploy
npx prisma generate
```

The demo seed grants `xtream:manage` to its Administrator role. Existing production roles must be granted that permission through the deployment's controlled role-management process; do not run the demo seed in production.

## Admin API

All routes require an Admin JWT and the `xtream:manage` permission. Tenant scope is taken from the authenticated admin principal.

- `GET /admin/xtream-servers`
- `POST /admin/xtream-servers`
- `PATCH /admin/xtream-servers/:id`
- `PATCH /admin/xtream-servers/:id/toggle`
- `DELETE /admin/xtream-servers/:id`

Passwords are encrypted with AES-256-GCM before storage and are never returned by API responses. The admin web app proxies these requests through same-origin API routes so credentials are not sent directly from the browser to the Xtream host.

## Network and content requirements

Use only Xtream endpoints and content sources that you own or are explicitly licensed to distribute. Use HTTPS for browser-to-admin and admin-to-API traffic. The configured upstream may currently be HTTP; that connection is not encrypted, so credentials and traffic may be observable on the network. A connection-test operation is intentionally not exposed until upstream request handling includes DNS/IP validation and a documented credential-handling policy.
