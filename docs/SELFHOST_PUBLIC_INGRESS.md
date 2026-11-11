# Opt-in self-hosted authenticated ingress

Status: implementation plus isolated real TLS/mTLS integration. **Not a public
infrastructure certificate.** Existing loopback package and fab1577 lifecycle are
unchanged. Never set VERCEL=1 to fabricate hosting provenance.

## Trust chain

1. An operator-owned HTTPS nginx edge terminates public TLS, performs a local
   country-MMDB lookup of **its TCP peer**, not client-selected forwarding headers.
   It replaces country/IP headers and authenticates to the private gateway using
   a client certificate issued by a **dedicated edge-client CA**.
2. `scripts/ingress/gateway.mjs` requires verified mTLS, rejects absent/ambiguous
   country/IP, removes incoming forwarded/platform/Geo assertions, and signs a
   five-second envelope binding method, original URL and credential transport.
   Host and HTTPS routing metadata come from the configured public origin.
3. The web issuer verifies this envelope with a separate SELFHOST_EDGE_SECRET,
   then issues the existing title/user-bound backend assertion with a new nonce.
   Missing/forged/expired/misbound envelopes never fall back to browser headers.
4. The organization BFF reaches the API through a certificate-verified private
   nginx TLS listener; backend session, tenant, license, rights, expiry and replay
   checks remain authoritative on every media object.

TLS is not itself geolocation. Anyone holding the edge client certificate can
assert country: protect its private key, dedicate the CA, audit the lookup and
rotate compromised credentials. The five-second envelope is not a bearer grant;
internal transport and network isolation remain mandatory (do not expose web
HTTP). Backend media replay ledgers are unchanged. No claim of cross-replica
single-use edge envelopes is made.

## Operator setup (not performed here)

Use existing customer-owned Linux hardware. Obtain a current country MMDB with
lawful redistribution/use rights (for example DB-IP Lite under its published
attribution terms, or MaxMind under its account/license terms). Review accuracy,
VPN/proxy limitations, jurisdiction and update/retention policy. A constant
country is never an acceptable production substitute.

Install nginx and its distro-supported GeoIP2 module. Adapt
`infra/docker/public-edge.nginx.example.conf`, including owned DNS, a valid public
certificate and MMDB path. Test `nginx -t`. This is a template, not an applied
public firewall/DNS/certificate configuration.

Create a private cert directory outside Git. It must contain:
- gateway-key.pem and gateway-cert.pem (SAN `gateway`), plus edge-client-ca.pem;
- api-key.pem and api-cert.pem (SAN `api-gateway`), plus api-ca.pem for web;
- on the outer edge only: edge-client.pem, its private key, and gateway-ca.pem.
The node UID 1000 gateway must be able to read its key (use a dedicated group or
operator-owned bind mounts, not world-readable keys). Never copy any key into an
image. Use a dedicated, random 32-byte-or-longer SELFHOST_EDGE_SECRET, distinct
from EXTERNAL_GEO_SIGNING_KEY, and an exact HTTPS VOD_PUBLIC_ORIGIN.

The public edge's auth-ca.pem must be the package Auth certificate's CA/trust
anchor (the local self-signed cert in the default fixture); /auth/v1/ is forwarded
over verified TLS to the loopback Auth gateway, not exposed as a direct API.
The overlay rebuilds the browser Supabase URL as VOD_PUBLIC_ORIGIN and configures
GoTrue's external URL/site URL to that same owned HTTPS origin. Rebuild web when
changing it; runtime env alone cannot replace Next's compiled public URL.
Favorites/REST sync still requires separately supplied PostgREST/RLS; the overlay
does not pretend to provide it. Internet email delivery is not configured.

Set SELFHOST_INGRESS_ROOT to the absolute cert directory. Add
`-f infra/docker/compose.ingress.yml` **after** the existing three package compose
files. This overlay is intentionally not silently enabled by lifecycle commands.
Record all operator overlays in your deployment/backup procedure. It is not part
of the verified default lifecycle, so rehearse overlay-specific recovery before
acceptance. No public deployment is authorized by these instructions.

Firewall both Docker published ports AND container networks: only the outer edge
may reach gateway 9443; no Internet path to web/API/admin/storage. Default package
ports remain loopback for compatibility. Docker firewall routing must be audited
on the actual host; a nominal UFW rule is not evidence of isolation.

## Reproducible verification

`node scripts/ingress/test-ingress.mjs` creates disposable CA/server/client certs,
uses actual TLS and reverse-proxy sockets, denies uncertified clients, validates
header stripping and request/credential binding. Its country/IP are explicitly
synthetic. Existing VOD and tenant/expiry denial suites remain mandatory.

Required public acceptance: prove actual TCP peer lookup, MMDB/license/update
provenance, no alternate web/API path, client-key/CA ownership and rotation,
trusted public certificate chain, real spoofing requests from an authorized
external machine and complete organization-library browser playback. Those
resources/permissions have not been supplied and no public test is claimed.
