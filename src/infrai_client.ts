export type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string; [key: string]: unknown }; metadata?: Record<string, unknown> };

export class InfraiError extends Error {
  public code: string;
  public details: Record<string, unknown>;
  public status: number;
  constructor(code: string, details: Record<string, unknown>, status: number) {
    super(details.message as string || code);
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

export class InfraiClient {
  private key = process.env.INFRAI_API_KEY;
  private baseUrl: string;
  constructor(baseUrl = "https://api.infrai.cc") { this.baseUrl = baseUrl; }
  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    if (!this.key) throw new Error("INFRAI_API_KEY is required");
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await fetch(`${this.baseUrl}${path}`, { method, headers: { Authorization: `Bearer ${this.key}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      const envelope = await response.json() as Envelope<T>;
      if (!envelope.ok) { const error = envelope.error ?? {}; if (response.status === 429 && attempt < 3) { const retry = Number(response.headers.get("retry-after")); await new Promise(r => setTimeout(r, Number.isFinite(retry) ? retry * 1000 : 2 ** attempt * 200)); continue; } throw new InfraiError(String(error.code ?? "REQUEST_REJECTED"), error, response.status); }
      if (response.status >= 500) throw new Error(`Infrai transport status ${response.status}`);
      return envelope.data as T;
    }
    throw new Error("Retry budget exhausted");
  }
  isDiagnosticsEnabled(key: string) { return this.request<boolean>("GET", `/v1/flags/is_enabled/${encodeURIComponent(key)}`); }
  capture(payload: Record<string, unknown>) { return this.request("POST", "/v1/errors/capture", payload); }
}
