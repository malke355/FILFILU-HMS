import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (isApiError(body)) {
        response.status(status).json(body);
        return;
      }
      if (status === HttpStatus.NOT_FOUND) {
        response.status(status).json({ error: 'Not found.' });
        return;
      }
      if (status === HttpStatus.UNAUTHORIZED) {
        response.status(status).json({ error: unauthorizedMessage(body) });
        return;
      }
    }

    console.error(exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Internal server error.' });
  }
}

function isApiError(body: unknown): body is { error: string } {
  if (typeof body !== 'object' || body === null) return false;
  const record = body as { error?: unknown; statusCode?: unknown };
  return typeof record.error === 'string' && record.statusCode === undefined;
}

function unauthorizedMessage(body: unknown): string {
  const message = readMessage(body);
  if (!message || message === 'No auth token' || message === 'Unauthorized') {
    return 'Authentication required.';
  }
  return 'Invalid or expired token.';
}

function readMessage(body: unknown): string {
  if (typeof body === 'string') return body;
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const message = (body as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '';
}
