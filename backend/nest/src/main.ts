import 'reflect-metadata';
import path from 'path';
import { config as loadEnv } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

loadEnv({ path: path.resolve(__dirname, '../../.env') });

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = Number(config.get<string>('NEST_PORT') ?? 8081);
  await app.listen(port, '0.0.0.0');
  console.log(`Filfilu NestJS migration listener http://127.0.0.1:${port}`);
}

void bootstrap();
