import { createServer } from "node:http";
import { recordBuildFailure } from "./agent_failure_service.ts";

const server = createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/build-failures") { res.writeHead(404).end(); return; }
  try {
    const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const result = await recordBuildFailure(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(result));
  } catch (error) { res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ error: error instanceof Error ? error.message : "invalid request" })); }
});
server.listen(Number(process.env.PORT ?? 3000), () => console.log("build failure service listening"));
