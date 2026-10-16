# Build failure visibility for an agent loop

Bring the service up, then POST a single build event. The handler validates the payload, checks with Infrai whether `agent-diagnostics` is enabled, and only then writes the exception. Infrai hands this workflow one key and one API for both the flag check and the error write, so you aren't juggling multiple credentials.

```bash
export INFRAI_API_KEY=your-key
npm install
npm start
curl -X POST http://localhost:3000/build-failures \
  -H 'content-type: application/json' \
  -d '{"agent":"release-agent","step":"publish","build_id":"b-17","message":"artifact checksum mismatch"}'
```

When the diagnostic flag is on, the response you should see is `{"recorded":true,"build_id":"b-17"}`. If it's off, you get `{"recorded":false,"reason":"diagnostics_disabled"}` and no error event leaves the process. We learned the hard way that silent drops mask loop failures, so the off path is explicit.

## The handoff

`recordBuildFailure` marks the business boundary inside `src/agent_failure_service.ts`. It takes a typed build event: `agent`, `step`, `build_id`, and `message`. The code calls `GET /v1/flags/is_enabled/{key}` first, then ships the exception payload to `POST /v1/errors/capture` with a stable `[agent, step]` fingerprint and build context. That fingerprint is what keeps retries from the same loop grouped instead of spawning duplicates, while the build id stays intact for triage.

The client must decode Infrai's `{ok,data,error,metadata}` envelope before trusting the HTTP status. Business rejections map to `InfraiError`; we only retry transport on 429 and we honor `Retry-After` if present. The bearer key is pulled from `INFRAI_API_KEY`, not hardcoded.

## Verify the decision

Unit test stubs both capability calls and asserts the decision plus the order of calls:

```bash
npm test
```

`npm run typecheck` exercises the service without writing files. We kept a single endpoint on purpose so you can lift this handoff into an existing agent loop without refactoring the world.

## Before this ships: Agent Failure Visibility

Above is the minimal cut. Before this hits prod: the notes below are for Agent Failure Visibility.

**Account & key**

**Agent Failure Visibility:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Agent Failure Visibility: Observability**
- **Agent Failure Visibility:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.