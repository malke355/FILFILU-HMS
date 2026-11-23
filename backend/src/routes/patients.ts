import { Router } from "express";
import express from "express";
import fs from "node:fs";
import { z } from "zod";
import { writeAudit } from "../lib/audit.js";
import { can } from "../lib/rbac.js";
import { pageMeta, parsePage } from "../lib/pagination.js";
import { prisma } from "../lib/prisma.js";
import { requireFacilityId, assertSameFacilityStaff } from "../lib/tenant.js";
import { requireAuth, requirePermission, type AuthedRequest } from "../middleware/auth.js";
import {
  canManageDocuments,
  canManageEncounters,
  canManageMedicalHistory,
  canReadMedicalHistory,
  canViewPatientRow,
  patientListWhere,
  redactPatientForRole,
} from "../services/patients/patientAccess.js";
import { findPotentialDuplicates } from "../services/patients/duplicates.js";
import {
  absoluteStoragePath,
  deleteStoredFile,
  savePatientDocumentFile,
} from "../services/patients/documentStorage.js";
import { allocateEncounterNumber } from "../services/patients/patientNumber.js";
import {
  getPatientProfile,
  patientDashboardStats,
  registerPatient,
  searchPatients,
  updatePatientDemographics,
} from "../services/patients/patientService.js";

const router = Router();
router.use(requireAuth);

const sexSchema = z.enum(["male", "female", "other", "unknown"]).optional().nullable();

const registerSchema = z.object({
  firstName: z.string().min(1).max(80),
  middleName: z.string().max(80).optional().nullable(),
  lastName: z.string().min(1).max(80),
  dateOfBirth: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable(),
  age: z.number().int().min(0).max(150).optional().nullable(),
  sex: sexSchema,
  blood: z.string().max(8).optional().nullable(),
  nationality: z.string().max(80).optional().nullable(),
  maritalStatus: z.string().max(40).optional().nullable(),
  occupation: z.string().max(120).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  phoneAlt: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  region: z.string().max(80).optional().nullable(),
  zone: z.string().max(80).optional().nullable(),
  woreda: z.string().max(80).optional().nullable(),
  kebele: z.string().max(80).optional().nullable(),
  addressDetail: z.string().max(400).optional().nullable(),
  ward: z.string().max(80).optional().nullable(),
  bed: z.string().max(40).optional().nullable(),
  doctorId: z.string().max(80).optional().nullable(),
  registrationNotes: z.string().max(1000).optional().nullable(),
  identifier: z
    .object({
      system: z.string().min(1).max(40),
      value: z.string().min(1).max(120),
    })
    .optional()
    .nullable(),
  emergencyContact: z
    .object({
      name: z.string().min(1).max(120),
      relationship: z.string().max(80).optional().nullable(),
      phone: z.string().max(40).optional().nullable(),
      address: z.string().max(400).optional().nullable(),
    })
    .optional()
    .nullable(),
  acknowledgeDuplicates: z.boolean().optional(),
});

function parseDob(value: string | null | undefined): Date | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

