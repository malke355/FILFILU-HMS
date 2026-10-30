import { ValidationPipe, type INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { validationExceptionFactory } from './common/validation-exception';
import { allowedOrigins, landingFiles } from './landing';

export function configureApp(app: INestApplication): void {
  const expressApp = app as NestExpressApplication;
  expressApp.useBodyParser('json', { limit: '1mb' });
  expressApp.enableCors({ origin: allowedOrigins(), credentials: true });
  expressApp.use(landingFiles());
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      exceptionFactory: validationExceptionFactory,
    }),
  );
}
