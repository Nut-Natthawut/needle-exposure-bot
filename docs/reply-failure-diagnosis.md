# Live reply failure investigation — 2026-10-10

Status: diagnostic instrumentation only; the real failure is NOT fixed yet.

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
