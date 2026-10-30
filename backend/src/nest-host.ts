import "reflect-metadata";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import type { Express } from "express";

/**
 * Nest is the process that listens. Route behavior stays on the Express app
 * (Postgres, cookie sessions, Google, password reset, pagination) so the
 * landing pages keep the API they already call.
 */
class FilfiluHttpModule {}
Module({})(FilfiluHttpModule);

export async function listenWithNest(expressApp: Express, port: number) {
  const app = await NestFactory.create(FilfiluHttpModule, new ExpressAdapter(expressApp), {
    bodyParser: false,
  });
  await app.listen(port, "0.0.0.0");
  return app;
}
