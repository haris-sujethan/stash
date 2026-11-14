// Secret scanning, run on the developer's machine before anything is uploaded or sent to an AI tool.
// BUILD.md 11.3. Every match becomes [REDACTED:<kind>]; the report counts distinct secret values.
// If scanning throws, the caller must upload nothing.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export interface SecretPattern {
  kind: string;
  re: RegExp;
  /** Which part of the match is the secret; defaults to the whole match. */
  group?: number;
}

export const PATTERNS: SecretPattern[] = [
  { kind: "private_key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { kind: "anthropic", re: /(?<![A-Za-z0-9])sk-ant-[A-Za-z0-9_-]{20,}/g },
  { kind: "openai", re: /(?<![A-Za-z0-9])sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g },
  { kind: "aws", re: /AKIA[0-9A-Z]{16}/g },
  { kind: "aws", re: /aws_secret_access_key\s*[=:]\s*["']?([A-Za-z0-9/+=]{40})/gi, group: 1 },
  { kind: "github", re: /github_pat_[A-Za-z0-9_]{50,}/g },
  { kind: "github", re: /gh[pousr]_[A-Za-z0-9]{36,}/g },
  { kind: "mongodb", re: /mongodb(?:\+srv)?:\/\/([^\s"'@/]+:[^\s"'@/]+)@/g, group: 1 },
  { kind: "jwt", re: /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
];

export interface RedactionReport {
  /** Distinct secret values removed. */
  distinct: number;
  byKind: Record<string, number>;
}

export class Redactor {
  private readonly found = new Map<string, string>(); // secret value -> kind
  private readonly envValues: string[];

  /** @param envValues values from the repo's .env files, matched literally */
  constructor(envValues: readonly string[] = []) {
    // Longest first, so a value containing another is replaced whole.
    this.envValues = [...new Set(envValues.filter((v) => v.length >= 8))].sort((a, b) => b.length - a.length);
  }

  redactString(input: string): string {
    let s = input;
    for (const { kind, re, group } of PATTERNS) {
      s = s.replace(re, (match: string, ...rest: unknown[]) => {
        const secret = group ? String(rest[group - 1] ?? match) : match;
        if (secret.startsWith("[REDACTED:")) return match;
        this.found.set(secret, this.found.get(secret) ?? kind);
        return group ? match.replace(secret, `[REDACTED:${kind}]`) : `[REDACTED:${kind}]`;
      });
    }
    for (const value of this.envValues) {
      if (!s.includes(value)) continue;
      this.found.set(value, this.found.get(value) ?? "env");
      s = s.split(value).join("[REDACTED:env]");
    }
    return s;
  }

  /** Redacts every string inside any JSON-like value. */
  redact<T>(value: T): T {
    if (typeof value === "string") return this.redactString(value) as T;
    if (Array.isArray(value)) return value.map((v) => this.redact(v)) as T;
    if (value && typeof value === "object" && !(value instanceof Date)) {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, this.redact(v)])) as T;
    }
    return value;
  }

  report(): RedactionReport {
    const byKind: Record<string, number> = {};
    for (const kind of this.found.values()) byKind[kind] = (byKind[kind] ?? 0) + 1;
    return { distinct: this.found.size, byKind };
  }
}

/** Parses KEY=VALUE lines, ignoring comments and surrounding quotes. */
export function parseEnvValues(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=\s*(.*)$/);
    if (!m?.[1]) continue;
    let v = m[1].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, "");
    if (v.length >= 8) out.push(v);
  }
  return out;
}

/** Values from .env and .env.* at the repo root (never .env.example, which holds no secrets). */
export async function loadEnvValues(repoRoot: string): Promise<string[]> {
  let names: string[];
  try {
    names = await readdir(repoRoot);
  } catch {
    return [];
  }
  const files = names.filter((n) => (n === ".env" || n.startsWith(".env.")) && n !== ".env.example");
  const values: string[] = [];
  for (const f of files) values.push(...parseEnvValues(await readFile(join(repoRoot, f), "utf8")));
  return values;
}
