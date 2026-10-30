import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

const EXPRESS = 'http://127.0.0.1:8080';
const ROLES = ['admin@filfilu.com', 'doctor@filfilu.com', 'nurse@filfilu.com', 'patient@filfilu.com'];

type Json = Record<string, unknown>;

describe('InsightsModule', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  let usersBefore = 0;
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
    auditIdsBefore = new Set((await prisma.auditLog.findMany({ select: { id: true } })).map((row) => row.id));
    expect((await fetch(`${EXPRESS}/api/health`)).ok).toBe(true);
  });

  afterAll(async () => {
    try {
      if (!prisma) return;
      const created = (await prisma.auditLog.findMany({ select: { id: true } }))
        .map((row) => row.id)
        .filter((id) => !auditIdsBefore.has(id));
      if (created.length > 0) {
        await prisma.auditLog.deleteMany({ where: { id: { in: created } } });
      }
      expect(await prisma.user.count()).toBe(usersBefore);
      expect(await prisma.auditLog.count()).toBe(auditIdsBefore.size);
    } finally {
      if (app) await app.close();
    }
  });

  it('matches Express activity, notifications, and dashboard stats for each role', async () => {
    for (const email of ROLES) {
      const nestToken = await login(email);
      const expressToken = await expressLogin(email);
      for (const path of ['/api/activity', '/api/notifications', '/api/dashboard/stats']) {
        const nest = await send(path, nestToken);
        const express = await sendExpress(path, expressToken);
        expect(nest.status).toBe(200);
        expect(express.status).toBe(200);
        expect(nest.body).toEqual(express.body);
      }
    }
    const activity = await send('/api/activity', await login('admin@filfilu.com'));
    const rows = activity.body.data as Json[];
    expect(rows.length).toBeLessThanOrEqual(20);
    expect(String(rows[0]?.text ?? '')).toContain(' · ');
  });

  it('limits the report summary to roles with reports:read', async () => {
    const admin = await login('admin@filfilu.com');
    const expressAdmin = await expressLogin('admin@filfilu.com');
    const nest = await send('/api/reports/summary', admin);
    const express = await sendExpress('/api/reports/summary', expressAdmin);
    expect(nest.status).toBe(200);
    expect(nest.body).toEqual(express.body);
    expect(nest.body.data).toEqual(
      expect.objectContaining({
        activeStaff: expect.any(Number),
        publishedShifts: expect.any(Number),
        openAppointments: expect.any(Number),
        pendingExchanges: expect.any(Number),
        patients: expect.any(Number),
      }),
    );

    for (const email of ['doctor@filfilu.com', 'nurse@filfilu.com', 'patient@filfilu.com']) {
      const denied = await send('/api/reports/summary', await login(email));
      const expressDenied = await sendExpress('/api/reports/summary', await expressLogin(email));
      expect(denied.status).toBe(403);
      expect(denied.body).toEqual({ error: 'Missing permission.' });
      expect(denied.body).toEqual(expressDenied.body);
    }
  });

  it('requires a bearer token', async () => {
    for (const path of ['/api/activity', '/api/notifications', '/api/dashboard/stats', '/api/reports/summary']) {
      const missing = await send(path);
      const express = await sendExpress(path);
      expect(missing.status).toBe(401);
      expect(missing.body).toEqual({ error: 'Authentication required.' });
      expect(missing.body).toEqual(express.body);
    }
    const invalid = await send('/api/dashboard/stats', 'not-a-token');
    expect(invalid.status).toBe(401);
    expect(invalid.body).toEqual({ error: 'Invalid or expired token.' });
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

  async function send(path: string, token?: string) {
    const response = await fetch(`${base}${path}`, {
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
    });
    return { status: response.status, body: (await response.json()) as Json };
  }

  async function sendExpress(path: string, token?: string) {
    const response = await fetch(`${EXPRESS}${path}`, {
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
    });
    return { status: response.status, body: (await response.json()) as Json };
  }
});
