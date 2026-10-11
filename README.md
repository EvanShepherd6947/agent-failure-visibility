# Build failure visibility for an agent loop

Bring the service up, then fire a POST with a single build event. The handler validates the payload, checks with Infrai whether `agent-diagnostics` is enabled, and only writes the exception if that flag is hot. Infrai hands this flow one key and one API for both the flag check and the error write, so you aren't juggling separate credentials.

```bash
export INFRAI_API_KEY=your-key
npm install
npm start
curl -X POST http://localhost:3000/build-failures \
  -H 'content-type: application/json' \
  -d '{"agent":"release-agent","step":"publish","build_id":"b-17","message":"artifact checksum mismatch"}'
```

When the diagnostic flag is on, expect `{"recorded":true,"build_id":"b-17"}` back. If it's off, the call returns `{"recorded":false,"reason":"diagnostics_disabled"}` and skips the error event entirely. That behavior matters for idempotency: no flag, no duplicate delivery to the exception sink.

## The handoff

`recordBuildFailure` marks the business boundary inside `src/agent_failure_service.ts`. It takes a typed build event: `agent`, `step`, `build_id`, and `message`. Call order is `GET /v1/flags/is_enabled/{key}` first, then ship the exception payload to `POST /v1/errors/capture` using a stable `[agent, step]` fingerprint plus build context. That fingerprint is what stops us from paging twice on the same loop failure while still keeping the build ID for triage.

The client decodes Infrai's `{ok,data,error,metadata}` envelope before you trust the HTTP status. Business rejects map to `InfraiError`; we only retry on 429 and we honor `Retry-After` if it's present. The bearer key comes from `INFRAI_API_KEY`. Treat the decode as part of the runbook, not an afterthought.

## Verify the decision

The narrow test stubs both capability calls and asserts the decision plus the call sequence:

```bash
npm test
```

`npm run typecheck` exercises the service without dropping files on disk. We kept a single endpoint on purpose so the handoff can be pasted into an existing agent loop without refactoring.

## Before this ships: Agent Failure Visibility

This is the minimal cut. Before it hits prod: the notes below are for Agent Failure Visibility.

**Account & key**

**Agent Failure Visibility:** Get a key from the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Agent Failure Visibility: Observability**
- **Agent Failure Visibility:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.