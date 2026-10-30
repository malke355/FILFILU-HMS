import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import jwt from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

const EXPRESS = 'http://127.0.0.1:8080';

type Json = Record<string, unknown>;

describe('DirectoryModule', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  let auditIdsBefore = new Set<string>();
  let usersBefore = 0;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 0;
    base = `http://127.0.0.1:${port}`;
    prisma = app.get(PrismaService);
    usersBefore = await prisma.user.count();
    auditIdsBefore = new Set((await prisma.auditLog.findMany({ select: { id: true } })).map((row) => row.id));
    const health = await fetch(`${EXPRESS}/api/health`);
    expect(health.ok).toBe(true);
  });

  afterAll(async () => {
    try {
      if (prisma) {
        const created = await prisma.auditLog.findMany({
          where: { action: 'auth.login' },
          select: { id: true },
        });
        const ids = created.filter((row) => !auditIdsBefore.has(row.id)).map((row) => row.id);
        if (ids.length > 0) {
          await prisma.auditLog.deleteMany({ where: { id: { in: ids } } });
        }
        expect(await prisma.user.count()).toBe(usersBefore);
      }
    } finally {
      if (app) await app.close();
    }
  });

  it('matches Express for public directory reads', async () => {
    for (const path of ['/api/departments', '/api/doctors', '/api/specialties']) {
      const nest = await get(path);
      const express = await getExpress(path);
      expect(nest.status).toBe(200);
      expect(express.status).toBe(200);
      expect(nest.body).toEqual(express.body);
    }
    const departments = await get('/api/departments');
    expect(Array.isArray((departments.body.data as unknown[]))).toBe(true);
    expect((departments.body.data as unknown[]).length).toBeGreaterThanOrEqual(9);
  });

  it('returns the health payload without requiring a token', async () => {
    const nest = await get('/api/health');
    const express = await getExpress('/api/health');
    expect(nest.status).toBe(200);
    expect(express.status).toBe(200);
    expect(nest.body.ok).toBe(true);
    expect(nest.body.service).toBe('filfilu-api');
    expect(nest.body.service).toBe(express.body.service);
    expect(typeof nest.body.time).toBe('string');
    expect(Number.isNaN(Date.parse(String(nest.body.time)))).toBe(false);
  });

  it('ignores a bearer token on the public doctor list', async () => {
    const open = await get('/api/doctors');
    const invalid = await get('/api/doctors', { authorization: 'Bearer not-a-token' });
    const token = await login('patient@filfilu.com');
    const authed = await get('/api/doctors', { authorization: `Bearer ${token}` });
    expect(open.status).toBe(200);
    expect(invalid.status).toBe(200);
    expect(authed.status).toBe(200);
    expect(invalid.body).toEqual(open.body);
    expect(authed.body).toEqual(open.body);
    const express = await getExpress('/api/doctors', { authorization: 'Bearer not-a-token' });
    expect(express.status).toBe(200);
    expect(express.body).toEqual(open.body);
  });

  it('returns doctor schedules to patient and admin, and refuses doctor and nurse', async () => {
    const patient = await login('patient@filfilu.com');
    const admin = await login('admin@filfilu.com');
    const doctor = await login('doctor@filfilu.com');
    const nurse = await login('nurse@filfilu.com');

    const patientSchedules = await get('/api/doctor-schedules', { authorization: `Bearer ${patient}` });
    const adminSchedules = await get('/api/doctor-schedules', { authorization: `Bearer ${admin}` });
    expect(patientSchedules.status).toBe(200);
    expect(adminSchedules.status).toBe(200);
    expect(patientSchedules.body).toEqual(adminSchedules.body);
    expect(Array.isArray((patientSchedules.body.data as unknown[]))).toBe(true);
    expect((patientSchedules.body.data as Json[]).every((row) => Array.isArray(row.slots))).toBe(true);

    const expressPatient = await expressLogin('patient@filfilu.com');
    const expressSchedules = await getExpress('/api/doctor-schedules', {
      authorization: `Bearer ${expressPatient}`,
    });
    expect(patientSchedules.body).toEqual(expressSchedules.body);

    const specialties = (await get('/api/specialties')).body.data as string[];
    expect(specialties.length).toBeGreaterThan(0);
    const filtered = await get(`/api/doctor-schedules?specialty=${encodeURIComponent(specialties[0])}`, {
      authorization: `Bearer ${patient}`,
    });
    const expressFiltered = await getExpress(`/api/doctor-schedules?specialty=${encodeURIComponent(specialties[0])}`, {
      authorization: `Bearer ${expressPatient}`,
    });
    expect(filtered.status).toBe(200);
    expect(filtered.body).toEqual(expressFiltered.body);
    expect((filtered.body.data as Json[]).every((row) => row.specialty === specialties[0])).toBe(true);

    const empty = await get('/api/doctor-schedules?specialty=No%20Such%20Clinic', {
      authorization: `Bearer ${patient}`,
    });
    const expressEmpty = await getExpress('/api/doctor-schedules?specialty=No%20Such%20Clinic', {
      authorization: `Bearer ${expressPatient}`,
    });
    expect(empty.body).toEqual(expressEmpty.body);
    expect(empty.body).toEqual({ data: [] });

    for (const token of [doctor, nurse]) {
      const denied = await get('/api/doctor-schedules', { authorization: `Bearer ${token}` });
      expect(denied.status).toBe(403);
      expect(denied.body).toEqual({ error: 'Missing permission.' });
    }
    const expressDoctor = await expressLogin('doctor@filfilu.com');
    const expressDenied = await getExpress('/api/doctor-schedules', {
      authorization: `Bearer ${expressDoctor}`,
    });
    expect(expressDenied.status).toBe(403);
    expect(expressDenied.body).toEqual({ error: 'Missing permission.' });
  });

  it('requires a valid bearer token for doctor schedules', async () => {
    const missing = await get('/api/doctor-schedules');
    expect(missing.status).toBe(401);
    expect(missing.body).toEqual({ error: 'Authentication required.' });

    const invalid = await get('/api/doctor-schedules', { authorization: 'Bearer not-a-token' });
    expect(invalid.status).toBe(401);
    expect(invalid.body).toEqual({ error: 'Invalid or expired token.' });

    const expressMissing = await getExpress('/api/doctor-schedules');
    expect(expressMissing.body).toEqual(missing.body);
  });

  it('accepts an Express-issued token for doctor schedules', async () => {
    const patient = await prisma.user.findUnique({ where: { email: 'patient@filfilu.com' } });
    expect(patient).toBeTruthy();
    const signed = jwt.sign(
      {
        sub: patient!.id,
        email: patient!.email,
        role: patient!.role,
        name: patient!.name,
        staffId: patient!.staffId,
        patientId: patient!.patientId,
        ward: patient!.ward,
        dept: patient!.dept,
        title: patient!.title,
      },
      process.env.JWT_SECRET || 'filfilu-dev-secret-change-me',
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'] },
    );
    const live = await expressLogin('patient@filfilu.com');
    const fromSigned = await get('/api/doctor-schedules', { authorization: `Bearer ${signed}` });
    const fromLive = await get('/api/doctor-schedules', { authorization: `Bearer ${live}` });
    const fromExpress = await getExpress('/api/doctor-schedules', { authorization: `Bearer ${live}` });
    expect(fromSigned.status).toBe(200);
    expect(fromLive.status).toBe(200);
    expect(fromSigned.body).toEqual(fromExpress.body);
    expect(fromLive.body).toEqual(fromExpress.body);
  });

  async function login(email: string): Promise<string> {
    const response = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'filfilu' }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as Json;
    return String(body.token);
  }

  async function expressLogin(email: string): Promise<string> {
    const response = await fetch(`${EXPRESS}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'filfilu' }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as Json;
    return String(body.token);
  }

  async function get(path: string, headers?: Record<string, string>) {
    const response = await fetch(`${base}${path}`, { headers });
    return { status: response.status, body: (await response.json()) as Json };
  }

  async function getExpress(path: string, headers?: Record<string, string>) {
    const response = await fetch(`${EXPRESS}${path}`, { headers });
    return { status: response.status, body: (await response.json()) as Json };
  }
});
