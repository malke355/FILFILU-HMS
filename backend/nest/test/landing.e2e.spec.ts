import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

const EXPRESS = 'http://127.0.0.1:8080';

describe('Landing pages', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 0;
    base = `http://127.0.0.1:${port}`;
    expect((await fetch(`${EXPRESS}/api/health`)).ok).toBe(true);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('serves the API index and the landing files beside Express', async () => {
    for (const path of ['/api', '/', '/login.html', '/signup.html', '/app.html', '/js/auth.js']) {
      const nest = await fetch(`${base}${path}`);
      const express = await fetch(`${EXPRESS}${path}`);
      expect(nest.status).toBe(express.status);
      expect(await nest.text()).toBe(await express.text());
    }
    const login = await fetch(`${base}/login.html`);
    expect(login.headers.get('content-security-policy')).toBeNull();
    const health = await fetch(`${base}/api/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ ok: true, service: 'filfilu-api' });
  });

  it('returns the Express not-found JSON for an unknown page', async () => {
    const nest = await fetch(`${base}/no-such-page`);
    const express = await fetch(`${EXPRESS}/no-such-page`);
    const nestBody = await nest.json();
    const expressBody = await express.json();
    expect(nest.status).toBe(404);
    expect(nestBody).toEqual(expressBody);
    expect(nestBody).toEqual({ error: 'Not found.' });
  });
});
