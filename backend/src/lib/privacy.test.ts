import { describe, expect, it } from "vitest";
import { redactEmail, sanitizeAuditMeta } from "./privacy.js";

describe("redactEmail", () => {
  it("masks local part", () => {
    expect(redactEmail("admin@filfilu.com")).toBe("a***@filfilu.com");
  });
});

describe("sanitizeAuditMeta", () => {
  it("redacts message, reason, email, and tokens", () => {
    const safe = sanitizeAuditMeta({
      email: "patient@example.com",
      topic: "billing",
      message: "I have chest pain and my phone is 0911",
      reason: "urgent chest pain",
      token: "super-secret",
      status: "requested",
    });
    expect(safe?.topic).toBe("billing");
    expect(safe?.status).toBe("requested");
    expect(String(safe?.email)).toContain("***@");
    expect(String(safe?.message)).toMatch(/redacted/i);
    expect(String(safe?.reason)).toMatch(/redacted/i);
    expect(String(safe?.token)).toMatch(/redacted/i);
  });
});
