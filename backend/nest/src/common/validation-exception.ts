import { BadRequestException, type ValidationError } from '@nestjs/common';

export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  const fieldErrors: Record<string, string[]> = {};
  collect(errors, fieldErrors);
  return new BadRequestException({
    error: 'Validation failed.',
    details: {
      formErrors: [] as string[],
      fieldErrors,
    },
  });
}

function collect(errors: ValidationError[], fieldErrors: Record<string, string[]>, prefix = ''): void {
  for (const error of errors) {
    const path = prefix ? `${prefix}.${error.property}` : error.property;
    const messages = error.constraints ? Object.values(error.constraints) : [];
    if (messages.length > 0) {
      fieldErrors[path] = messages;
    }
    if (error.children && error.children.length > 0) {
      collect(error.children, fieldErrors, path);
    }
  }
}
