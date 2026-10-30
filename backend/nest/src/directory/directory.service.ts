import { ForbiddenException, Injectable } from '@nestjs/common';
import { can } from '../auth/permissions';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DirectoryService {
  constructor(private readonly prisma: PrismaService) {}

  health() {
    return { ok: true, service: 'filfilu-api', time: new Date().toISOString() };
  }

  async departments() {
    const rows = await this.prisma.department.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
    return { data: rows };
  }

  async doctors() {
    const rows = await this.prisma.doctorPublic.findMany({
      include: { doctor: { select: { id: true, name: true, status: true } } },
      orderBy: { specialty: 'asc' },
    });
    return {
      data: rows.map((row) => ({
        id: row.doctorId,
        name: row.doctor.name,
        specialty: row.specialty,
        onDuty: row.onDuty,
        nextSlot: row.nextSlot,
        rating: row.rating,
        status: row.doctor.status,
      })),
    };
  }

  async specialties() {
    const rows = await this.prisma.doctorSchedule.findMany({
      select: { specialty: true },
      distinct: ['specialty'],
      orderBy: { specialty: 'asc' },
    });
    return { data: rows.map((row) => row.specialty) };
  }

  async doctorSchedules(role: string, specialty?: string) {
    if (!can(role, 'schedule:read_public') && !can(role, 'appointments:read_all')) {
      throw new ForbiddenException({ error: 'Missing permission.' });
    }
    const rows = await this.prisma.doctorSchedule.findMany({
      where: specialty ? { specialty } : undefined,
      include: { doctor: { select: { id: true, name: true } } },
      orderBy: [{ date: 'asc' }, { specialty: 'asc' }],
    });
    return {
      data: rows.map((row) => ({
        id: row.id,
        doctorId: row.doctorId,
        doctorName: row.doctor.name,
        specialty: row.specialty,
        day: row.day,
        date: row.date,
        slots: JSON.parse(row.slotsJson) as string[],
        room: row.room,
        status: row.status,
      })),
    };
  }
}
