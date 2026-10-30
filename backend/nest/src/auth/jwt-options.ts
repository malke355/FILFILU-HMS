import type { SignOptions } from 'jsonwebtoken';
import type { ConfigService } from '@nestjs/config';

export const JWT_SECRET_FALLBACK = 'filfilu-dev-secret-change-me';
export const JWT_EXPIRES_IN_FALLBACK = '7d';

export function jwtSecret(config: ConfigService): string {
  return config.get<string>('JWT_SECRET') || JWT_SECRET_FALLBACK;
}

export function jwtExpiresIn(config: ConfigService): SignOptions['expiresIn'] {
  return (config.get<string>('JWT_EXPIRES_IN') || JWT_EXPIRES_IN_FALLBACK) as SignOptions['expiresIn'];
}
