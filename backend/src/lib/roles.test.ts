import { describe, expect, it } from "vitest";
import { isAdminCreatableRole, isRole, PUBLIC_SIGNUP_ROLE } from "./roles.js";

describe("roles", () => {
  it("public signup is patient only", () => {
    expect(PUBLIC_SIGNUP_ROLE).toBe("patient");
  });

  it("admin can create doctor/nurse only", () => {
    expect(isAdminCreatableRole("doctor")).toBe(true);
    expect(isAdminCreatableRole("nurse")).toBe(true);
    expect(isAdminCreatableRole("admin")).toBe(false);
    expect(isAdminCreatableRole("patient")).toBe(false);
  });

  it("validates known roles", () => {
    expect(isRole("admin")).toBe(true);
    expect(isRole("hacker")).toBe(false);
  });
});
