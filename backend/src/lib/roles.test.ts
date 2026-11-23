import { describe, expect, it } from "vitest";
import { isAdminCreatableRole, isRole, PUBLIC_SIGNUP_ROLE } from "./roles.js";

describe("roles", () => {
  it("public signup is patient only", () => {
    expect(PUBLIC_SIGNUP_ROLE).toBe("patient");
  });

  it("admin can create facility staff roles but not admin/patient/platform", () => {
    expect(isAdminCreatableRole("doctor")).toBe(true);
    expect(isAdminCreatableRole("nurse")).toBe(true);
    expect(isAdminCreatableRole("receptionist")).toBe(true);
    expect(isAdminCreatableRole("pharmacist")).toBe(true);
    expect(isAdminCreatableRole("admin")).toBe(false);
    expect(isAdminCreatableRole("patient")).toBe(false);
    expect(isAdminCreatableRole("super_admin")).toBe(false);
  });

  it("validates known roles", () => {
    expect(isRole("admin")).toBe(true);
    expect(isRole("lab_technician")).toBe(true);
    expect(isRole("hacker")).toBe(false);
  });
});
