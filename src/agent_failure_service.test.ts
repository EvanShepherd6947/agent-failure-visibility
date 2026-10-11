import assert from "node:assert/strict";
import { recordBuildFailure } from "./agent_failure_service.ts";

const calls: string[] = [];
const client = { isDiagnosticsEnabled: async (key: string) => { calls.push(`flag:${key}`); return true; }, capture: async (payload: Record<string, unknown>) => {
  assert.equal("build_id" in payload, false);
  calls.push(`capture:${(payload.context as Record<string, unknown>).build_id ?? ""}`);
} };
const result = await recordBuildFailure({ agent: "release-agent", step: "publish", build_id: "b-17", message: "artifact checksum mismatch" }, client as never);
assert.deepEqual(result, { recorded: true, build_id: "b-17" });
assert.deepEqual(calls, ["flag:agent-diagnostics", "capture:b-17"]);
console.log("build failure decision test passed");
