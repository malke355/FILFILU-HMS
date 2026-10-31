import type { AddressInfo } from "node:net";
import { afterAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { createApp } from "./app.js";
import { listenWithNest } from "./nest-host.js";

describe("Nest host", () => {
  let app: INestApplication;

  afterAll(async () => {
    if (app) await app.close();
  });

  it("serves the existing API routes", async () => {
    app = await listenWithNest(createApp(), 0);
    const address = app.getHttpServer().address() as AddressInfo;
    const health = await fetch(`http://127.0.0.1:${address.port}/api/health`);
    const body = (await health.json()) as { ok: boolean; service: string; database: string };
    // DB may be up locally or down in CI — both are valid health payloads.
    expect([200, 503]).toContain(health.status);
    expect(body.service).toBe("filfilu-api");
    expect(["up", "down"]).toContain(body.database);
    expect(body.ok).toBe(body.database === "up");

    const index = await fetch(`http://127.0.0.1:${address.port}/api`);
    expect(index.status).toBe(200);
    const info = (await index.json()) as { name: string; health: string };
    expect(info.name).toBe("Filfilu HMS API");
    expect(info.health).toBe("/api/health");

    const login = await fetch(`http://127.0.0.1:${address.port}/login.html`);
    expect(login.status).toBe(200);
    expect(await login.text()).toContain("Welcome Back");
  });
});
