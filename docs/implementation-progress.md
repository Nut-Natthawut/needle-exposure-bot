# Implementation progress

Plan: docs/superpowers/plans/2026-09-25-line-oa-needle-exposure.md

2026-10-03: User authorized implementation one step at a time. Current scope is
Ticket 1; continue with Ticket 2 in the next step.

Interface review: route.next entries use {routeId,label}; all later router and
renderer consumers must preserve this shape. Clinical content is separate from
UI copy. The validator initially checks schema only; corpus-level IDs, aliases
and link checks belong to Ticket 2.

Rulings: start a new development branch in this previously unversioned project.
Keep observability disabled to avoid automatic webhook metadata logging.
Use compatible current Wrangler/types and patched Vitest. Deployment bindings
will be generated from real configuration in Ticket 8; StateStore is only the
future adapter contract, not a handwritten deployment Env.

Ticket 1: complete. Tests were first run without schema/validator and failed;
after implementation, npm test passed 8/8 and npm run typecheck passed.
Wrangler deploy --dry-run successfully bundled the scaffold without deployment.
Installation audit reports zero vulnerabilities. npm run content:check fails
as expected because the real corpus is not yet created; this keeps deploy gated.

Next: Ticket 2, extract and verify PDF routes with source mapping. No credentials,
namespace IDs, clinical answers, or external deployments have been added.

Ticket 2: complete (2026-10-03). PDF visually inspected on all 3 pages;
automatic extraction contained damaged Thai glyphs, so transcription used the
rendered pages. Added 29 routes (27 enabled, 2 disabled), metadata, UI, aliases
and source-map inventory. Clinical whitespace and line wrapping are normalized;
wording, numbers, test names and drug names are preserved. Snapshot baseline
was read and compared against the rendered PDF before acceptance.

Rulings: IC06 is disabled because the source says Anti HBsAg positive; the
two-course Hepatitis B route is disabled because the source says vaccine HBIG.
Do not silently correct either. Related parent routes are listed under
metadata.partialRouteIds; Ticket 6 must render the partial-content warning.
Allow single-segment route IDs because notify is explicitly named in the plan.
Renderer snapshot verification belongs to Ticket 6, when the renderer exists.

Evidence: corpus tests failed before corpus creation; CLI valid/duplicate/link/
version tests then failed against the old validator before implementing checks.
Final content:check, typecheck, and suite passed 16/16. Source map lists the
conditions and branches; this does not certify the clinical correctness of the
source or publish the bot. Next: Ticket 3 deterministic router.

Ticket 3: complete (2026-10-03). Added pure resolveAction in src/domain/router.ts
with route/choices/fallback results. Exact postback IDs are checked first;
text checks active-context aliases before global aliases. Known follow-ups
without matching context yield missing_context. Disabled or missing alias
targets yield unavailable, rather than silently selecting remaining candidates.

Ruling: the spec does not list punctuation that can safely be removed, so only
trim and whitespace collapse are implemented. Case/punctuation/Thai spelling
remain exact; additional variants can be registered explicitly. Context expiry
is the state adapter's job in Ticket 5, not this pure function.

Evidence: initial route tests failed without module; against fallback stub,
14 behavioral assertions failed before implementation. All 26 router cases
then passed; complete suite 42/42, typecheck and content:check passed.
No LINE or Cloudflare deployment occurred. Next: Ticket 4 signature/webhook.

Ticket 4: complete (2026-10-03). POST /webhook verifies raw bytes using Web
Crypto HMAC-SHA256 before parsing; missing/invalid signature returns 401.
Event normalizer accepts repliable message-text/postback/follow only from user
sources. Group/room and image/file/audio are acknowledged without replies.
Empty LINE verification events return 200. Reply client awaits fixed LINE API
POST with a 5-second timeout and no automatic retries, response-body logging,
or redirect following. HTTP/network failures return generic webhook 502.

Rulings: read webhook bodies with an explicit 256 KiB cap to bound memory.
Introduce a minimal text/Quick Reply renderer now so reply payloads are usable;
full Flex styling and reporting/contact actions remain Ticket 6. Preserve each
clinical text as a separate unmodified text message, with a separate partial
warning when needed. Add generated Env types from secrets.required (names only)
instead of handwritten deployment types. No real secrets or KV IDs were added.

Evidence: signature/reply/webhook tests first failed against missing modules
and then 22 behavioral assertions failed against stubs. Final suite 76/76,
typecheck and content:check pass; Wrangler dry-run bundle 47.30 KiB. Tests use
Node HMAC to sign and Web Crypto to verify, and inspect actual outbound HTTP
payloads with a local fake transport; no LINE requests sent. Logging regression
checks ensure raw test HN and credentials are not emitted on reply failures.

References: LINE verify-webhook-signature and receiving-messages docs, plus
Cloudflare secrets.required configuration retrieved 2026-10-03. Actual Worker
CPU, KV behavior and live LINE delivery are still release-stage checks.
Next: Ticket 5, short-lived KV context and best-effort event dedup.

Ticket 5: complete (2026-10-09). Added KV adapter with HMAC-SHA256 user keys
using a separate HMAC_SECRET, context TTL 1800 seconds and SHA-256 event keys
with TTL 86400 seconds. Values contain only route/expiration or expiration,
never chat text or raw identifiers. Validate embedded expiration on reads.
Webhook checks event markers before replying and marks only successful replies;
updates context only after successful delivery. Explicit reset and successful
choices/fallback/follow clear context. KV errors never turn delivered replies
into errors; direct routes still work without KV/HMAC. Request-local caches
preserve batch ordering and suppress duplicate events within a single request.

Rulings: failed topic writes attempt deletion of old context. Invalidation,
latest-topic reads and cross-request dedup remain best effort: eventual
consistency can expose older unexpired records, concurrent requests can both
reply, and a crash between reply and marker write permits redelivery. TTL
checks prevent expired context, not all stale context. Strong guarantees need
a different state store; do not describe KV as a lock or exactly-once delivery.
Bind STATE_KV locally without a fabricated namespace ID; generate Env from
config including HMAC_SECRET. Real namespace/secrets are deferred to Ticket 8.

Evidence: missing-module RED then fallback stub RED (9 behavioral failures);
final suite 105/105 across 9 files, typecheck and content:check passed.
Wrangler dry-run bundled 51.89 KiB with STATE_KV binding without uploading.
Failure tests simulate quota/rate-limit/stale-null reads; they do not measure
actual Cloudflare replication, quotas or CPU. No remote resource or LINE call.
Next: Ticket 6, Flex replies and navigation.
