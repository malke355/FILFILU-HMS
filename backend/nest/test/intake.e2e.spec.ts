import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

const EXPRESS = 'http://127.0.0.1:8080';

type Json = Record<string, unknown>;

describe('IntakeModule', () => {
  let app: INestApplication;
  let base: string;
  let prisma: PrismaService;
  let usersBefore = 0;
  let contactsBefore = 0;
  let bookingsBefore = 0;
  const prefix = `intake-test-${Date.now()}`;

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
    contactsBefore = await prisma.contactMessage.count();
    bookingsBefore = await prisma.bookingRequest.count();
    const health = await fetch(`${EXPRESS}/api/health`);
    expect(health.ok).toBe(true);
  });

  afterAll(async () => {
    try {
      if (prisma) {
        const contacts = await prisma.contactMessage.findMany({
          where: { name: { startsWith: prefix } },
          select: { id: true },
        });
        const bookings = await prisma.bookingRequest.findMany({
          where: { name: { startsWith: prefix } },
          select: { id: true },
        });
        const ids = [...contacts, ...bookings].map((row) => row.id);
        if (ids.length > 0) {
          await prisma.auditLog.deleteMany({ where: { entity: { in: ids } } });
          await prisma.contactMessage.deleteMany({ where: { id: { in: contacts.map((row) => row.id) } } });
          await prisma.bookingRequest.deleteMany({ where: { id: { in: bookings.map((row) => row.id) } } });
        }
        expect(await prisma.user.count()).toBe(usersBefore);
        expect(await prisma.contactMessage.count()).toBe(contactsBefore);
        expect(await prisma.bookingRequest.count()).toBe(bookingsBefore);
      }
    } finally {
      if (app) await app.close();
    }
  });

  it('records a contact message with 201 and the Express confirmation', async () => {
    const payload = {
      name: `${prefix} Abebe`,
      email: 'Abebe@Filfilu.test',
      topic: 'Visiting hours',
      message: 'Which ward entrance is open on Sunday?',
      ignored: true,
    };
    const nest = await post('/api/contact', payload);
    const express = await postExpress('/api/contact', payload);
    expect(nest.status).toBe(201);
    expect(express.status).toBe(201);
    expect(nest.body.message).toBe(`Thanks, ${payload.name}. Your message was recorded.`);
    expect(nest.body.message).toBe(express.body.message);
    expect(nest.body.data).toEqual({ id: (nest.body.data as Json).id });
    expect(typeof (nest.body.data as Json).id).toBe('string');

    const row = await prisma.contactMessage.findUnique({ where: { id: String((nest.body.data as Json).id) } });
    expect(row).toMatchObject({
      name: payload.name,
      email: 'Abebe@Filfilu.test',
      topic: payload.topic,
      message: payload.message,
    });
    const audit = await prisma.auditLog.findFirst({
      where: { entity: row!.id, action: 'contact.create' },
    });
    expect(audit?.actorId).toBeNull();
    expect(JSON.parse(audit!.metaJson!)).toEqual({ email: payload.email, topic: payload.topic });
  });

  it('records a booking with status requested', async () => {
    const payload = {
      name: `${prefix} Sara`,
      department: 'Cardiology',
      date: '2026-11-12',
    };
    const nest = await post('/api/bookings', payload, { authorization: 'Bearer not-a-token' });
    const express = await postExpress('/api/bookings', payload, { authorization: 'Bearer not-a-token' });
    expect(nest.status).toBe(201);
    expect(express.status).toBe(201);
    expect(nest.body.data).toMatchObject({ status: 'requested' });
    expect(nest.body.message).toBe(`${payload.name}, your ${payload.department} visit is requested for ${payload.date}.`);
    expect(nest.body.message).toBe(express.body.message);
    expect((express.body.data as Json).status).toBe('requested');

    const row = await prisma.bookingRequest.findUnique({ where: { id: String((nest.body.data as Json).id) } });
    expect(row).toMatchObject({ ...payload, status: 'requested' });
    const audit = await prisma.auditLog.findFirst({
      where: { entity: row!.id, action: 'booking.create' },
    });
    expect(JSON.parse(audit!.metaJson!)).toEqual(payload);
  });

  it('rejects an empty contact or booking body with the validation envelope', async () => {
    const contact = await post('/api/contact', {});
    const booking = await post('/api/bookings', {});
    expect(contact.status).toBe(400);
    expect(booking.status).toBe(400);
    for (const body of [contact.body, booking.body]) {
      expect(body.error).toBe('Validation failed.');
      const details = body.details as { formErrors: unknown; fieldErrors: Record<string, unknown> };
      expect(Array.isArray(details.formErrors)).toBe(true);
      expect(details.fieldErrors).toBeTruthy();
      expect(body).not.toHaveProperty('statusCode');
      expect(body).not.toHaveProperty('message');
    }
    expect(Array.isArray((contact.body.details as Json).fieldErrors && ((contact.body.details as Json).fieldErrors as Json).email)).toBe(true);

    const expressContact = await postExpress('/api/contact', { email: 'not-an-email' });
    const nestContact = await post('/api/contact', { email: 'not-an-email' });
    expect(nestContact.status).toBe(expressContact.status);
    expect(nestContact.status).toBe(400);
    expect(nestContact.body.error).toBe(expressContact.body.error);
  });

  async function post(path: string, payload: Json, headers?: Record<string, string>) {
    const response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(payload),
    });
    return { status: response.status, body: (await response.json()) as Json };
  }

  async function postExpress(path: string, payload: Json, headers?: Record<string, string>) {
    const response = await fetch(`${EXPRESS}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(payload),
    });
    return { status: response.status, body: (await response.json()) as Json };
  }
});
