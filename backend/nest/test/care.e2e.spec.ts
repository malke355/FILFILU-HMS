import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

const EXPRESS = 'http://127.0.0.1:8080';
const VISIT_DATE = '2099-08-01';

type Json = Record<string, unknown>;
type AppointmentSnap = { id: string; status: string; updatedAt: number };

describe('CareModule', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  let usersBefore = 0;
  let patientsBefore = 0;
  let appointmentsBefore: AppointmentSnap[] = [];
  let auditIdsBefore = new Set<string>();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 0;
    base = `http://127.0.0.1:${port}`;
    prisma = app.get(PrismaService);
    usersBefore = await prisma.user.count();
    patientsBefore = await prisma.patient.count();
    appointmentsBefore = await snapshotAppointments(prisma);
    auditIdsBefore = new Set((await prisma.auditLog.findMany({ select: { id: true } })).map((row) => row.id));
    expect((await fetch(`${EXPRESS}/api/health`)).ok).toBe(true);
  });

  afterAll(async () => {
    try {
      if (!prisma) return;
      await prisma.appointment.deleteMany({
        where: { id: { notIn: appointmentsBefore.map((row) => row.id) } },
      });
      await restoreAppointments(prisma, appointmentsBefore);
      const createdAudits = (await prisma.auditLog.findMany({ select: { id: true } }))
        .map((row) => row.id)
        .filter((id) => !auditIdsBefore.has(id));
      if (createdAudits.length > 0) {
        await prisma.auditLog.deleteMany({ where: { id: { in: createdAudits } } });
      }
      expect(await prisma.user.count()).toBe(usersBefore);
      expect(await prisma.patient.count()).toBe(patientsBefore);
      expect(await snapshotAppointments(prisma)).toEqual(appointmentsBefore);
    } finally {
      if (app) await app.close();
    }
  });

  it('matches Express patients and appointments for each role', async () => {
    for (const email of ['admin@filfilu.com', 'doctor@filfilu.com', 'nurse@filfilu.com', 'patient@filfilu.com']) {
      const nestToken = await login(email);
      const expressToken = await expressLogin(email);
      for (const path of ['/api/patients', '/api/appointments']) {
        const nest = await send('GET', path, nestToken);
        const express = await sendExpress('GET', path, expressToken);
        expect(nest.status).toBe(200);
        expect(nest.status).toBe(express.status);
        expect(nest.body).toEqual(express.body);
      }
    }
    const admin = await send('GET', '/api/patients', await login('admin@filfilu.com'));
    expect((admin.body.data as unknown[]).length).toBe(patientsBefore);
    const patient = await send('GET', '/api/patients', await login('patient@filfilu.com'));
    expect((patient.body.data as unknown[]).length).toBe(1);
  });

  it('requires a token', async () => {
    const missing = await send('GET', '/api/patients');
    const expressMissing = await sendExpress('GET', '/api/patients');
    expect(missing.status).toBe(401);
    expect(missing.body).toEqual({ error: 'Authentication required.' });
    expect(missing.body).toEqual(expressMissing.body);
    const invalid = await send('GET', '/api/appointments', 'not-a-token');
    expect(invalid.status).toBe(401);
    expect(invalid.body).toEqual({ error: 'Invalid or expired token.' });
  });

  it('creates appointments with the Express status rules', async () => {
    const patient = await login('patient@filfilu.com');
    const doctor = await login('doctor@filfilu.com');
    const admin = await login('admin@filfilu.com');
    const nurse = await login('nurse@filfilu.com');
    const expressPatient = await expressLogin('patient@filfilu.com');
    const patientUser = await prisma.user.findUnique({ where: { email: 'patient@filfilu.com' } });
    const createdIds: string[] = [];
    try {
      const patientBody = {
        patientId: 'p-2',
        doctorId: 's-doc-1',
        date: VISIT_DATE,
        time: '09:00',
        dept: 'General Medicine',
        reason: 'Nest care check',
      };
      const nestPatient = await send('POST', '/api/appointments', patient, patientBody);
      const expressPatientRow = await sendExpress('POST', '/api/appointments', expressPatient, patientBody);
      createdIds.push(...idsOf(nestPatient, expressPatientRow));
      expect(nestPatient.status).toBe(201);
      expect(expressPatientRow.status).toBe(201);
      expect(nestPatient.body.data).toMatchObject({
        patientId: patientUser!.patientId,
        doctorId: 's-doc-1',
        date: VISIT_DATE,
        time: '09:00',
        dept: 'General Medicine',
        reason: 'Nest care check',
        status: 'requested',
      });
      expect(expressPatientRow.body.data).toMatchObject({
        patientId: patientUser!.patientId,
        status: 'requested',
      });

      const doctorBody = {
        patientId: patientUser!.patientId,
        doctorId: 's-doc-1',
        date: VISIT_DATE,
        time: '10:00',
        dept: 'General Medicine',
      };
      const nestDoctor = await send('POST', '/api/appointments', doctor, doctorBody);
      const expressDoctor = await sendExpress('POST', '/api/appointments', await expressLogin('doctor@filfilu.com'), doctorBody);
      createdIds.push(...idsOf(nestDoctor, expressDoctor));
      expect(nestDoctor.status).toBe(201);
      expect((nestDoctor.body.data as Json).status).toBe('confirmed');
      expect((expressDoctor.body.data as Json).status).toBe('confirmed');
      expect((nestDoctor.body.data as Json).reason).toBeNull();

      const missingPatient = await send('POST', '/api/appointments', admin, {
        doctorId: 's-doc-1',
        date: VISIT_DATE,
        time: '11:00',
        dept: 'General Medicine',
      });
      const expressMissingPatient = await sendExpress('POST', '/api/appointments', await expressLogin('admin@filfilu.com'), {
        doctorId: 's-doc-1',
        date: VISIT_DATE,
        time: '11:00',
        dept: 'General Medicine',
      });
      expect(missingPatient.status).toBe(400);
      expect(missingPatient.body).toEqual({ error: 'patientId required.' });
      expect(missingPatient.body).toEqual(expressMissingPatient.body);

      const nurseDenied = await send('POST', '/api/appointments', nurse, {});
      const expressNurse = await sendExpress('POST', '/api/appointments', await expressLogin('nurse@filfilu.com'), {});
      expect(nurseDenied.status).toBe(403);
      expect(nurseDenied.body).toEqual({ error: 'Missing permission.' });
      expect(nurseDenied.body).toEqual(expressNurse.body);

      const invalid = await send('POST', '/api/appointments', doctor, {});
      expect(invalid.status).toBe(400);
      expect(invalid.body.error).toBe('Validation failed.');
      expect(invalid.body).not.toHaveProperty('statusCode');
    } finally {
      await removeAppointments(prisma, createdIds);
    }
  });

  it('updates appointments with the existing role limits', async () => {
    const patient = await login('patient@filfilu.com');
    const doctor = await login('doctor@filfilu.com');
    const otherDoctor = await login('sara@filfilu.com');
    const admin = await login('admin@filfilu.com');
    const nurse = await login('nurse@filfilu.com');
    const expressPatient = await expressLogin('patient@filfilu.com');
    const createdIds: string[] = [];
    try {
      const body = {
        patientId: 'p-2',
        doctorId: 's-doc-1',
        date: VISIT_DATE,
        time: '13:00',
        dept: 'General Medicine',
      };
      const nest = await send('POST', '/api/appointments', patient, body);
      const express = await sendExpress('POST', '/api/appointments', expressPatient, body);
      createdIds.push(...idsOf(nest, express));
      const nestId = String((nest.body.data as Json).id);
      const expressId = String((express.body.data as Json).id);

      const patientConfirmed = await send('PATCH', `/api/appointments/${nestId}`, patient, { status: 'confirmed' });
      const expressConfirmed = await sendExpress('PATCH', `/api/appointments/${expressId}`, expressPatient, { status: 'confirmed' });
      expect(patientConfirmed.status).toBe(403);
      expect(patientConfirmed.body).toEqual({ error: 'Missing permission.' });
      expect(patientConfirmed.body).toEqual(expressConfirmed.body);
      expect((await prisma.appointment.findUnique({ where: { id: nestId } }))?.status).toBe('requested');

      const cancelled = await send('PATCH', `/api/appointments/${nestId}`, patient, { status: 'cancelled' });
      const expressCancelled = await sendExpress('PATCH', `/api/appointments/${expressId}`, expressPatient, { status: 'cancelled' });
      expect(cancelled.status).toBe(200);
      expect((cancelled.body.data as Json).status).toBe('cancelled');
      expect((expressCancelled.body.data as Json).status).toBe('cancelled');

      const doctorVisit = await send('POST', '/api/appointments', doctor, {
        patientId: 'p-1',
        doctorId: 's-doc-1',
        date: VISIT_DATE,
        time: '14:00',
        dept: 'General Medicine',
      });
      createdIds.push(...idsOf(doctorVisit));
      const doctorId = String((doctorVisit.body.data as Json).id);
      const outsider = await send('PATCH', `/api/appointments/${doctorId}`, otherDoctor, { status: 'completed' });
      expect(outsider.status).toBe(403);
      expect(outsider.body).toEqual({ error: 'Missing permission.' });
      const nursePatch = await send('PATCH', `/api/appointments/${doctorId}`, nurse, { status: 'cancelled' });
      expect(nursePatch.status).toBe(403);
      const completed = await send('PATCH', `/api/appointments/${doctorId}`, doctor, { status: 'completed' });
      expect(completed.status).toBe(200);
      expect((completed.body.data as Json).status).toBe('completed');
      const adminPatch = await send('PATCH', `/api/appointments/${doctorId}`, admin, { status: 'confirmed' });
      expect(adminPatch.status).toBe(200);
      expect((adminPatch.body.data as Json).status).toBe('confirmed');

      const missing = await send('PATCH', '/api/appointments/missing-visit', admin, { status: 'cancelled' });
      const expressMissing = await sendExpress('PATCH', '/api/appointments/missing-visit', await expressLogin('admin@filfilu.com'), {
        status: 'cancelled',
      });
      expect(missing.status).toBe(404);
      expect(missing.body).toEqual({ error: 'Appointment not found.' });
      expect(missing.body).toEqual(expressMissing.body);
    } finally {
      await removeAppointments(prisma, createdIds);
    }
  });

  async function login(email: string): Promise<string> {
    const response = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'filfilu' }),
    });
    expect(response.status).toBe(200);
    return String(((await response.json()) as Json).token);
  }

  async function expressLogin(email: string): Promise<string> {
    const response = await fetch(`${EXPRESS}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'filfilu' }),
    });
    expect(response.status).toBe(200);
    return String(((await response.json()) as Json).token);
  }

  async function send(method: string, path: string, token?: string, payload?: Json) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(payload ? { 'content-type': 'application/json' } : {}),
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    return { status: response.status, body: (await response.json()) as Json };
  }

  async function sendExpress(method: string, path: string, token?: string, payload?: Json) {
    const response = await fetch(`${EXPRESS}${path}`, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(payload ? { 'content-type': 'application/json' } : {}),
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    return { status: response.status, body: (await response.json()) as Json };
  }
});

function idsOf(...results: Array<{ body: Json }>): string[] {
  return results
    .map((result) => (result.body.data as Json | undefined)?.id)
    .filter((id): id is string => typeof id === 'string');
}

async function removeAppointments(prisma: PrismaService, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await prisma.auditLog.deleteMany({ where: { entity: { in: ids } } });
  await prisma.appointment.deleteMany({ where: { id: { in: ids } } });
}

async function snapshotAppointments(prisma: PrismaService): Promise<AppointmentSnap[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; status: string; updatedAt: bigint | number }>>(
    'SELECT id, status, updatedAt FROM Appointment ORDER BY id',
  );
  return rows.map((row) => ({ id: row.id, status: row.status, updatedAt: Number(row.updatedAt) }));
}

async function restoreAppointments(prisma: PrismaService, rows: AppointmentSnap[]): Promise<void> {
  for (const row of rows) {
    await prisma.$executeRawUnsafe(
      'UPDATE Appointment SET status = ?, updatedAt = ? WHERE id = ?',
      row.status,
      row.updatedAt,
      row.id,
    );
  }
}
