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

2026-10-10: User moved pilot deployment from Ticket 8 ahead of Tickets 6–7.
Webhook Verify succeeds but real chat receives webhook 502. Temporary narrow
reply diagnostics authorized by user, following Matt Pocock diagnosing-bugs.
Added gated [DEBUG-reply-502] code/status warning and config flag; persistent
observability remains disabled. Diagnostic tests first failed 5 assertions;
full suite now 112/112, typecheck/content validation and dry-run pass.
Actual upstream result must be captured before proposing a root-cause fix.
See reply-failure-diagnosis.md; diagnosis and debug cleanup remain unfinished.

2026-10-10 reply investigation: live probe captured network_error/status null.
Reproduced native workerd exception: unsupported redirect:error. Three real
transport regression tests failed before changing to redirect:manual, then
passed; signed full webhook runtime test also passes. Fake transport remains
only at the external HTTP boundary, not at Workers fetch. No redirects are
followed. Full suite 116/116; typecheck/content:check/dry-run pass. Patched dev
toolchain resolves sharp-related audit findings (zero remaining advisories).
Await live deployment/chat confirmation before declaring the bot fixed and
removing temporary diagnostic instrumentation. Source clinical content unchanged.

2026-10-11: User confirms the previous version now replies in LINE. Temporary
diagnostics remain; their removal is not included in the visual renderer task.

Ticket 6: implemented and locally verified (2026-10-11), on the user's chosen
existing folder/branch. Rechecked all 3 supplied PDF pages; no clinical text,
numbers, sources, links, or enabled flags changed. Only presentation changed
for 23 detailed routes; 4 short routes stay text, and 2 ambiguous routes stay
disabled. Source snapshots were not updated. See content-review.md for limits.

Added white/mint Flex cards, compact numbered markers, complete next/choice
postbacks, partial warnings, six-topic home navigation, existing report warning
followed by the exact Google Form URI and copyable URL, and contact-pending copy.
Known UI aliases are exact allowlisted commands. Unknown text gets fallback/home;
known image/file/audio 1:1 messages receive unsupported/home without file analysis.
Only successful replies update event markers/context. No changes to signatures,
secrets, storage architecture, billing, public PDF access, or medical recommendations.

Rulings: preserve the schema's flex presentation (not a new steps type). Explicit
spec excludes source footers in MVP; metadata remains internal. No mascot hosting
endpoint, fabricated image URL, or Rich Menu installation. Quick Reply labels
over 20 characters are omitted from shortcuts, not shortened; full labels remain
on Flex buttons. Clarified the contradictory unsupported-event wording: unknown
events stay ignored, but known 1:1 media receives the approved UI fallback.

Evidence: initial renderer RED (44 missing-function failures), navigation RED
(6 assertions), then integration consumers updated to read the new format rather
than changing clinical expectations. Long Quick Reply qualifier test failed
before removing truncation; media fallback failed 3 assertions before wiring UI;
compact marker test failed before bounding marker height. Fresh full suite:
177/177 in 12 files; typecheck and content:check pass. Native Workers tests inspect
all 27 enabled routes plus UI commands using a fake external HTTP boundary.
Dry-run bundles the final Worker without uploading: 62.20 KiB / gzip 10.43 KiB.

Fresh independent reviewer accepted media fallback, rendered-action reachability,
LINE box properties and unchanged corpus; no important findings remain.
Local browser preview is approximate, not proof of LINE server validation or phone
layout. Long Thai button labels and real Google Form access must still be tried
on LINE mobile after deployment. No push/deploy or public release in this task.
Next development ticket: 7 (Rich Menu). Live Ticket 6 phone verification belongs
to the ongoing pilot/release gate in Ticket 8.

Ticket 7: files implemented and locally verified (2026-10-11); live installation
and phone verification are pending the owner's manual step. Generated the real
mint/white six-topic artwork with built-in imagegen using the approved visual
and male-nurse references. Final PNG is 2500x1686, 975654 bytes. Actual banner
ends at y450, rows split at1065, columns at833/1667. These coordinates supersede
the requested 350px banner after visual inspection, and are pinned in tests.
Added postback config and manual-only environment-token installer; no new
Worker code, medical content, secrets, storage or paid resource.

Installer lists hash-versioned menus, creates if needed, uploads or verifies
the immutable PNG, sets default only after image success, and reads back default.
Retrying manually reuses the same version or resumes a missing image; no automatic
retries, per-user linking, deletion, or per-webhook menu creation. Redirects
are not followed, requests have 15-second timeouts, errors omit API bodies/keys.
The first/knowledge accessibility labels are meaningful short labels <=20 chars;
full titles stay on the artwork. Report remains a warning-first postback.

Evidence: missing config/installer RED observed before implementation; fresh
suite 206/206 across14 files, typecheck/content:check/rich-menu:check/diff whitespace
check pass. Six actual postbacks exercised through signed webhook; external
LINE API is mocked for install/reuse/resume/HTTP failures and read-back verification.
No credentials were present in .env/.dev.vars. No live LINE API request, install,
commit, push or deploy was performed in this task. Owner chose manual instructions,
so no additional setup wizard was authored. See rich-menu.md for hidden-token
entry in a temporary subshell and mobile checks. A successful local preflight
does not mean the menu is installed; Ticket8/live pilot gates remain open.
Fresh read-only reviewer found no Critical/Important/Minor findings, verified
PNG decode/coordinates and official immutable upload/reuse behavior. Declined
live channel/token/install/phone checks and unchanged clinical/form questions;
accepted as explicit owner/pilot gates, not evidence of live readiness.

2026-10-16: Owner approved visual-only polish of existing Flex replies in the
same folder/branch: white/deep-green/mint, consistent cards/buttons, comfortable
wrapped-line spacing, and a distinct report-warning panel. Clinical/UI wording,
actions, order, route logic and URLs must not change. Contact alignment is
explicitly deferred pending the client. Existing Rich Menu artwork/config and
the owner's manual OA Manager D/F links are untouched.

Added 4 real-renderer visual contract tests; all 4 failed before the production
change (missing report panel, dark header, line spacing, home-link hierarchy).
After the minimal style change, 52 scoped tests passed. Full fresh suite:
210/210 across 15 files; typecheck, content:check and diff whitespace check pass.
The report uses the same warning panel as partial notices; body/action text is
unchanged, no source snapshots were updated. Flattened visible text, action
payloads, Quick Replies and their order over all 29 routes, UI commands,
choices and fallbacks have identical before/after SHA256:
02fc1e976e48fe79be3033d96132ecef33a10fb065b6df0a36cff979f5d07eaa.
Clinical corpus, UI, aliases, metadata and both menu images/config also retain
their pre-edit hashes. See line-response-style.md for the visual-only scope.
No commit/push/deploy, secret change, live LINE message or menu installation.
Phone rendering, dark-mode behavior and larger system fonts remain manual
acceptance gates; local payload/contrast checks do not prove actual LINE layout.
