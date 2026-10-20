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

2026-10-16: Owner approved friendly conversation behavior in the existing
folder/branch. Replaced welcome with the exact two-line greeting chosen by
the owner; added explicit greeting/thanks aliases, a friendly unknown-text
menu prompt and four explicit topic variants. Humanizer was used only to
edit non-clinical UI copy during development, not as a runtime dependency.

Added domain/topic-suggestions.ts: after exact routing fails, compare against
an allowlist of Thai top-level topic terms from ui.json. Only a unique topic
within one insertion/deletion/substitution is offered, with confirmation and
other-topic Quick Replies. No answer or context is created before confirmation.
Inputs over 64 characters, under 5 characters, numbers, Latin codes and
punctuation are excluded. No clinical branch/result/time/drug/dose matching,
substring routing, LLM, external medical lookup, new dependency or paid service.
Report confirmation retains the existing warning-first flow. Manual OA Manager
D/F links, deferred contact alignment, clinical route contents/enabled flags
and metadata are unchanged.

Greeting/thanks, unmatched text and suggestions preserve the current context
without a context write or TTL renewal. Explicit home/reset, unavailable or
missing context, and ambiguous clinical choices retain their clearing behavior.
Successful route replies still replace the topic; reply failure and event
deduplication ordering are unchanged. No raw questions or pending suggestion
state are stored in KV. README structure/flow and the original spec now explain
the owner-approved confirmation-only exception to the original no-fuzzy policy.

Evidence: 44 failing conversation assertions observed before implementation
(unknown greeting, missing aliases/suggestions, discarded context); all 45 then
passed. Added 21 suggestion boundary/configuration tests; 66 focused tests pass.
Native workerd tests now exercise the new greeting, thanks and suggestion
payload, including the confirmation actions. Initial sandbox full run failed
5 native-runtime tests solely because localhost listen was denied (EPERM).
Rerunning with localhost permission passed; final fresh full suite: 276/276
across 17 files. Typecheck, content:check, rich-menu:check and diff whitespace
checks pass. SHA256 of routes.json, metadata.json, config/rich-menu.json and
both Rich Menu PNGs matches the pre-edit baseline; no source snapshots changed.
Independent read-only review found no actionable issues and independently
passed 136 focused tests, typecheck and content validation.

No commit, push, deploy, secret change, live LINE API call or menu installation
was performed. Phone/real OA rendering and medical approval of the unchanged
source corpus remain outside automated verification.

2026-10-16 follow-up: Owner requested broader phrasing coverage after seeing
the exact gaps (greetings with !, polite endings, lowercase pep, full service-time
labels and English result wording). Added shared domain/text-input.ts for
whitespace, ASCII case, one allowlisted Thai polite suffix and selected terminal
punctuation only. Both clinical/UI alias matching and topic suggestions use it;
postbacks remain exact. Negation, numbers, +/- signs, non-formatting/internal
punctuation and unregistered medical words are not discarded or inferred.

Added explicit top-level topic/question variants, oPEP definition/topic forms,
report/menu/reset/contact phrases and contextual English result/full time labels.
All responses still use existing enabled routes or UI actions. Generic needle
phrases can start first_aid.root; the contextual เข็มตำ branch still takes
precedence as first_aid.sharp_skin within that topic. No new clinical statement,
route, status, external source, URL, dependency, credential or infrastructure.
Ambiguous treatment/time choices still require user selection; this is not
unrestricted natural-language understanding. README structure/flow, spec and
content-review now describe the approved normalization and explicit-alias scope.

Evidence: 62 new coverage/conversation failures before implementation, then
4 short needle-phrase failures before registering those aliases. Final focused
suite 184 tests passes. The alias matrix checks 63 global/context entries over
8 suffixes and 6 punctuation styles (3,024 combinations) against declared
destinations, alongside literal expected examples, wrong/missing context,
mixed/negative results, identifiers, codes, numbers, signs, postback strictness
and normalized collisions. Native workerd coverage includes formatted greeting,
polite topic request, lowercase pep and polite typo-confirmation payloads.

Fresh full suite: 368/368 across 18 files; typecheck, content:check,
rich-menu:check and whitespace checks pass. Independent read-only review found
no actionable issues (191 focused tests for the main wording change, then 111
coverage/router tests for the final aliases). Clinical corpus/metadata and menu
config/artwork retain baseline hashes. No commit, push, deploy or live LINE API
call was performed; owner still needs real-phone acceptance after deployment.

2026-10-20: Owner supplied the actual contact-channel content: infection
prevention/control 1178/9270, occupational medicine examination room 9274,
emergency room 1105/1106/9269, with the full Thai department names preserved.
The owner only tentatively identified these as internal numbers. Replace
contactPending with contactTitle/contactDetails in ui.json and render through
the existing Flex card/home button. No internal-number label, tel: action,
main phone, hours, added medical guidance or inferred case-to-unit routing.
Partial website corroboration does not establish all current phone numbers;
displayed data remains the owner's supplied source. See contact-details.md.

Reused the existing dark-green/white card, wrapped text and spacing per the
Impeccable scoped clarification guidance. Its mechanical detector returned no
findings; payload contrast/wrapping tests now include the contact card. These
checks are not a live LINE/mobile screenshot or confirmation that numbers work.
No product/design scaffold or unrelated restyling was introduced.

Evidence: 5 intended renderer/navigation failures before implementation, then
67 scoped tests passed. First full run had 371 passes and 1 stale rich-menu
assertion expecting contactPending (also caught by typecheck). Updated that
consumer to verify the exact new Flex contact text, not to weaken the contract.
Fresh full suite: 372/372 across 18 files; typecheck, content:check and whitespace
checks pass. Native workerd validates the complete contact payload. Independent
read-only reviewer passed 71 scoped tests/typecheck/content validation and found
no actionable issues. Clinical corpus, aliases, metadata, menu images/config
remain unchanged from HEAD; no source snapshots, secrets or URLs changed.

README/contact provenance/Rich Menu/content-review docs updated. Existing
manual OA Manager F may still open Premium Clinic: owner must change it to
text ติดต่อผู้เกี่ยวข้อง after deployment. No live menu install or OA change,
commit, push or deploy was performed. Phone validity and real-mobile acceptance
remain owner verification steps.

2026-10-20 tone follow-up: Owner requested a female bot voice. Changed only
outgoing UI copy from ครับ to ค่ะ for statements/instructions, คะ for questions,
and ผม to ฉัน in the same two-line welcome. Topic confirmation now ends
ใช่ไหมคะ?. Humanizer used only for the non-clinical wording pass. User-input
aliases/polite normalization still accept masculine and feminine forms; clinical
corpus, sources, contact names/numbers, action destinations and artwork unchanged.
No avatar/mascot replacement was requested or performed.

Evidence: updated conversation expectations and a real-renderer UI voice test
failed 38 assertions before the copy change, then 100 scoped tests passed.
Fresh full suite: 373/373 across 18 files; typecheck, content:check and whitespace
checks pass. Existing native workerd test asserts feminine suggestion copy.
Independent read-only reviewer passed 187 render/conversation/coverage/snapshot
tests and found no issues. Response-style docs reflect the new voice. Contact
work remains intact; no commit, push, deploy or live LINE mutation was performed.
