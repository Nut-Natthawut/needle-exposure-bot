# Live reply failure investigation — 2026-10-10

Status: redirect defect reproduced and fixed locally; awaiting live LINE
verification. Temporary diagnostics remain until that verification succeeds.

Evidence:

- User's LINE Webhook errors shows HTTP 502 on actual message delivery.
- Our webhook returns 502 when `reply()` reports failure. Path mismatches
  return 404 and invalid signatures return 401 instead.
- Verify succeeded, but empty verification events never call Reply API.
- Access-token secret name is confirmed. User replaced its value and still
  reports 502. Its validity has not been independently verified.
- No production credential is available to the agent; do not copy credentials
  from chat attachments into scripts or logs.

Following Matt Pocock diagnosing-bugs: the actual upstream failure is not yet
agent-reproducible. The user explicitly authorized temporary production
instrumentation to build a feedback loop before hypothesizing or fixing.

## Narrow probe

`REPLY_DIAGNOSTICS=enabled` allows a single tagged warning on reply failures:

```text
[DEBUG-reply-502] {"code":"http_error","status":400}
```

The example is synthetic, not the observed production result. Allowed codes
are http_error, network_error, invalid_request. Status is the upstream HTTP
status or null when unavailable. No bodies, exception messages, user/event
IDs, routes, reply tokens, authorization headers or credentials are emitted.
Successful replies and disabled diagnostics do not emit this warning.

Persistent observability remains disabled. Use Cloudflare real-time logs
while sending one new test message; these are not historical logs. Live tail
also contains platform request metadata: share ONLY the tagged console warning,
not complete event details or headers. Do not use clinical/patient data as input.

## Feedback loop

1. Confirm the Git-connected production deployment contains the diagnostic
   commit and completed successfully.
2. Open the Worker's real-time logs before sending the message (or use
   `npx wrangler tail` from an authenticated local project).
3. Send `การเจาะเลือด` once in the bot's 1:1 chat.
4. Capture only `[DEBUG-reply-502]` code/status. If no warning appears, check
   active deployment, flag and live-tail connection; absence is not proof of success.
5. Use the captured result to rank falsifiable hypotheses and test one change
   at a time. HTTP 400 alone does not identify a particular invalid field.
6. After proving a fix on the original chat scenario, remove the tagged probe,
   config flag and related temporary tests; preserve a regression test at the
   seam matching the proven defect. Do not mark the investigation complete early.

## Local verification

`npm test -- tests/webhook.test.ts` first failed five diagnostic assertions
against the existing code. After instrumentation, full suite passed 112/112,
typecheck and content:check passed; dry-run bundle 52.06 KiB. These tests
drive the real webhook/router/reply code with synthetic upstream failures.
They verify diagnostic privacy/behavior, NOT the actual production root cause.

Reference: https://developers.cloudflare.com/workers/observability/logs/real-time-logs/

## Confirmed runtime defect

The user's captured probe reported network_error/status null, webhook 502.
The catch block covers more than network I/O, so this result alone did not
prove an external outage. A minimal native workerd fetch invocation showed:

```text
TypeError: Invalid redirect value, must be one of "follow" or "manual"
```

The old `redirect:'error'` was accepted by Node-based test doubles, but rejected
by native Workers fetch before an outgoing request. Ranked predictions:

1. Unsupported redirect option: changing only to manual lets requests reach
   the fake upstream and distinguishes its 200/401/302 responses.
2. Unbound native fetch: failure would remain after changing redirect mode.
3. Response body cancellation: failure would occur after receiving a response.

The first prediction passed; no changes to fetch binding or cancellation were
needed. Added tests/reply-runtime.test.ts: actual reply implementation bundled
with esbuild and run in Miniflare/workerd, replacing only the external API.
Before the one-line fix, all three transport tests returned network_error;
afterwards all passed. The signed full webhook flow with `การเจาะเลือด` also
returns 200 and sends to the fixed Reply API endpoint. A 302 remains an error
and is never followed, so credentials are not forwarded to its Location.

Initial full-bundle Miniflare setup failed at startup; this was a harness
issue, not evidence about production. A default-export wrapper bundled with
esbuild allowed the full webhook check to run. No real credentials or LINE
requests were used. Dev tooling now pins esbuild 0.28.1, Miniflare
5.20261006.1-alpha and Wrangler 4.149.0; the previous tooling audit reported
sharp-related advisories, and the patched toolchain reports zero advisories.

Final local suite: 116 tests in 10 files. Typecheck, content validation and
dry-run bundle pass. Clinical JSON, path, signature check and KV unchanged.
Keep the probe only until a new production deployment and actual LINE chat
confirm the original symptom is gone; then remove the probe/config/tests.
