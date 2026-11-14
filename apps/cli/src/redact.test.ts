import { describe, expect, it } from "vitest";
import { parseEnvValues, Redactor } from "./redact.js";

const KEY = "sk-ant-demo-AbCdEfGhIjKlMnOpQrStUvWx";

describe("Redactor", () => {
  it("replaces a planted key everywhere and counts it once", () => {
    const r = new Redactor();
    const events = [
      { text: `cat .env\nANTHROPIC_API_KEY=${KEY}` },
      { tool: { input: { command: `export K=${KEY}` } } },
      { output: { excerpt: `using ${KEY}` } },
    ];
    const out = JSON.stringify(r.redact(events));
    expect(out).not.toContain(KEY);
    expect(out.match(/\[REDACTED:anthropic\]/g)).toHaveLength(3);
    expect(r.report()).toEqual({ distinct: 1, byKind: { anthropic: 1 } });
  });

  it("recognizes each known format", () => {
    const r = new Redactor();
    const cases: [string, string][] = [
      ["openai", "sk-proj-abcdefghijklmnopqrstuvwx1234"],
      ["aws", "AKIAABCDEFGHIJKLMNOP"],
      ["github", "ghp_" + "a".repeat(36)],
      ["github", "github_pat_" + "b".repeat(60)],
      ["jwt", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.c2lnbmF0dXJlLXZhbHVl"],
      ["private_key", "-----BEGIN RSA PRIVATE KEY-----\nMIIabc\n-----END RSA PRIVATE KEY-----"],
    ];
    for (const [kind, secret] of cases) {
      expect(r.redactString(`x ${secret} y`)).toBe(`x [REDACTED:${kind}] y`);
    }
    expect(r.report().distinct).toBe(cases.length);
  });

  it("keeps the shape of a MongoDB URI but removes the credentials", () => {
    const r = new Redactor();
    expect(r.redactString("mongodb+srv://app:s3cretPass@cluster0.abc.mongodb.net/")).toBe(
      "mongodb+srv://[REDACTED:mongodb]@cluster0.abc.mongodb.net/",
    );
  });

  it("removes .env values and leaves ordinary text alone", () => {
    const r = new Redactor(["correct-horse-battery", "short"]);
    expect(r.redactString("pw is correct-horse-battery, port short")).toBe("pw is [REDACTED:env], port short");
    expect(r.redactString("task-management-dashboard-version-two")).toBe("task-management-dashboard-version-two");
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
