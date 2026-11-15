import { describe, expect, it } from "vitest";
import { parseEnvValues, Redactor } from "./redact.js";

// Every "secret" below is fake and assembled at runtime, so the source never contains a string that looks like a
// real credential to a secret scanner.
const fake = (...parts: string[]) => parts.join("");
const ANTHROPIC = fake("sk-", "ant-", "test-", "AbCdEfGhIjKlMnOpQrStUvWx");

describe("Redactor", () => {
  it("replaces a planted key everywhere and counts it once", () => {
    const r = new Redactor();
    const events = [
      { text: `cat .env\nANTHROPIC_API_KEY=${ANTHROPIC}` },
      { tool: { input: { command: `export K=${ANTHROPIC}` } } },
      { output: { excerpt: `using ${ANTHROPIC}` } },
    ];
    const out = JSON.stringify(r.redact(events));
    expect(out).not.toContain(ANTHROPIC);
    expect(out.match(/\[REDACTED:anthropic\]/g)).toHaveLength(3);
    expect(r.report()).toEqual({ distinct: 1, byKind: { anthropic: 1 } });
  });

  it("recognizes each known format", () => {
    const r = new Redactor();
    const cases: [string, string][] = [
      ["openai", fake("sk-", "proj-", "x".repeat(28))],
      ["aws", fake("AKIA", "TESTONLY", "00000000")],
      ["github", fake("gh", "p_", "a".repeat(36))],
      ["github", fake("github", "_pat_", "b".repeat(60))],
      ["jwt", fake("eyJ", "aGVhZGVy", ".", "eyJ", "cGF5bG9hZA", ".", "c2lnbmF0dXJl")],
      ["private_key", fake("-----BEGIN ", "RSA PRIVATE KEY-----\nTEST\n-----END ", "RSA PRIVATE KEY-----")],
      ["stash", fake("stash", "_", "T".repeat(32))],
      ["slack", fake("xox", "b-", "0".repeat(12))],
      ["google", fake("AI", "za", "t".repeat(35))],
      ["stripe", fake("sk", "_live_", "z".repeat(24))],
    ];
    for (const [kind, secret] of cases) {
      expect(r.redactString(`x ${secret} y`)).toBe(`x [REDACTED:${kind}] y`);
    }
    expect(r.report().distinct).toBe(cases.length);
  });

  it("removes the credential after Bearer but keeps the word", () => {
    const token = fake("test", "-token-", "q".repeat(24));
    expect(new Redactor().redactString(`Authorization: Bearer ${token}`)).toBe("Authorization: Bearer [REDACTED:bearer]");
  });

  it("keeps the shape of a database URI but removes the credentials", () => {
    const uri = fake("mongodb+srv://", "demo-user", ":", "not-a-real-password", "@db.example.test/");
    expect(new Redactor().redactString(uri)).toBe("mongodb+srv://[REDACTED:mongodb]@db.example.test/");
  });

  it("removes .env values and leaves ordinary text alone", () => {
    const r = new Redactor(["correct-horse-battery", "short"]);
    expect(r.redactString("pw is correct-horse-battery, port short")).toBe("pw is [REDACTED:env], port short");
    expect(r.redactString("task-management-dashboard-version-two")).toBe("task-management-dashboard-version-two");
    expect(r.redactString("the stash_command and bearer of news")).toBe("the stash_command and bearer of news");
    expect(r.report()).toEqual({ distinct: 1, byKind: { env: 1 } });
  });

  it("does not touch dates and numbers", () => {
    const d = new Date(0);
    expect(new Redactor().redact({ ts: d, n: 4 })).toEqual({ ts: d, n: 4 });
  });
});

describe("parseEnvValues", () => {
  it("reads values, strips quotes and comments, skips short ones", () => {
    const env = `# comment\nA="quoted value here"\nexport B='single-quoted'\nC=plain-value-123 # trailing\nPORT=4000\nEMPTY=`;
    expect(parseEnvValues(env)).toEqual(["quoted value here", "single-quoted", "plain-value-123"]);
  });
});
