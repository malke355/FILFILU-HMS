import { afterEach, describe, expect, it } from "vitest";
import { assertEnvConfigured, parseCorsOrigins } from "./env.js";

const keys = [
  "NODE_ENV",
  "JWT_SECRET",
  "DATABASE_URL",
  "CORS_ORIGIN",
  "FRONTEND_ORIGIN",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
] as const;

const saved: Record<string, string | undefined> = {};

function stash() {
  for (const k of keys) saved[k] = process.env[k];
}

function restore() {
  for (const k of keys) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
}

afterEach(() => {
  restore();
});

describe("assertEnvConfigured", () => {
  it("accepts a valid development config", () => {
    stash();
    process.env.NODE_ENV = "development";
    process.env.JWT_SECRET = "a".repeat(32) + "-unique-dev-secret";
    process.env.DATABASE_URL = "postgresql://filfilu:x@127.0.0.1:5434/hms";
    process.env.CORS_ORIGIN = "http://127.0.0.1:8080";
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URI;
    expect(() => assertEnvConfigured()).not.toThrow();
    expect(parseCorsOrigins()).toContain("http://127.0.0.1:8080");
  });

  it("rejects weak JWT in any env", () => {
    stash();
    process.env.NODE_ENV = "development";
    process.env.JWT_SECRET = "secret";
    process.env.DATABASE_URL = "postgresql://filfilu:x@127.0.0.1:5434/hms";
    expect(() => assertEnvConfigured()).toThrow(/JWT_SECRET/);
  });

  it("requires https CORS in production", () => {
    stash();
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "a".repeat(40);
    process.env.DATABASE_URL = "postgresql://filfilu:x@127.0.0.1:5434/hms";
    process.env.CORS_ORIGIN = "http://127.0.0.1:8080";
    process.env.FRONTEND_ORIGIN = "https://clinic.example";
    expect(() => assertEnvConfigured()).toThrow(/CORS_ORIGIN/);
  });
});
