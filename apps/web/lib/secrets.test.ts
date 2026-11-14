import { describe, expect, it } from "vitest";
import { hashApproverSecret, hashToken, newStashToken, verifyApproverSecret } from "./secrets";

describe("secrets", () => {
  it("makes distinct, well-formed Stash tokens", () => {
    const a = newStashToken();
    expect(a).toMatch(/^stash_[0-9A-Za-z]{32}$/);
    expect(newStashToken()).not.toBe(a);
  });

  it("hashes tokens deterministically", () => {
    expect(hashToken("stash_x")).toBe(hashToken("stash_x"));
    expect(hashToken("stash_x")).not.toBe(hashToken("stash_y"));
  });

  it("verifies only the right approver secret", () => {
    const stored = hashApproverSecret("correct horse");
    expect(stored).not.toContain("correct horse");
    expect(verifyApproverSecret("correct horse", stored)).toBe(true);
    expect(verifyApproverSecret("wrong", stored)).toBe(false);
    expect(verifyApproverSecret("correct horse", "garbage")).toBe(false);
  });
});
