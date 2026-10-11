import { z } from "zod";
import { InfraiClient } from "./infrai_client.ts";

export const buildEvent = z.object({ agent: z.string().min(1), step: z.string().min(1), build_id: z.string().min(1), message: z.string().min(1) });
export type BuildEvent = z.infer<typeof buildEvent>;

export async function recordBuildFailure(input: BuildEvent, client = new InfraiClient()) {
  const event = buildEvent.parse(input);
  const enabled = await client.isDiagnosticsEnabled("agent-diagnostics");
  if (!enabled) return { recorded: false, reason: "diagnostics_disabled" as const };
  await client.capture({ title: `${event.agent}/${event.step} build failed`, message: event.message, level: "error", fingerprint: [event.agent, event.step], exception: event.message, context: { agent: event.agent, step: event.step, build_id: event.build_id } });
  return { recorded: true as const, build_id: event.build_id };
}
