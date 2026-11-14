import { describe, expect, it } from "vitest";
import { briefingMarker, contentHash, estimateTokens, eventId, findBriefingMarkers, newId } from "./index.js";

describe("ids", () => {
  it("prefixes ids by kind", () => {
    expect(newId("session")).toMatch(/^ses_[a-z0-9]{8}$/);
    expect(newId("merge")).toMatch(/^m_[a-z0-9]{8}$/);
  });

  it("gives the same Event the same id every time", () => {
    expect(eventId("abc", "uuid-1", 0)).toBe(eventId("abc", "uuid-1", 0));
    expect(eventId("abc", "uuid-1", 0)).not.toBe(eventId("abc", "uuid-1", 1));
    expect(eventId("abc", "uuid-1", 0)).toHaveLength(24);
  });

  it("changes the content hash when Events change", () => {
    expect(contentHash(["a", "b"])).toBe(contentHash(["a", "b"]));
    expect(contentHash(["a", "b"])).not.toBe(contentHash(["a", "b", "c"]));
  });
});

describe("estimateTokens", () => {
  it("rounds chars / 4 up", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcde")).toBe(2);
  });
});

describe("briefing markers", () => {
  it("round-trips a marker and dedupes by pull id", () => {
    const line = briefingMarker("ses_8kq2v", 2, "p_91x7k2ma");
    const text = `${line}\nlater...\n${line}\n${briefingMarker("m_abc12345", 1, "p_zz")}`;
    expect(findBriefingMarkers(text)).toEqual([
      { sourceId: "ses_8kq2v", sourceType: "session", sourceVersion: 2, pullId: "p_91x7k2ma" },
      { sourceId: "m_abc12345", sourceType: "merge", sourceVersion: 1, pullId: "p_zz" },
    ]);
  });
});
