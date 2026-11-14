// Reading an agent's native session into Universal Context Format Events.
// The Claude Code adapter (BUILD.md 11.1 and 11.2) lands in M3.
import type { Event } from "@stash/context-format";

export interface SessionCandidate {
  nativeSessionId: string;
  path: string;
  title: string;
  modifiedAt: Date;
}

export interface CapturedSession {
  nativeSessionId: string;
  title: string;
  cwd: string | null;
  gitBranch: string | null;
  /** Events without sessionId and projectId, which the server assigns. */
  events: Omit<Event, "sessionId" | "projectId">[];
}

export interface AgentAdapter {
  agent: "claude-code";
  /** Sessions recorded for this working directory, newest first. */
  listSessions(cwd: string): Promise<SessionCandidate[]>;
  capture(path: string): Promise<CapturedSession>;
}
