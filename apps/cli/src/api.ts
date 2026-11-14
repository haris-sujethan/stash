// Typed client for the Stash web API, with retries for network errors and 5xx (1s, 3s, 9s).
import type {
  CreateVersionResponse, InitProjectResponse, ResolveSessionResponse, SessionSummary, StatusResponse, UploadEvent, UploadEventsResponse,
} from "@stash/context-format";
import { UserError, type UserConfig } from "./config.js";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const RETRY_DELAYS = [1000, 3000, 9000];

export class StashApi {
  constructor(private apiUrl: string, private token?: string, private retryDelays = RETRY_DELAYS) {}

  static from(c: Pick<UserConfig, "apiUrl" | "token">) {
    return new StashApi(c.apiUrl, c.token);
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.retryDelays.length; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, this.retryDelays[attempt - 1]));
      let res: Response;
      try {
        res = await fetch(new URL(path, this.apiUrl), {
          method,
          headers: { "content-type": "application/json", ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch (err) {
        lastErr = new ApiError(0, `Can't reach the Stash API at ${this.apiUrl}. Is the web app running (npm run dev)?`);
        void err;
        continue;
      }
      const text = await res.text();
      const data = text ? (JSON.parse(text) as { error?: string }) : {};
      if (res.ok) return data as T;
      const err = new ApiError(res.status, data.error ?? `HTTP ${res.status}`);
      if (res.status === 401) throw new UserError(err.message);
      if (res.status < 500) throw err;
      lastErr = err;
    }
    throw lastErr;
  }

  status = () => this.request<StatusResponse>("GET", "/api/status");
  initProject = (remote: string | null, name?: string) =>
    this.request<InitProjectResponse>("POST", "/api/projects/init", { remote, ...(name ? { name } : {}) });
  resolveSession = (body: { projectId: string; agent: "claude-code"; nativeSessionId: string; title: string; machine: string; gitBranch: string | null; gitCommit: string | null }) =>
    this.request<ResolveSessionResponse>("POST", "/api/sessions/resolve", body);
  uploadEvents = (sessionId: string, events: UploadEvent[]) =>
    this.request<UploadEventsResponse>("POST", `/api/sessions/${sessionId}/events`, { events });
  createVersion = (sessionId: string, body: { contentHash: string; eventCount: number; redactedCount: number }) =>
    this.request<CreateVersionResponse>("POST", `/api/sessions/${sessionId}/versions`, body);
  sessions = (projectId: string) => this.request<{ sessions: SessionSummary[] }>("GET", `/api/sessions?projectId=${encodeURIComponent(projectId)}`);
}

/** Splits Events into batches of at most `maxEvents` and roughly `maxBytes` of JSON. */
export function batches<T>(items: readonly T[], maxEvents: number, maxBytes: number): T[][] {
  const out: T[][] = [];
  let cur: T[] = [];
  let bytes = 2;
  for (const item of items) {
    const size = Buffer.byteLength(JSON.stringify(item)) + 1;
    if (cur.length > 0 && (cur.length >= maxEvents || bytes + size > maxBytes)) {
      out.push(cur);
      cur = [];
      bytes = 2;
    }
    cur.push(item);
    bytes += size;
  }
  if (cur.length) out.push(cur);
  return out;
}
