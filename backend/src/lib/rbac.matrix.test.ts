import { describe, expect, it } from "vitest";
import { can, canAccessClinicalNotes } from "./rbac.js";

describe("RBAC least privilege (Section 3)", () => {
  it("receptionist cannot access clinical notes", () => {
    expect(canAccessClinicalNotes("receptionist")).toBe(false);
    expect(can("receptionist", "clinical.read")).toBe(false);
    expect(can("receptionist", "patients.create")).toBe(true);
    expect(can("receptionist", "appointments.manage")).toBe(true);
  });

  it("pharmacist cannot manage billing or clinical notes", () => {
    expect(can("pharmacist", "billing.manage")).toBe(false);
    expect(canAccessClinicalNotes("pharmacist")).toBe(false);
    expect(can("pharmacist", "pharmacy.dispense")).toBe(true);
  });

  it("cashier can bill but not clinical write", () => {
    expect(can("cashier", "billing.manage")).toBe(true);
    expect(canAccessClinicalNotes("cashier")).toBe(false);
  });

  it("doctor can write clinical notes; nurse read + vitals", () => {
    expect(can("doctor", "clinical.write")).toBe(true);
    expect(can("nurse", "clinical.read")).toBe(true);
    expect(can("nurse", "clinical.write")).toBe(false);
    expect(can("nurse", "clinical.vitals_ward")).toBe(true);
  });

  it("facility admin cannot imply platform privileges via RBAC catalog", () => {
    expect(can("admin", "roles.manage")).toBe(true);
    // Platform elevation is blocked in routes, not by granting a permission code.
    expect(can("admin", "platform.super")).toBe(false);
  });

  it("legacy colon permissions still resolve for admin", () => {
    expect(can("admin", "staff:write")).toBe(true);
    expect(can("admin", "roles:assign")).toBe(true);
  });
});
