import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { can } from '../auth/permissions';
import type { JwtPayload } from '../auth/jwt-payload';
import type { CreateAppointmentDto } from './dto/create-appointment.dto';
import type { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CareService {
  constructor(private readonly prisma: PrismaService) {}

  async patients(user: JwtPayload) {
    let where = {};
    if (can(user.role, 'patients:read_all')) where = {};
    else if (can(user.role, 'patients:read_assigned')) where = { doctorId: user.staffId ?? '__none__' };
    else if (can(user.role, 'patients:read_ward')) where = { ward: user.ward ?? '__none__' };
    else if (can(user.role, 'profile:read_own')) where = { id: user.patientId ?? '__none__' };
    else throw new ForbiddenException({ error: 'Missing permission.' });

    const rows = await this.prisma.patient.findMany({
      where,
      include: { doctor: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
    return { data: rows };
  }

  async appointments(user: JwtPayload) {
    let where = {};
    if (can(user.role, 'appointments:read_all')) where = {};
    else if (user.role === 'doctor') where = { doctorId: user.staffId ?? '__none__' };
    else if (user.role === 'nurse') {
      const wardPatients = await this.prisma.patient.findMany({
        where: { ward: user.ward ?? '__none__' },
        select: { id: true },
      });
      where = { patientId: { in: wardPatients.map((row) => row.id) } };
    } else if (user.role === 'patient') where = { patientId: user.patientId ?? '__none__' };
    else throw new ForbiddenException({ error: 'Missing permission.' });

    const rows = await this.prisma.appointment.findMany({
      where,
      include: {
        patient: { select: { id: true, name: true } },
        doctor: { select: { id: true, name: true } },
      },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    });
    return { data: rows };
  }

  async createAppointment(user: JwtPayload, body: CreateAppointmentDto) {
    const patientId = user.role === 'patient' ? user.patientId : body.patientId;
    if (!patientId) {
      throw new BadRequestException({ error: 'patientId required.' });
    }
    const row = await this.prisma.appointment.create({
      data: {
        patientId,
        doctorId: body.doctorId,
        date: body.date,
        time: body.time,
        dept: body.dept,
        reason: body.reason,
        status: user.role === 'patient' ? 'requested' : 'confirmed',
      },
    });
    await this.prisma.auditLog.create({
      data: { actorId: user.sub, action: 'appointment.create', entity: row.id },
    });
    return { data: row };
  }

  async updateAppointment(user: JwtPayload, id: string, body: UpdateAppointmentDto) {
    const existing = await this.prisma.appointment.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ error: 'Appointment not found.' });
    }
    const allowed =
      can(user.role, 'appointments:manage') ||
      (user.role === 'doctor' && existing.doctorId === user.staffId) ||
      (user.role === 'patient' && existing.patientId === user.patientId && body.status === 'cancelled');
    if (!allowed) {
      throw new ForbiddenException({ error: 'Missing permission.' });
    }
    const row = await this.prisma.appointment.update({
      where: { id },
      data: { status: body.status },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: user.sub,
        action: 'appointment.update',
        entity: row.id,
        metaJson: JSON.stringify({ status: body.status }),
      },
    });
    return { data: row };
  }
}
