import { describe, expect, it } from "vitest";
import { formatPatientNumber } from "./patientNumber.js";

describe("patient number format", () => {
  it("formats FIL-001-000001 style numbers", () => {
    expect(formatPatientNumber({ prefix: "FIL", facilityCode: "001", padWidth: 6 }, 1)).toBe(
      "FIL-001-000001",
    );
    expect(formatPatientNumber({ prefix: "FIL", facilityCode: "002", padWidth: 6 }, 42)).toBe(
      "FIL-002-000042",
    );
  });
});
