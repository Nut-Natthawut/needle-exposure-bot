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
