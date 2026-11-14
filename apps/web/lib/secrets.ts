// Hashing for the two secrets the server checks: Stash tokens (sha256, looked up by hash)
// and the approver secret (scrypt, checked on every approver request; ADR 0004).
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function newStashToken(): string {
  let out = "";
  // Rejection sampling keeps every character equally likely.
  while (out.length < 32) {
    for (const b of randomBytes(48)) {
      if (b < 248 && out.length < 32) out += BASE62[b % 62];
    }
  }
  return `stash_${out}`;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hashApproverSecret(secret: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(secret, salt, 32);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyApproverSecret(secret: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(secret, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}
