import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('PrismaModule', () => {
  it('reads the existing Filfilu SQLite records without changing them', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    try {
      const prisma = moduleRef.get(PrismaService);
      const beforeUsers = await prisma.user.count();
      const admin = await prisma.user.findUnique({ where: { email: 'admin@filfilu.com' } });
      const departments = await prisma.department.count();
      const appointment = await prisma.appointment.findFirst({
        include: { patient: true, doctor: true },
      });
      const afterUsers = await prisma.user.count();

      expect(admin?.role).toBe('admin');
      expect(departments).toBeGreaterThanOrEqual(9);
      expect(appointment?.patient.id).toBeTruthy();
      expect(appointment?.doctor.id).toBeTruthy();
      expect(afterUsers).toBe(beforeUsers);
    } finally {
      await moduleRef.close();
    }
  });
});
