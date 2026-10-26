import { describe, expect, it } from "vitest";
import { dateStringSchema, normalizeTime, timeStringSchema } from "./datetime.js";

describe("dateStringSchema", () => {
  it("accepts valid calendar dates", () => {
    expect(dateStringSchema.parse("2026-10-26")).toBe("2026-10-26");
  });

  it("rejects impossible dates", () => {
    expect(() => dateStringSchema.parse("2026-02-31")).toThrow();
    expect(() => dateStringSchema.parse("10/26/2026")).toThrow();
  });
});

describe("timeStringSchema", () => {
  it("normalizes single-digit hours", () => {
    expect(timeStringSchema.parse("9:05")).toBe("09:05");
    expect(normalizeTime("14:00")).toBe("14:00");
  });

  it("rejects invalid times", () => {
    expect(() => timeStringSchema.parse("25:00")).toThrow();
    expect(() => timeStringSchema.parse("9am")).toThrow();
  });
});
