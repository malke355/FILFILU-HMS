import 'reflect-metadata';
import path from 'path';
import { config as loadEnv } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

loadEnv({ path: path.resolve(__dirname, '../../.env') });

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  configureApp(app);
  const config = app.get(ConfigService);
  const port = Number(config.get<string>('PORT') ?? config.get<string>('NEST_PORT') ?? 8080);
  await app.listen(port, '0.0.0.0');
  console.log(`Filfilu app http://127.0.0.1:${port}/login.html`);
  console.log(`Filfilu API http://127.0.0.1:${port}/api/health`);
}

void bootstrap();
