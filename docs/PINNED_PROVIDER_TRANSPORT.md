# Provider health transport: pinned DNS + verified HTTPS

The Nest provider health probe now calls `pinnedProviderRequest`, not global fetch. It resolves all addresses once (2s DNS deadline), rejects the entire answer if any address is not public, and supplies a custom socket lookup returning only the selected validated address. `https.request` keeps the original hostname/Host/SNI and `rejectUnauthorized: true`; sockets are not reused and no redirects are followed. No proxy settings or alternate origin is selected by the application. Total request deadline is 8s in health, headers 16KiB, body 64KiB including chunked bytes. Error messages never include raw socket errors, URLs or credentials.

Health requests are now **HTTPS-only even if old XTREAM_ALLOW_HTTP is true**. Existing stored configuration is not rewritten; an HTTP-only health target reports HTTP_DISABLED without transmitting credentials. No production environment variable was changed.

## Executed evidence

- `pinned-provider-request.spec.ts`: 20 deterministic simulations: socket lookup pin, resolver changing to private on a hypothetical second lookup (which never happens), mixed answers, reserved/mapped/transition IPv6, redirect refusal, declared/chunked size, expired deadline, opaque DNS error.
- `pinned-provider-tls.spec.ts`: six real local TLS/HTTP tests: original SNI/Host, trusted certificate success, wrong hostname rejection, untrusted certificate rejection, actual redirect refusal, stalled response timeout and oversized bytes. The first item combines SNI and trusted success. These use actual Node HTTPS sockets, with only fixture DNS/routing injected to reach the local test server. They do not contact or establish authorization for an external provider. Test CA exists only in temporary files and is never added to production trust.
- Health service contract suite still tests invalid JSON, auth rejection, origin failure and unknown status honestly; transport is fixture-mocked in that suite and is not mislabeled as a real provider check.
- Full API after change: 31 suites / 319 tests passed; real PostgreSQL suite20 passed independently.

## Scope boundary

This closes the previously documented **Nest provider-health DNS check/connect gap**. It is not a certification of every outbound route. In particular, web `safe-fetch.ts` still has a separate preflight/fetch transport and its own rebinding window; migration of the streaming/redirect-capable web proxy needs separate compatibility tests. Metadata import does not perform any network I/O. New online synchronization must use a pinned transport, not reintroduce global fetch for operator URLs.
