import { ForbiddenException, Injectable } from '@nestjs/common';
import { can } from '../auth/permissions';
import type { JwtPayload } from '../auth/jwt-payload';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async activity(user: JwtPayload) {
    const rows = await this.prisma.auditLog.findMany({
      where: can(user.role, 'reports:read') ? undefined : { actorId: user.sub },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return {
      data: rows.map((row) => ({
        id: row.id,
        text: row.action.replaceAll('.', ' · '),
        entity: row.entity,
        time: row.createdAt.toISOString(),
        role: user.role,
      })),
    };
  }

  async notifications(user: JwtPayload) {
    this.assert(user.role, 'notifications:read_own');
    const rows = await this.prisma.notification.findMany({
      where: { OR: [{ userId: user.sub }, { role: user.role }] },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { data: rows };
  }

  async reportSummary(user: JwtPayload) {
    this.assert(user.role, 'reports:read');
    const [activeStaff, publishedShifts, openAppointments, pendingExchanges, patients] = await Promise.all([
      this.prisma.staff.count({ where: { status: 'active' } }),
      this.prisma.shift.count({ where: { status: 'published' } }),
      this.prisma.appointment.count({ where: { status: { not: 'draft' } } }),
      this.prisma.exchange.count({ where: { status: { not: 'approved' } } }),
      this.prisma.patient.count(),
    ]);
    return {
      data: { activeStaff, publishedShifts, openAppointments, pendingExchanges, patients },
    };
  }

  async dashboard(user: JwtPayload) {
    if (user.role === 'admin') {
      const [activeStaff, publishedShifts, openAppointments, pendingExchanges] = await Promise.all([
        this.prisma.staff.count({ where: { status: 'active' } }),
        this.prisma.shift.count({ where: { status: 'published' } }),
        this.prisma.appointment.count({ where: { status: { not: 'draft' } } }),
        this.prisma.exchange.count({ where: { status: { not: 'approved' } } }),
      ]);
      return {
        data: [
          { label: 'Active staff', value: activeStaff, hint: 'Across all units' },
          { label: 'Published shifts', value: publishedShifts, hint: 'This roster cycle' },
          { label: 'Open visits', value: openAppointments, hint: 'Hospital-wide' },
          { label: 'Pending approvals', value: pendingExchanges, hint: 'Needs admin action' },
        ],
      };
    }

    if (user.role === 'doctor') {
      const [patients, shifts, confirmed, notes] = await Promise.all([
        this.prisma.patient.count({ where: { doctorId: user.staffId ?? '__none__' } }),
        this.prisma.shift.count({ where: { staffId: user.staffId ?? '__none__' } }),
        this.prisma.appointment.count({ where: { doctorId: user.staffId ?? '__none__', status: 'confirmed' } }),
        this.prisma.notification.count({ where: { OR: [{ userId: user.sub }, { role: 'doctor' }] } }),
      ]);
      return {
        data: [
          { label: 'Assigned patients', value: patients, hint: 'Under your care' },
          { label: 'Shifts this week', value: shifts, hint: 'Your roster' },
          { label: 'Confirmed visits', value: confirmed, hint: 'Clinic load' },
          { label: 'Unread alerts', value: notes, hint: 'Action items' },
        ],
      };
    }

    if (user.role === 'nurse') {
      const [patients, shifts, appointments, notes] = await Promise.all([
        this.prisma.patient.count({ where: { ward: user.ward ?? '__none__' } }),
        this.prisma.shift.count({ where: { staffId: user.staffId ?? '__none__' } }),
        this.prisma.appointment.count({ where: { patient: { ward: user.ward ?? '__none__' } } }),
        this.prisma.notification.count({ where: { OR: [{ userId: user.sub }, { role: 'nurse' }] } }),
      ]);
      return {
        data: [
          { label: 'Ward patients', value: patients, hint: user.ward || 'Your ward' },
          { label: 'My shifts', value: shifts, hint: 'Published + draft' },
          { label: 'Clinic list', value: appointments, hint: 'Ward-linked visits' },
          { label: 'Handoffs', value: notes, hint: 'Nursing alerts' },
        ],
      };
    }

    const [visits, confirmed, requested, specialties] = await Promise.all([
      this.prisma.appointment.count({ where: { patientId: user.patientId ?? '__none__' } }),
      this.prisma.appointment.count({ where: { patientId: user.patientId ?? '__none__', status: 'confirmed' } }),
      this.prisma.appointment.count({ where: { patientId: user.patientId ?? '__none__', status: 'requested' } }),
      this.prisma.doctorSchedule.findMany({ select: { specialty: true }, distinct: ['specialty'] }),
    ]);
    void requested;
    const openSlots = await this.prisma.doctorSchedule.findMany({ where: { status: { not: 'full' } } });
    const slotCount = openSlots.reduce((total, row) => total + (JSON.parse(row.slotsJson) as string[]).length, 0);
    return {
      data: [
        { label: 'My visits', value: visits, hint: 'All statuses' },
        { label: 'Confirmed', value: confirmed, hint: 'Ready to attend' },
        { label: 'Specialties', value: specialties.length, hint: 'With open clinics' },
        { label: 'Open slots', value: slotCount, hint: 'Bookable this week' },
      ],
    };
  }

  private assert(role: string, permission: string): void {
    if (!can(role, permission)) {
      throw new ForbiddenException({ error: 'Missing permission.' });
    }
  }
}
