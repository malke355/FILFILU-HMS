import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { can } from '../auth/permissions';
import type { JwtPayload } from '../auth/jwt-payload';

@Injectable()
export class AppointmentCreateGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const role = request.user?.role ?? '';
    if (
      !can(role, 'appointments:request') &&
      !can(role, 'appointments:manage') &&
      !can(role, 'appointments:write_own')
    ) {
      throw new ForbiddenException({ error: 'Missing permission.' });
    }
    return true;
  }
}
