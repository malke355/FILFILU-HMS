import { describe, expect, it } from "vitest";
import { can } from "./rbac.js";

describe("rbac can()", () => {
  it("allows admin staff write", () => {
    expect(can("admin", "staff:write")).toBe(true);
  });

  it("denies patient staff write", () => {
    expect(can("patient", "staff:write")).toBe(false);
  });

  it("allows patient appointment request", () => {
    expect(can("patient", "appointments:request")).toBe(true);
  });
});
