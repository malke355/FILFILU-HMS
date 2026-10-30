import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import jwt from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PERMISSIONS } from '../src/auth/permissions';
import { PrismaService } from '../src/prisma/prisma.service';

const EXPRESS = 'http://127.0.0.1:8080';

type Json = Record<string, unknown>;

describe('AuthModule', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  let expressUp = false;
  const createdEmails: string[] = [];
  let auditIdsBefore = new Set<string>();
  let usersBefore = 0;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
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
    expressUp = await probeExpress();
  });

  afterAll(async () => {
    try {
      if (prisma) {
        for (const email of createdEmails) {
          const user = await prisma.user.findUnique({ where: { email } });
          if (!user) continue;
          await prisma.auditLog.deleteMany({ where: { actorId: user.id } });
          await prisma.user.delete({ where: { id: user.id } });
          if (user.staffId) await prisma.staff.delete({ where: { id: user.staffId } });
          if (user.patientId) await prisma.patient.delete({ where: { id: user.patientId } });
        }
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

  it('logs in with the seeded admin account', async () => {
    const { status, body } = await post('/api/auth/login', {
      email: 'Admin@filfilu.com',
      password: 'filfilu',
      role: 'admin',
      ignored: true,
    });
    expect(status).toBe(200);
    expect(typeof body.token).toBe('string');
    const user = body.user as Json;
    expect(user.email).toBe('admin@filfilu.com');
    expect(user.role).toBe('admin');
    expect(user.name).toBe('Selam Bekele');
    expect(user.permissions).toEqual(PERMISSIONS.admin);
    const decoded = jwt.verify(String(body.token), secret()) as Json;
    expect(decoded.sub).toBe(user.userId);
    expect(decoded.email).toBe('admin@filfilu.com');
    expect(decoded.role).toBe('admin');
    expect(decoded.name).toBe('Selam Bekele');
    expect(decoded).toHaveProperty('staffId');
    expect(decoded).toHaveProperty('patientId');
    expect(decoded).toHaveProperty('ward');
    expect(decoded).toHaveProperty('dept');
    expect(decoded).toHaveProperty('title');
    expect(decoded).toHaveProperty('iat');
    expect(decoded).toHaveProperty('exp');
  });

  it('rejects an incorrect password with 401', async () => {
    const { status, body } = await post('/api/auth/login', {
      email: 'admin@filfilu.com',
      password: 'wrong-password',
    });
    expect(status).toBe(401);
    expect(body).toEqual({ error: 'Invalid email or password.' });
  });

  it('rejects a role mismatch with 403', async () => {
    const { status, body } = await post('/api/auth/login', {
      email: 'admin@filfilu.com',
      password: 'filfilu',
      role: 'doctor',
    });
    expect(status).toBe(403);
    expect(body).toEqual({
      error: 'This account is assigned the admin role. Choose “admin” or use another account.',
    });
  });

  it('signs up a new account with 201 and rejects a duplicate email with 409', async () => {
    const email = `nest-signup-${Date.now()}@filfilu.test`;
    createdEmails.push(email);
    const created = await post('/api/auth/signup', {
      first: 'Nest',
      last: 'Nurse',
      email,
      password: 'filfilu',
      role: 'nurse',
    });
    expect(created.status).toBe(201);
    const user = created.body.user as Json;
    expect(user.email).toBe(email);
    expect(user.name).toBe('Nest Nurse');
    expect(user.role).toBe('nurse');
    expect(user.title).toBe('nurse');
    expect(user.permissions).toEqual(PERMISSIONS.nurse);
    expect(typeof created.body.token).toBe('string');

    const stored = await prisma.user.findUnique({ where: { email } });
    expect(stored?.passwordHash.startsWith('$2')).toBe(true);
    expect(stored?.passwordHash.includes('$10$')).toBe(true);
    expect(stored?.staffId).toBeTruthy();

    const duplicate = await post('/api/auth/signup', {
      first: 'Nest',
      last: 'Nurse',
      email: email.toUpperCase(),
      password: 'filfilu',
      role: 'nurse',
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toEqual({ error: 'An account with this email already exists.' });
    expect(await prisma.user.count({ where: { email } })).toBe(1);
  });

  it('creates a patient signup the same way Express does', async () => {
    const email = `nest-patient-${Date.now()}@filfilu.test`;
    createdEmails.push(email);
    const created = await post('/api/auth/signup', {
      first: 'Nest',
      last: 'Patient',
      email,
      password: 'secret1',
      role: 'patient',
    });
    expect(created.status).toBe(201);
    const user = created.body.user as Json;
    expect(user.role).toBe('patient');
    expect(user.title).toBe('Patient');
    expect(user.permissions).toEqual(PERMISSIONS.patient);
    const stored = await prisma.user.findUnique({ where: { email } });
    const patient = stored?.patientId
      ? await prisma.patient.findUnique({ where: { id: stored.patientId } })
      : null;
    expect(patient).toMatchObject({
      name: 'Nest Patient',
      age: 30,
      condition: 'New patient registration',
      doctorId: 's-doc-1',
    });
  });

  it('returns the current user for a valid token and 401 otherwise', async () => {
    const login = await post('/api/auth/login', {
      email: 'doctor@filfilu.com',
      password: 'filfilu',
    });
    expect(login.status).toBe(200);
    const token = String(login.body.token);

    const me = await get('/api/auth/me', { authorization: `Bearer ${token}` });
    expect(me.status).toBe(200);
    expect((me.body.user as Json).email).toBe('doctor@filfilu.com');
    expect((me.body.user as Json).permissions).toEqual(PERMISSIONS.doctor);

    const missing = await get('/api/auth/me');
    expect(missing.status).toBe(401);
    expect(missing.body).toEqual({ error: 'Authentication required.' });

    const malformed = await get('/api/auth/me', { authorization: 'Bearer not-a-token' });
    expect(malformed.status).toBe(401);
    expect(malformed.body).toEqual({ error: 'Invalid or expired token.' });

    const empty = await get('/api/auth/me', { authorization: 'Bearer ' });
    expect(empty.status).toBe(401);
    expect(empty.body).toEqual({ error: 'Authentication required.' });

    const wrongScheme = await get('/api/auth/me', { authorization: `Token ${token}` });
    expect(wrongScheme.status).toBe(401);
    expect(wrongScheme.body).toEqual({ error: 'Authentication required.' });
  });

  it('accepts a token signed the same way Express signs JWTs', async () => {
    const admin = await prisma.user.findUnique({ where: { email: 'admin@filfilu.com' } });
    expect(admin).toBeTruthy();
    const token = jwt.sign(
      {
        sub: admin!.id,
        email: admin!.email,
        role: admin!.role,
        name: admin!.name,
        staffId: admin!.staffId,
        patientId: admin!.patientId,
        ward: admin!.ward,
        dept: admin!.dept,
        title: admin!.title,
      },
      secret(),
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'] },
    );
    const me = await get('/api/auth/me', { authorization: `Bearer ${token}` });
    expect(me.status).toBe(200);
    expect((me.body.user as Json).userId).toBe(admin!.id);
    expect((me.body.user as Json).permissions).toEqual(PERMISSIONS.admin);
  });

  it('accepts a live Express-issued token and matches Express auth responses', async () => {
    expect(expressUp).toBe(true);
    const payload = { email: 'nurse@filfilu.com', password: 'filfilu', role: 'nurse' };
    const expressLogin = await postExpress('/api/auth/login', payload);
    const nestLogin = await post('/api/auth/login', payload);
    expect(expressLogin.status).toBe(200);
    expect(nestLogin.status).toBe(200);
    expect(nestLogin.body.user).toEqual(expressLogin.body.user);
    expect(claims(String(nestLogin.body.token))).toEqual(claims(String(expressLogin.body.token)));

    const me = await get('/api/auth/me', {
      authorization: `Bearer ${String(expressLogin.body.token)}`,
    });
    expect(me.status).toBe(200);
    expect(me.body.user).toEqual(expressLogin.body.user);

    const expressMe = await fetch(`${EXPRESS}/api/auth/me`, {
      headers: { authorization: `Bearer ${String(nestLogin.body.token)}` },
    });
    expect(expressMe.status).toBe(200);
    expect(await expressMe.json()).toEqual({ user: nestLogin.body.user });

    const demos = await get('/api/auth/demo-accounts');
    const expressDemos = await fetch(`${EXPRESS}/api/auth/demo-accounts`);
    expect(demos.status).toBe(200);
    expect(demos.body).toEqual(await expressDemos.json());

    const expressEmpty = await fetch(`${EXPRESS}/api/auth/me`, { headers: { authorization: 'Bearer ' } });
    expect(expressEmpty.status).toBe(401);
    expect(await expressEmpty.json()).toEqual({ error: 'Authentication required.' });

    const mismatch = { email: 'patient@filfilu.com', password: 'filfilu', role: 'admin' };
    const expressMismatch = await postExpress('/api/auth/login', mismatch);
    const nestMismatch = await post('/api/auth/login', mismatch);
    expect(nestMismatch.status).toBe(expressMismatch.status);
    expect(nestMismatch.body).toEqual(expressMismatch.body);
  });

  it('keeps the validation error envelope', async () => {
    const { status, body } = await post('/api/auth/login', {});
    expect(status).toBe(400);
    expect(body.error).toBe('Validation failed.');
    const details = body.details as { formErrors: unknown; fieldErrors: Record<string, unknown> };
    expect(Array.isArray(details.formErrors)).toBe(true);
    expect(Array.isArray(details.fieldErrors.email)).toBe(true);
    expect(Array.isArray(details.fieldErrors.password)).toBe(true);
    expect(body).not.toHaveProperty('statusCode');
    expect(body).not.toHaveProperty('message');
  });

  async function post(path: string, payload: Json) {
    const response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { status: response.status, body: (await response.json()) as Json };
  }

  async function postExpress(path: string, payload: Json) {
    const response = await fetch(`${EXPRESS}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { status: response.status, body: (await response.json()) as Json };
  }

  async function get(path: string, headers?: Record<string, string>) {
    const response = await fetch(`${base}${path}`, { headers });
    return { status: response.status, body: (await response.json()) as Json };
  }
});

function secret(): string {
  return process.env.JWT_SECRET || 'filfilu-dev-secret-change-me';
}

function claims(token: string): Json {
  const decoded = jwt.verify(token, secret()) as Json;
  const { iat: _iat, exp: _exp, ...rest } = decoded;
  return rest;
}

async function probeExpress(): Promise<boolean> {
  try {
    const response = await fetch(`${EXPRESS}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}
