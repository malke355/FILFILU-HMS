import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

const EXPRESS = 'http://127.0.0.1:8080';

type Json = Record<string, unknown>;
type ShiftSnap = { id: string; status: string };
type ExchangeSnap = { id: string; status: string; updatedAt: number };

describe('WorkforceModule', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  let usersBefore = 0;
  let staffBefore = 0;
  let shiftsBefore: ShiftSnap[] = [];
  let exchangesBefore: ExchangeSnap[] = [];
  let auditIdsBefore = new Set<string>();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 0;
    base = `http://127.0.0.1:${port}`;
    prisma = app.get(PrismaService);
    usersBefore = await prisma.user.count();
    staffBefore = await prisma.staff.count();
    shiftsBefore = (await prisma.shift.findMany({ select: { id: true, status: true } })).map((row) => ({
      id: row.id,
      status: row.status,
    }));
    exchangesBefore = await snapshotExchanges(prisma);
    auditIdsBefore = new Set((await prisma.auditLog.findMany({ select: { id: true } })).map((row) => row.id));
    expect((await fetch(`${EXPRESS}/api/health`)).ok).toBe(true);
  });

  afterAll(async () => {
    try {
      if (!prisma) return;
      await restoreWorkforce(prisma, shiftsBefore, exchangesBefore);
      await prisma.exchange.deleteMany({ where: { id: { notIn: exchangesBefore.map((row) => row.id) } } });
      await prisma.shift.deleteMany({ where: { id: { notIn: shiftsBefore.map((row) => row.id) } } });
      await restoreWorkforce(prisma, shiftsBefore, exchangesBefore);
      const createdAudits = (await prisma.auditLog.findMany({ select: { id: true } }))
        .map((row) => row.id)
        .filter((id) => !auditIdsBefore.has(id));
      if (createdAudits.length > 0) {
        await prisma.auditLog.deleteMany({ where: { id: { in: createdAudits } } });
      }
      expect(await prisma.user.count()).toBe(usersBefore);
      expect(await prisma.staff.count()).toBe(staffBefore);
      expect(await prisma.shift.count()).toBe(shiftsBefore.length);
      expect(await snapshotExchanges(prisma)).toEqual(exchangesBefore);
      const shiftsNow = await prisma.shift.findMany({ select: { id: true, status: true } });
      expect(shiftsNow.sort((a, b) => a.id.localeCompare(b.id))).toEqual(
        [...shiftsBefore].sort((a, b) => a.id.localeCompare(b.id)),
      );
    } finally {
      if (app) await app.close();
    }
  });

  it('matches Express staff, shifts, and exchanges for each role', async () => {
    for (const email of ['admin@filfilu.com', 'doctor@filfilu.com', 'nurse@filfilu.com', 'patient@filfilu.com']) {
      const nestToken = await login(email);
      const expressToken = await expressLogin(email);
      for (const path of ['/api/staff', '/api/shifts', '/api/exchanges']) {
        const nest = await send('GET', path, nestToken);
        const express = await sendExpress('GET', path, expressToken);
        expect(nest.status).toBe(express.status);
        expect(nest.body).toEqual(express.body);
      }
    }
    const admin = await send('GET', '/api/staff', await login('admin@filfilu.com'));
    expect((admin.body.data as unknown[]).length).toBe(staffBefore);
    const doctor = await send('GET', '/api/staff', await login('doctor@filfilu.com'));
    expect((doctor.body.data as unknown[]).length).toBe(1);
  });

  it('requires a token and refuses a patient', async () => {
    const missing = await send('GET', '/api/staff');
    expect(missing.status).toBe(401);
    expect(missing.body).toEqual({ error: 'Authentication required.' });
    const invalid = await send('GET', '/api/shifts', 'not-a-token');
    expect(invalid.status).toBe(401);
    expect(invalid.body).toEqual({ error: 'Invalid or expired token.' });
    const patient = await login('patient@filfilu.com');
    const expressPatient = await expressLogin('patient@filfilu.com');
    for (const path of ['/api/staff', '/api/shifts', '/api/exchanges']) {
      const nest = await send('GET', path, patient);
      const express = await sendExpress('GET', path, expressPatient);
      expect(nest.status).toBe(403);
      expect(nest.body).toEqual({ error: 'Missing permission.' });
      expect(nest.body).toEqual(express.body);
    }
  });

  it('publishes one shift and reports a missing shift as 500', async () => {
    const admin = await login('admin@filfilu.com');
    const expressAdmin = await expressLogin('admin@filfilu.com');
    const shifts = await send('GET', '/api/shifts', admin);
    const existing = (shifts.body.data as Json[]).find((row) => row.status === 'published');
    expect(existing).toBeTruthy();
    const nest = await send('PATCH', `/api/shifts/${existing!.id}/publish`, admin);
    const express = await sendExpress('PATCH', `/api/shifts/${existing!.id}/publish`, expressAdmin);
    expect(nest.status).toBe(200);
    expect(nest.body).toEqual(express.body);
    expect((nest.body.data as Json).status).toBe('published');

    const missing = await send('PATCH', '/api/shifts/missing-shift/publish', admin);
    const expressMissing = await sendExpress('PATCH', '/api/shifts/missing-shift/publish', expressAdmin);
    expect(missing.status).toBe(500);
    expect(missing.body).toEqual({ error: 'Internal server error.' });
    expect(missing.body).toEqual(expressMissing.body);
  });

  it('publishes draft shifts and restores them', async () => {
    const admin = await login('admin@filfilu.com');
    const expressAdmin = await expressLogin('admin@filfilu.com');
    const drafts = shiftsBefore.filter((row) => row.status === 'draft').length;
    try {
      const nest = await send('POST', '/api/shifts/publish-drafts', admin);
      expect(nest.status).toBe(200);
      expect(nest.body).toEqual({ data: { published: drafts } });
      await restoreShifts(prisma, shiftsBefore);
      const express = await sendExpress('POST', '/api/shifts/publish-drafts', expressAdmin);
      expect(express.status).toBe(200);
      expect(express.body).toEqual(nest.body);
    } finally {
      await restoreShifts(prisma, shiftsBefore);
    }
  });

  it('creates an exchange, rejects a self-swap, and keeps approval with admin', async () => {
    const doctor = await login('doctor@filfilu.com');
    const nurse = await login('nurse@filfilu.com');
    const admin = await login('admin@filfilu.com');
    const expressDoctor = await expressLogin('doctor@filfilu.com');
    const doctorUser = await prisma.user.findUnique({ where: { email: 'doctor@filfilu.com' } });
    const nurseUser = await prisma.user.findUnique({ where: { email: 'nurse@filfilu.com' } });
    const payload = { toStaffId: nurseUser!.staffId, date: '2099-12-31', reason: 'Clinic cover' };
    const nest = await send('POST', '/api/exchanges', doctor, payload);
    const express = await sendExpress('POST', '/api/exchanges', expressDoctor, payload);
    const createdIds = [nest, express]
      .map((result) => (result.body.data as Json | undefined)?.id)
      .filter((id): id is string => typeof id === 'string');
    try {
    expect(nest.status).toBe(201);
    expect(express.status).toBe(201);
    expect(nest.body.data).toMatchObject({
      fromStaffId: doctorUser!.staffId,
      toStaffId: payload.toStaffId,
      date: payload.date,
      reason: payload.reason,
      status: 'pending_peer',
    });
    expect(express.body.data).toMatchObject({
      fromStaffId: doctorUser!.staffId,
      toStaffId: payload.toStaffId,
      date: payload.date,
      reason: payload.reason,
      status: 'pending_peer',
    });

    const self = await send('POST', '/api/exchanges', doctor, {
      toStaffId: doctorUser!.staffId,
      date: '2099-12-31',
    });
    const expressSelf = await sendExpress('POST', '/api/exchanges', expressDoctor, {
      toStaffId: doctorUser!.staffId,
      date: '2099-12-31',
    });
    expect(self.status).toBe(400);
    expect(self.body).toEqual({ error: 'Cannot request a swap with yourself.' });
    expect(self.body).toEqual(expressSelf.body);

    const forbidden = await send('POST', '/api/exchanges', admin, payload);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ error: 'Missing permission.' });

    const createdId = String((nest.body.data as Json).id);
    const doctorApprove = await send('PATCH', `/api/exchanges/${createdId}`, doctor, { status: 'approved' });
    expect(doctorApprove.status).toBe(403);
    expect(doctorApprove.body).toEqual({ error: 'Only admin can approve/deny.' });
    expect((await prisma.exchange.findUnique({ where: { id: createdId } }))?.status).toBe('pending_peer');

    const peer = await send('PATCH', `/api/exchanges/${createdId}`, doctor, { status: 'peer_accepted' });
    expect(peer.status).toBe(200);
    expect((peer.body.data as Json).status).toBe('peer_accepted');
    const approved = await send('PATCH', `/api/exchanges/${createdId}`, admin, { status: 'approved' });
    expect(approved.status).toBe(200);
    expect((approved.body.data as Json).status).toBe('approved');

    const expressId = String((express.body.data as Json).id);
    const expressDenied = await sendExpress('PATCH', `/api/exchanges/${expressId}`, expressDoctor, { status: 'denied' });
    expect(expressDenied.status).toBe(403);
    expect(expressDenied.body).toEqual(doctorApprove.body);
    } finally {
      if (createdIds.length > 0) {
        await prisma.auditLog.deleteMany({ where: { entity: { in: createdIds } } });
        await prisma.exchange.deleteMany({ where: { id: { in: createdIds } } });
      }
    }
  });

  it('approves pending exchanges and restores the previous rows', async () => {
    const admin = await login('admin@filfilu.com');
    const expressAdmin = await expressLogin('admin@filfilu.com');
    const pending = exchangesBefore.filter((row) =>
      ['pending_peer', 'peer_accepted', 'pending_admin'].includes(row.status),
    ).length;
    try {
      const nest = await send('POST', '/api/exchanges/approve-pending', admin);
      expect(nest.status).toBe(200);
      expect(nest.body).toEqual({ data: { approved: pending } });
      await restoreExchanges(prisma, exchangesBefore);
      expect(await snapshotExchanges(prisma)).toEqual(exchangesBefore);
      const express = await sendExpress('POST', '/api/exchanges/approve-pending', expressAdmin);
      expect(express.body).toEqual(nest.body);
    } finally {
      await restoreExchanges(prisma, exchangesBefore);
      expect(await snapshotExchanges(prisma)).toEqual(exchangesBefore);
    }
  });

  it('keeps the validation envelope for a bad exchange body', async () => {
    const doctor = await login('doctor@filfilu.com');
    const nest = await send('POST', '/api/exchanges', doctor, {});
    expect(nest.status).toBe(400);
    expect(nest.body.error).toBe('Validation failed.');
    const details = nest.body.details as { formErrors: unknown; fieldErrors: Record<string, unknown> };
    expect(Array.isArray(details.formErrors)).toBe(true);
    expect(Array.isArray(details.fieldErrors.toStaffId)).toBe(true);
    expect(nest.body).not.toHaveProperty('statusCode');
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

async function snapshotExchanges(prisma: PrismaService): Promise<ExchangeSnap[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; status: string; updatedAt: bigint | number }>>(
    'SELECT id, status, updatedAt FROM Exchange ORDER BY id',
  );
  return rows.map((row) => ({ id: row.id, status: row.status, updatedAt: Number(row.updatedAt) }));
}

async function restoreShifts(prisma: PrismaService, shifts: ShiftSnap[]): Promise<void> {
  for (const row of shifts) {
    await prisma.shift.update({ where: { id: row.id }, data: { status: row.status } });
  }
}

async function restoreExchanges(prisma: PrismaService, exchanges: ExchangeSnap[]): Promise<void> {
  for (const row of exchanges) {
    await prisma.$executeRawUnsafe(
      'UPDATE Exchange SET status = ?, updatedAt = ? WHERE id = ?',
      row.status,
      row.updatedAt,
      row.id,
    );
  }
}

async function restoreWorkforce(
  prisma: PrismaService,
  shifts: ShiftSnap[],
  exchanges: ExchangeSnap[],
): Promise<void> {
  await restoreShifts(prisma, shifts);
  await restoreExchanges(prisma, exchanges);
}
