import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { allocatePatientNumber } from "./patientNumber.js";
import { ageFromDob, composeDisplayName } from "./displayName.js";
import { findPotentialDuplicates } from "./duplicates.js";

export type RegisterPatientInput = {
  facilityId: string;
  registeredById: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  dateOfBirth?: Date | null;
  age?: number | null;
  sex?: string | null;
  blood?: string | null;
  nationality?: string | null;
  maritalStatus?: string | null;
  occupation?: string | null;
  phone?: string | null;
  phoneAlt?: string | null;
  email?: string | null;
  region?: string | null;
  zone?: string | null;
  woreda?: string | null;
  kebele?: string | null;
  addressDetail?: string | null;
  ward?: string | null;
  bed?: string | null;
  doctorId?: string | null;
  registrationNotes?: string | null;
  condition?: string | null;
  identifier?: { system: string; value: string } | null;
  emergencyContact?: {
    name: string;
    relationship?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
  acknowledgeDuplicates?: boolean;
};

export async function registerPatient(input: RegisterPatientInput) {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const middleName = input.middleName?.trim() || null;
  const name = composeDisplayName({ firstName, middleName, lastName });
  const dob = input.dateOfBirth || null;
  const age = ageFromDob(dob, input.age ?? null) ?? 0;

  const duplicates = await findPotentialDuplicates({
    facilityId: input.facilityId,
    firstName,
    lastName,
    phone: input.phone,
    dateOfBirth: dob,
    identifierSystem: input.identifier?.system,
    identifierValue: input.identifier?.value,
  });

  if (duplicates.length && !input.acknowledgeDuplicates) {
    return { needsReview: true as const, duplicates };
  }

  const patientNumber = await allocatePatientNumber(input.facilityId);

  const patient = await prisma.$transaction(async (tx) => {
    const created = await tx.patient.create({
      data: {
        facilityId: input.facilityId,
        patientNumber,
        name,
        firstName,
        middleName,
        lastName,
        dateOfBirth: dob,
        age,
        sex: input.sex || null,
        blood: input.blood || null,
        nationality: input.nationality || null,
        maritalStatus: input.maritalStatus || null,
        occupation: input.occupation || null,
        phone: input.phone || null,
        phoneAlt: input.phoneAlt || null,
        email: input.email || null,
        region: input.region || null,
        zone: input.zone || null,
        woreda: input.woreda || null,
        kebele: input.kebele || null,
        addressDetail: input.addressDetail || null,
        ward: input.ward || null,
        bed: input.bed || null,
        doctorId: input.doctorId || null,
        registrationNotes: input.registrationNotes || null,
        condition: input.condition || null,
        status: "active",
        registeredById: input.registeredById,
      },
    });

    if (input.identifier?.system && input.identifier.value) {
      await tx.patientIdentifier.create({
        data: {
          patientId: created.id,
          facilityId: input.facilityId,
          system: input.identifier.system.trim(),
          value: input.identifier.value.trim(),
        },
      });
    }

    if (input.emergencyContact?.name?.trim()) {
      await tx.patientEmergencyContact.create({
        data: {
          patientId: created.id,
          name: input.emergencyContact.name.trim(),
          relationship: input.emergencyContact.relationship || null,
          phone: input.emergencyContact.phone || null,
          address: input.emergencyContact.address || null,
          isPrimary: true,
        },
      });
    }

    return created;
  });

  return { needsReview: false as const, patient, duplicates };
}

export type PatientSearchParams = {
  facilityId: string;
  whereBase: Prisma.PatientWhereInput;
  q?: string | null;
  status?: string | null;
  sort?: string | null;
  skip: number;
  take: number;
};

export async function searchPatients(params: PatientSearchParams) {
  const q = (params.q || "").trim();
  const and: Prisma.PatientWhereInput[] = [params.whereBase];

  if (params.status === "active" || params.status === "archived") {
    and.push({ status: params.status });
  } else {
    and.push({ status: { not: "deleted" } });
  }

  if (q) {
    and.push({
      OR: [
        { patientNumber: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { firstName: { contains: q, mode: "insensitive" } },
        { middleName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { phoneAlt: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        {
          identifiers: {
            some: { value: { contains: q, mode: "insensitive" } },
          },
        },
      ],
    });
  }

  const where: Prisma.PatientWhereInput = { AND: and };

  let orderBy: Prisma.PatientOrderByWithRelationInput = { createdAt: "desc" };
  if (params.sort === "name") orderBy = { name: "asc" };
  if (params.sort === "number") orderBy = { patientNumber: "asc" };
  if (params.sort === "created_asc") orderBy = { createdAt: "asc" };

  const [total, rows] = await Promise.all([
    prisma.patient.count({ where }),
    prisma.patient.findMany({
      where,
      include: {
        doctor: { select: { id: true, name: true } },
        identifiers: { select: { system: true, value: true }, take: 3 },
      },
      orderBy,
      skip: params.skip,
      take: params.take,
    }),
  ]);

  return { total, rows };
}

export async function getPatientProfile(facilityId: string, patientId: string) {
  return prisma.patient.findFirst({
    where: { id: patientId, facilityId },
    include: {
      doctor: { select: { id: true, name: true, dept: true } },
      identifiers: true,
      emergencyContacts: true,
      allergies: { where: { active: true }, orderBy: { notedAt: "desc" } },
      medicalHistory: { orderBy: { createdAt: "desc" }, take: 50 },
      encounters: { orderBy: { visitedAt: "desc" }, take: 20 },
      documents: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 50,
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
      },
      appointments: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          date: true,
          time: true,
          dept: true,
          status: true,
          reason: true,
        },
      },
    },
  });
}

export async function updatePatientDemographics(
  facilityId: string,
  patientId: string,
  patch: Partial<RegisterPatientInput> & { status?: string },
) {
  const existing = await prisma.patient.findFirst({ where: { id: patientId, facilityId } });
  if (!existing) return null;

  const firstName = patch.firstName?.trim() ?? existing.firstName;
  const middleName =
    patch.middleName !== undefined ? patch.middleName?.trim() || null : existing.middleName;
  const lastName = patch.lastName?.trim() ?? existing.lastName;
  const name = composeDisplayName({
    firstName,
    middleName,
    lastName,
    name: existing.name,
  });
  const dob =
    patch.dateOfBirth !== undefined ? patch.dateOfBirth : existing.dateOfBirth;
  const age = ageFromDob(dob, patch.age !== undefined ? patch.age : existing.age);

  return prisma.patient.update({
    where: { id: patientId },
    data: {
      firstName,
      middleName,
      lastName,
      name,
      dateOfBirth: dob,
      age,
      sex: patch.sex !== undefined ? patch.sex : undefined,
      blood: patch.blood !== undefined ? patch.blood : undefined,
      nationality: patch.nationality !== undefined ? patch.nationality : undefined,
      maritalStatus: patch.maritalStatus !== undefined ? patch.maritalStatus : undefined,
      occupation: patch.occupation !== undefined ? patch.occupation : undefined,
      phone: patch.phone !== undefined ? patch.phone : undefined,
      phoneAlt: patch.phoneAlt !== undefined ? patch.phoneAlt : undefined,
      email: patch.email !== undefined ? patch.email : undefined,
      region: patch.region !== undefined ? patch.region : undefined,
      zone: patch.zone !== undefined ? patch.zone : undefined,
      woreda: patch.woreda !== undefined ? patch.woreda : undefined,
      kebele: patch.kebele !== undefined ? patch.kebele : undefined,
      addressDetail: patch.addressDetail !== undefined ? patch.addressDetail : undefined,
      ward: patch.ward !== undefined ? patch.ward : undefined,
      bed: patch.bed !== undefined ? patch.bed : undefined,
      doctorId: patch.doctorId !== undefined ? patch.doctorId : undefined,
      registrationNotes:
        patch.registrationNotes !== undefined ? patch.registrationNotes : undefined,
      status: patch.status === "archived" || patch.status === "active" ? patch.status : undefined,
    },
  });
}

export async function patientDashboardStats(facilityId: string, whereBase: Prisma.PatientWhereInput) {
  const base = { ...whereBase, facilityId };
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const [total, active, archived, recent] = await Promise.all([
    prisma.patient.count({ where: { ...base, status: { not: "deleted" } } }),
    prisma.patient.count({ where: { ...base, status: "active" } }),
    prisma.patient.count({ where: { ...base, status: "archived" } }),
    prisma.patient.findMany({
      where: { ...base, status: "active", createdAt: { gte: weekAgo } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        patientNumber: true,
        name: true,
        phone: true,
        createdAt: true,
        status: true,
      },
    }),
  ]);
  return { total, active, archived, recentlyRegistered: recent };
}
