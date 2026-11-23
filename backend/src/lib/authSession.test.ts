import { describe, expect, it } from "vitest";
import { generateFamilyId, generateRefreshToken, hashRefreshToken } from "./authSession.js";

describe("authSession helpers", () => {
  it("hashes refresh tokens (never reversible)", () => {
    const raw = generateRefreshToken();
    const a = hashRefreshToken(raw);
    const b = hashRefreshToken(raw);
    expect(a).toBe(b);
    expect(a).not.toBe(raw);
    expect(a).toHaveLength(64);
  });

  it("generates unique opaque tokens", () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(40);
  });

  it("generates family ids", () => {
    expect(generateFamilyId()).toHaveLength(32);
  });
});
