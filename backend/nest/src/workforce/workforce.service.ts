import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { can } from '../auth/permissions';
import type { JwtPayload } from '../auth/jwt-payload';
import type { CreateExchangeDto } from './dto/create-exchange.dto';
import type { UpdateExchangeDto } from './dto/update-exchange.dto';
import { PrismaService } from '../prisma/prisma.service';

const PENDING = ['pending_peer', 'peer_accepted', 'pending_admin'];

@Injectable()
export class WorkforceService {
  constructor(private readonly prisma: PrismaService) {}

  async staff(user: JwtPayload) {
    this.assertAny(user.role, ['staff:read', 'schedule:read_own']);
    if (can(user.role, 'staff:read')) {
      const rows = await this.prisma.staff.findMany({ orderBy: { name: 'asc' } });
      return { data: rows };
    }
    const rows = user.staffId
      ? await this.prisma.staff.findMany({ where: { id: user.staffId } })
      : [];
    return { data: rows };
  }

  async shifts(user: JwtPayload) {
    this.assertAny(user.role, ['schedule:read', 'schedule:write', 'schedule:read_own']);
    let where = {};
    if (can(user.role, 'schedule:read') || can(user.role, 'schedule:write')) where = {};
    else where = { staffId: user.staffId ?? '__none__' };
    const rows = await this.prisma.shift.findMany({
      where,
      include: { staff: { select: { id: true, name: true } } },
      orderBy: [{ date: 'asc' }, { slot: 'asc' }],
    });
    return { data: rows };
  }

  async publishShift(user: JwtPayload, id: string) {
    this.assertAny(user.role, ['schedule:publish']);
    const row = await this.prisma.shift.update({
      where: { id },
      data: { status: 'published' },
    });
    await this.prisma.auditLog.create({
      data: { actorId: user.sub, action: 'shift.publish', entity: row.id },
    });
    return { data: row };
  }

  async publishDrafts(user: JwtPayload) {
    this.assertAny(user.role, ['schedule:publish']);
    const result = await this.prisma.shift.updateMany({
      where: { status: 'draft' },
      data: { status: 'published' },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: user.sub,
        action: 'shift.publish_drafts',
        metaJson: JSON.stringify({ count: result.count }),
      },
    });
    return { data: { published: result.count } };
  }

  async exchanges(user: JwtPayload) {
    this.assertAny(user.role, ['exchanges:approve', 'exchanges:request']);
    let where = {};
    if (can(user.role, 'exchanges:approve')) where = {};
    else {
      where = {
        OR: [{ fromStaffId: user.staffId ?? '__none__' }, { toStaffId: user.staffId ?? '__none__' }],
      };
    }
    const rows = await this.prisma.exchange.findMany({
      where,
      include: {
        fromStaff: { select: { id: true, name: true } },
        toStaff: { select: { id: true, name: true } },
      },
      orderBy: { date: 'asc' },
    });
    return { data: rows };
  }

  async createExchange(user: JwtPayload, body: CreateExchangeDto) {
    this.assertAny(user.role, ['exchanges:request']);
    if (!user.staffId) {
      throw new BadRequestException({ error: 'Staff profile required.' });
    }
    if (body.toStaffId === user.staffId) {
      throw new BadRequestException({ error: 'Cannot request a swap with yourself.' });
    }
    const row = await this.prisma.exchange.create({
      data: {
        fromStaffId: user.staffId,
        toStaffId: body.toStaffId,
        date: body.date,
        reason: body.reason,
        status: 'pending_peer',
      },
    });
    const meta: { toStaffId: string; date: string; reason?: string } = {
      toStaffId: body.toStaffId,
      date: body.date,
    };
    if (body.reason !== undefined) meta.reason = body.reason;
    await this.prisma.auditLog.create({
      data: {
        actorId: user.sub,
        action: 'exchange.create',
        entity: row.id,
        metaJson: JSON.stringify(meta),
      },
    });
    return { data: row };
  }

  async updateExchange(user: JwtPayload, id: string, body: UpdateExchangeDto) {
    this.assertAny(user.role, ['exchanges:approve', 'exchanges:request']);
    if ((body.status === 'approved' || body.status === 'denied') && !can(user.role, 'exchanges:approve')) {
      throw new ForbiddenException({ error: 'Only admin can approve/deny.' });
    }
    const row = await this.prisma.exchange.update({
      where: { id },
      data: { status: body.status },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: user.sub,
        action: 'exchange.update',
        entity: row.id,
        metaJson: JSON.stringify({ status: body.status }),
      },
    });
    return { data: row };
  }

  async approvePending(user: JwtPayload) {
    this.assertAny(user.role, ['exchanges:approve']);
    const pending = await this.prisma.exchange.findMany({
      where: { status: { in: PENDING } },
    });
    const ids = pending.map((row) => row.id);
    if (ids.length) {
      await this.prisma.exchange.updateMany({
        where: { id: { in: ids } },
        data: { status: 'approved' },
      });
      await this.prisma.auditLog.create({
        data: {
          actorId: user.sub,
          action: 'exchange.approve_pending',
          metaJson: JSON.stringify({ count: ids.length, ids }),
        },
      });
    }
    return { data: { approved: ids.length } };
  }

  private assertAny(role: string, permissions: string[]): void {
    if (!permissions.some((permission) => can(role, permission))) {
      throw new ForbiddenException({ error: 'Missing permission.' });
    }
  }
}