router.get("/patients/meta", async (req: AuthedRequest, res, next) => {
  try {
    const facilityId = requireFacilityId(req);
    const settings = await prisma.facilitySettings.findUnique({ where: { facilityId } });
    let features: Record<string, unknown> = {};
    try {
      features = JSON.parse(settings?.featuresJson || "{}") as Record<string, unknown>;
    } catch {
      features = {};
    }
    res.json({
      data: {
        locationLabels: features.locationLabels || {
          level1: "Region",
          level2: "Zone",
          level3: "Woreda",
          level4: "Kebele",
        },
        idTypes: features.idTypes || ["national_id", "passport", "driver_license", "other"],
        patientNumber: features.patientNumber || { prefix: "FIL", facilityCode: "001", padWidth: 6 },
        sexValues: ["male", "female", "other", "unknown"],
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/patients/stats", requirePermission("patients.read", "patients:read_all", "patients.read_assigned", "patients.read_ward", "patients:read_assigned", "patients:read_ward"), async (req: AuthedRequest, res, next) => {
  try {
    const facilityId = requireFacilityId(req);
    const scope = patientListWhere(facilityId, req.user!);
    if (!scope) return res.status(403).json({ error: "Missing permission." });
    const data = await patientDashboardStats(facilityId, scope);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

router.post("/patients/duplicates", requirePermission("patients.create", "patients.update"), async (req: AuthedRequest, res, next) => {
  try {
    const facilityId = requireFacilityId(req);
    const body = z
      .object({
        firstName: z.string().optional().nullable(),
        lastName: z.string().optional().nullable(),
        phone: z.string().optional().nullable(),
        dateOfBirth: z.string().optional().nullable(),
        identifierSystem: z.string().optional().nullable(),
        identifierValue: z.string().optional().nullable(),
        excludePatientId: z.string().optional().nullable(),
      })
      .parse(req.body);
    const duplicates = await findPotentialDuplicates({
      facilityId,
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
      dateOfBirth: parseDob(body.dateOfBirth),
      identifierSystem: body.identifierSystem,
      identifierValue: body.identifierValue,
      excludePatientId: body.excludePatientId,
    });
    res.json({ data: duplicates });
  } catch (err) {
    next(err);
  }
});

router.post("/patients", requirePermission("patients.create"), async (req: AuthedRequest, res, next) => {
  try {
    const facilityId = requireFacilityId(req);
    const body = registerSchema.parse(req.body);
    if (body.doctorId) await assertSameFacilityStaff(facilityId, body.doctorId);

    const result = await registerPatient({
      facilityId,
      registeredById: req.user!.sub,
      firstName: body.firstName,
      middleName: body.middleName,
      lastName: body.lastName,
      dateOfBirth: parseDob(body.dateOfBirth),
      age: body.age,
      sex: body.sex,
      blood: body.blood,
      nationality: body.nationality,
      maritalStatus: body.maritalStatus,
      occupation: body.occupation,
      phone: body.phone,
      phoneAlt: body.phoneAlt,
      email: body.email || null,
      region: body.region,
      zone: body.zone,
      woreda: body.woreda,
      kebele: body.kebele,
      addressDetail: body.addressDetail,
      ward: body.ward,
      bed: body.bed,
      doctorId: body.doctorId,
      registrationNotes: body.registrationNotes,
      identifier: body.identifier,
      emergencyContact: body.emergencyContact,
      acknowledgeDuplicates: body.acknowledgeDuplicates,
    });

    if (result.needsReview) {
      return res.status(409).json({
        error: "Possible duplicate patients found. Review matches or resubmit with acknowledgeDuplicates=true.",
        code: "POSSIBLE_DUPLICATES",
        duplicates: result.duplicates,
      });
    }

    await writeAudit({
      actorId: req.user!.sub,
      facilityId,
      action: "patients.register",
      entity: result.patient.id,
      meta: { patientNumber: result.patient.patientNumber },
      req,
    });

    res.status(201).json({
      data: redactPatientForRole({ ...result.patient } as Record<string, unknown>, req.user!.role),
      duplicatesWarned: result.duplicates.length,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/patients", async (req: AuthedRequest, res, next) => {
  try {
    const u = req.user!;
    const facilityId = requireFacilityId(req);
    const scope = patientListWhere(facilityId, u);
    if (!scope) return res.status(403).json({ error: "Missing permission." });

    const { page, limit, skip } = parsePage(req, { limit: 25, max: 100 });
    const q = typeof req.query.q === "string" ? req.query.q : null;
    const status = typeof req.query.status === "string" ? req.query.status : null;
    const sort = typeof req.query.sort === "string" ? req.query.sort : null;

    const { total, rows } = await searchPatients({
      facilityId,
      whereBase: scope,
      q,
      status,
      sort,
      skip,
      take: limit,
    });

    const data = rows.map((row) =>
      redactPatientForRole({ ...row } as Record<string, unknown>, u.role),
    );
    res.json({ data, meta: pageMeta(total, page, limit) });
  } catch (err) {
    next(err);
  }
});

router.get("/patients/:id", async (req: AuthedRequest, res, next) => {
  try {
    const u = req.user!;
    const facilityId = requireFacilityId(req);
    const id = String(req.params.id);
    const profile = await getPatientProfile(facilityId, id);
    if (!profile) return res.status(404).json({ error: "Patient not found." });
    if (!canViewPatientRow(u, profile)) {
      return res.status(403).json({ error: "Forbidden." });
    }

    const payload = { ...profile } as Record<string, unknown>;
    if (!canReadMedicalHistory(u.role)) {
      delete payload.medicalHistory;
      delete payload.allergies;
      if ("condition" in payload) payload.condition = "[restricted]";
    } else {
      await writeAudit({
        actorId: u.sub,
        facilityId,
        action: "patients.profile_access",
        entity: id,
        meta: { role: u.role },
        req,
      });
    }
    if (!canManageDocuments(u.role, "read")) {
      delete payload.documents;
    }

    res.json({ data: redactPatientForRole(payload, u.role) });
  } catch (err) {
    next(err);
  }
});

router.patch("/patients/:id", requirePermission("patients.update"), async (req: AuthedRequest, res, next) => {
  try {
    const facilityId = requireFacilityId(req);
    const id = String(req.params.id);
    const body = registerSchema.partial().extend({
      status: z.enum(["active", "archived"]).optional(),
    }).parse(req.body);

    if (body.status === "archived" && !can(req.user!.role, "patients.archive") && !can(req.user!.role, "patients.update")) {
      return res.status(403).json({ error: "Missing archive permission." });
    }
    if (body.doctorId) await assertSameFacilityStaff(facilityId, body.doctorId);

    const updated = await updatePatientDemographics(facilityId, id, {
      ...body,
      dateOfBirth: body.dateOfBirth !== undefined ? parseDob(body.dateOfBirth) : undefined,
      email: body.email === "" ? null : body.email,
    });
    if (!updated) return res.status(404).json({ error: "Patient not found." });

    await writeAudit({
      actorId: req.user!.sub,
      facilityId,
      action: body.status === "archived" ? "patients.archive" : "patients.update",
      entity: id,
      req,
    });

    res.json({ data: redactPatientForRole({ ...updated } as Record<string, unknown>, req.user!.role) });
  } catch (err) {
    next(err);
  }
});

/** Medical history */
router.get("/patients/:id/medical-history", async (req: AuthedRequest, res, next) => {
  try {
    const u = req.user!;
    if (!canReadMedicalHistory(u.role)) {
      return res.status(403).json({ error: "Medical history is restricted for your role." });
    }
    const facilityId = requireFacilityId(req);
    const patientId = String(req.params.id);
    const patient = await prisma.patient.findFirst({ where: { id: patientId, facilityId } });
    if (!patient) return res.status(404).json({ error: "Patient not found." });
    if (!canViewPatientRow(u, patient)) return res.status(403).json({ error: "Forbidden." });

    const rows = await prisma.medicalHistoryEntry.findMany({
      where: { patientId, facilityId },
      orderBy: { createdAt: "desc" },
    });
    await writeAudit({
      actorId: u.sub,
      facilityId,
      action: "patients.medical_history.read",
      entity: patientId,
      req,
    });
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.post("/patients/:id/medical-history", async (req: AuthedRequest, res, next) => {
  try {
    const u = req.user!;
    if (!canManageMedicalHistory(u.role)) {
      return res.status(403).json({ error: "Missing medical history permission." });
    }
    const facilityId = requireFacilityId(req);
    const patientId = String(req.params.id);
    const patient = await prisma.patient.findFirst({ where: { id: patientId, facilityId } });
    if (!patient) return res.status(404).json({ error: "Patient not found." });
    if (!canViewPatientRow(u, patient)) return res.status(403).json({ error: "Forbidden." });

    const body = z
      .object({
        category: z.enum([
          "condition",
          "surgery",
          "family",
          "medication_current",
          "medication_past",
          "lifestyle",
          "other",
        ]),
        title: z.string().min(1).max(200),
        details: z.string().max(4000).optional().nullable(),
        status: z.enum(["active", "inactive"]).optional(),
        startedOn: z.string().optional().nullable(),
        endedOn: z.string().optional().nullable(),
      })
      .parse(req.body);

    const row = await prisma.medicalHistoryEntry.create({
      data: {
        facilityId,
        patientId,
        category: body.category,
        title: body.title,
        details: body.details || null,
        status: body.status || "active",
        startedOn: parseDob(body.startedOn),
        endedOn: parseDob(body.endedOn),
        createdById: u.sub,
        updatedById: u.sub,
      },
    });
    await writeAudit({
      actorId: u.sub,
      facilityId,
      action: "patients.medical_history.create",
      entity: row.id,
      meta: { patientId, category: body.category },
      req,
    });
    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

router.patch("/patients/:id/medical-history/:entryId", async (req: AuthedRequest, res, next) => {
  try {
    const u = req.user!;
    if (!canManageMedicalHistory(u.role)) {
      return res.status(403).json({ error: "Missing medical history permission." });
    }
    const facilityId = requireFacilityId(req);
    const patientId = String(req.params.id);
    const entryId = String(req.params.entryId);
    const body = z
      .object({
        title: z.string().min(1).max(200).optional(),
        details: z.string().max(4000).optional().nullable(),
        status: z.enum(["active", "inactive"]).optional(),
        endedOn: z.string().optional().nullable(),
      })
      .parse(req.body);

    const existing = await prisma.medicalHistoryEntry.findFirst({
      where: { id: entryId, patientId, facilityId },
    });
    if (!existing) return res.status(404).json({ error: "History entry not found." });

    // Soft-deactivate preserves history; never delete clinical history rows via this API.
    const row = await prisma.medicalHistoryEntry.update({
      where: { id: entryId },
      data: {
        title: body.title,
        details: body.details === undefined ? undefined : body.details,
        status: body.status,
        endedOn: body.endedOn !== undefined ? parseDob(body.endedOn) : undefined,
        updatedById: u.sub,
      },
    });
    await writeAudit({
      actorId: u.sub,
      facilityId,
      action: "patients.medical_history.update",
      entity: entryId,
      meta: { patientId },
      req,
    });
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

router.post("/patients/:id/allergies", async (req: AuthedRequest, res, next) => {
  try {
    const u = req.user!;
    if (!canManageMedicalHistory(u.role)) {
      return res.status(403).json({ error: "Missing medical history permission." });
    }
    const facilityId = requireFacilityId(req);
    const patientId = String(req.params.id);
    const patient = await prisma.patient.findFirst({ where: { id: patientId, facilityId } });
    if (!patient || !canViewPatientRow(u, patient)) {
      return res.status(404).json({ error: "Patient not found." });
    }
    const body = z
      .object({
        substance: z.string().min(1).max(120),
        reaction: z.string().max(400).optional().nullable(),
        severity: z.enum(["mild", "moderate", "severe"]).optional().nullable(),
      })
      .parse(req.body);
    const row = await prisma.patientAllergy.create({
      data: {
        patientId,
        substance: body.substance,
        reaction: body.reaction || null,
        severity: body.severity || null,
        createdById: u.sub,
      },
    });
    await writeAudit({
      actorId: u.sub,
      facilityId,
      action: "patients.allergy.create",
      entity: row.id,
      meta: { patientId },
      req,
    });
    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

/** Encounters */
router.get("/patients/:id/encounters", async (req: AuthedRequest, res, next) => {
  try {
    const u = req.user!;
    if (!canManageEncounters(u.role, "read")) {
      return res.status(403).json({ error: "Missing encounter permission." });
    }
    const facilityId = requireFacilityId(req);
    const patientId = String(req.params.id);
    const patient = await prisma.patient.findFirst({ where: { id: patientId, facilityId } });
    if (!patient || !canViewPatientRow(u, patient)) {
      return res.status(404).json({ error: "Patient not found." });
    }
    const rows = await prisma.encounter.findMany({
      where: { patientId, facilityId },
      orderBy: { visitedAt: "desc" },
      take: 100,
    });
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.post("/patients/:id/encounters", async (req: AuthedRequest, res, next) => {
  try {
    const u = req.user!;
    if (!canManageEncounters(u.role, "create")) {
      return res.status(403).json({ error: "Missing encounter create permission." });
    }
    const facilityId = requireFacilityId(req);
    const patientId = String(req.params.id);
    const patient = await prisma.patient.findFirst({ where: { id: patientId, facilityId } });
    if (!patient || !canViewPatientRow(u, patient)) {
      return res.status(404).json({ error: "Patient not found." });
    }
    const body = z
      .object({
        type: z.enum(["outpatient", "emergency", "inpatient", "follow_up"]),
        visitedAt: z.string().optional().nullable(),
        departmentId: z.string().optional().nullable(),
        doctorId: z.string().optional().nullable(),
        notes: z.string().max(2000).optional().nullable(),
      })
      .parse(req.body);

    if (body.doctorId) await assertSameFacilityStaff(facilityId, body.doctorId);
    // Receptionists may create encounters but notes stay empty unless clinical role.
    const notes =
      body.notes && (can(u.role, "clinical.write") || can(u.role, "clinical.read"))
        ? body.notes
        : canManageEncounters(u.role, "create") && can(u.role, "patients.create") && !can(u.role, "clinical.write")
          ? null
          : body.notes || null;

    const encounterNumber = await allocateEncounterNumber(facilityId);
    const row = await prisma.encounter.create({
      data: {
        facilityId,
        patientId,
        encounterNumber,
        type: body.type,
        visitedAt: body.visitedAt ? new Date(body.visitedAt) : new Date(),
        departmentId: body.departmentId || null,
        doctorId: body.doctorId || null,
        notes,
        status: "open",
        createdById: u.sub,
      },
    });
    await writeAudit({
      actorId: u.sub,
      facilityId,
      action: "encounters.create",
      entity: row.id,
      meta: { patientId, encounterNumber },
      req,
    });
    res.status(201).json({ data: row });
  } catch (err) {
    next(err);
  }
});

router.patch("/encounters/:id", async (req: AuthedRequest, res, next) => {
  try {
    const u = req.user!;
    if (!canManageEncounters(u.role, "update")) {
      return res.status(403).json({ error: "Missing encounter update permission." });
    }
    const facilityId = requireFacilityId(req);
    const id = String(req.params.id);
    const existing = await prisma.encounter.findFirst({ where: { id, facilityId } });
    if (!existing) return res.status(404).json({ error: "Encounter not found." });

    const body = z
      .object({
        status: z.enum(["open", "in_progress", "completed", "cancelled"]).optional(),
        doctorId: z.string().optional().nullable(),
        notes: z.string().max(2000).optional().nullable(),
      })
      .parse(req.body);

    if (body.doctorId) await assertSameFacilityStaff(facilityId, body.doctorId);
    const notes =
      body.notes !== undefined && !can(u.role, "clinical.write") && !can(u.role, "clinical.read")
        ? undefined
        : body.notes;

    const row = await prisma.encounter.update({
      where: { id },
      data: {
        status: body.status,
        doctorId: body.doctorId === undefined ? undefined : body.doctorId,
        notes,
      },
    });
    await writeAudit({
      actorId: u.sub,
      facilityId,
      action: "encounters.update",
      entity: id,
      req,
    });
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
});

/** Documents — private storage, authenticated download only */
router.get("/patients/:id/documents", async (req: AuthedRequest, res, next) => {
  try {
    const u = req.user!;
    if (!canManageDocuments(u.role, "read")) {
      return res.status(403).json({ error: "Missing document permission." });
    }
    const facilityId = requireFacilityId(req);
    const patientId = String(req.params.id);
    const patient = await prisma.patient.findFirst({ where: { id: patientId, facilityId } });
    if (!patient || !canViewPatientRow(u, patient)) {
      return res.status(404).json({ error: "Patient not found." });
    }
    const rows = await prisma.patientDocument.findMany({
      where: { patientId, facilityId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        category: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        encounterId: true,
        uploadedById: true,
        createdAt: true,
      },
    });
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/patients/:id/documents",
  express.json({ limit: "12mb" }),
  async (req: AuthedRequest, res, next) => {
    try {
      const u = req.user!;
      if (!canManageDocuments(u.role, "upload")) {
        return res.status(403).json({ error: "Missing document upload permission." });
      }
      const facilityId = requireFacilityId(req);
      const patientId = String(req.params.id);
      const patient = await prisma.patient.findFirst({ where: { id: patientId, facilityId } });
      if (!patient || !canViewPatientRow(u, patient)) {
        return res.status(404).json({ error: "Patient not found." });
      }

      const body = z
        .object({
          fileName: z.string().min(1).max(200),
          mimeType: z.string().min(3).max(120),
          contentBase64: z.string().min(1),
          category: z
            .enum(["medical_report", "referral", "lab_report", "supporting", "other"])
            .optional(),
          encounterId: z.string().optional().nullable(),
        })
        .parse(req.body);

      if (body.encounterId) {
        const enc = await prisma.encounter.findFirst({
          where: { id: body.encounterId, facilityId, patientId },
        });
        if (!enc) return res.status(400).json({ error: "Encounter not found for this patient." });
      }

      const buffer = Buffer.from(body.contentBase64, "base64");
      const saved = await savePatientDocumentFile({
        facilityId,
        patientId,
        originalName: body.fileName,
        mimeType: body.mimeType,
        buffer,
      });

      const row = await prisma.patientDocument.create({
        data: {
          facilityId,
          patientId,
          encounterId: body.encounterId || null,
          category: body.category || "other",
          originalName: body.fileName,
          mimeType: body.mimeType,
          sizeBytes: saved.sizeBytes,
          storageKey: saved.storageKey,
          uploadedById: u.sub,
        },
        select: {
          id: true,
          category: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
          encounterId: true,
          uploadedById: true,
          createdAt: true,
        },
      });

      await writeAudit({
        actorId: u.sub,
        facilityId,
        action: "patients.document.upload",
        entity: row.id,
        meta: { patientId, mimeType: body.mimeType, sizeBytes: saved.sizeBytes },
        req,
      });

      res.status(201).json({ data: row });
    } catch (err) {
      next(err);
    }
  },
);

router.get("/patients/:patientId/documents/:docId/download", async (req: AuthedRequest, res, next) => {
  try {
    const u = req.user!;
    if (!canManageDocuments(u.role, "read")) {
      return res.status(403).json({ error: "Missing document permission." });
    }
    const facilityId = requireFacilityId(req);
    const patientId = String(req.params.patientId);
    const docId = String(req.params.docId);
    const patient = await prisma.patient.findFirst({ where: { id: patientId, facilityId } });
    if (!patient || !canViewPatientRow(u, patient)) {
      return res.status(404).json({ error: "Patient not found." });
    }
    const doc = await prisma.patientDocument.findFirst({
      where: { id: docId, patientId, facilityId, deletedAt: null },
    });
    if (!doc) return res.status(404).json({ error: "Document not found." });

    const abs = absoluteStoragePath(doc.storageKey);
    if (!fs.existsSync(abs)) return res.status(404).json({ error: "File missing from storage." });

    await writeAudit({
      actorId: u.sub,
      facilityId,
      action: "patients.document.download",
      entity: docId,
      meta: { patientId },
      req,
    });

    res.setHeader("Content-Type", doc.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${doc.originalName.replace(/"/g, "")}"`,
    );
    res.setHeader("Cache-Control", "private, no-store");
    fs.createReadStream(abs).pipe(res);
  } catch (err) {
    next(err);
  }
});

router.delete("/patients/:patientId/documents/:docId", async (req: AuthedRequest, res, next) => {
  try {
    const u = req.user!;
    if (!canManageDocuments(u.role, "delete")) {
      return res.status(403).json({ error: "Missing document delete permission." });
    }
    const facilityId = requireFacilityId(req);
    const patientId = String(req.params.patientId);
    const docId = String(req.params.docId);
    const doc = await prisma.patientDocument.findFirst({
      where: { id: docId, patientId, facilityId, deletedAt: null },
    });
    if (!doc) return res.status(404).json({ error: "Document not found." });

    await prisma.patientDocument.update({
      where: { id: docId },
      data: { deletedAt: new Date() },
    });
    await deleteStoredFile(doc.storageKey);

    await writeAudit({
      actorId: u.sub,
      facilityId,
      action: "patients.document.delete",
      entity: docId,
      meta: { patientId },
      req,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
