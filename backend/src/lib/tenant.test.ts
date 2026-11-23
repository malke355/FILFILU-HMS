import { describe, expect, it } from "vitest";
import { DEFAULT_FACILITY_ID, DEFAULT_FACILITY_SLUG, stripClientFacilityId } from "./tenant.js";

describe("tenant helpers", () => {
  it("exports stable default facility constants used by migration backfill", () => {
    expect(DEFAULT_FACILITY_ID).toBe("fac_filfilu_default");
    expect(DEFAULT_FACILITY_SLUG).toBe("filfilu-default");
  });

  it("strips client-supplied facilityId from payloads", () => {
    const cleaned = stripClientFacilityId({
      facilityId: "fac_evil",
      name: "Ok",
      doctorId: "s-1",
    });
    expect(cleaned).toEqual({ name: "Ok", doctorId: "s-1" });
    expect("facilityId" in cleaned).toBe(false);
  });
});
