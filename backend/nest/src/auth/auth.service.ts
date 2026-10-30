import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import type { LoginDto } from './dto/login.dto';
import type { SignupDto } from './dto/signup.dto';
import type { JwtPayload } from './jwt-payload';
import { permissionsFor } from './permissions';
import { PrismaService } from '../prisma/prisma.service';

const BCRYPT_COST = 10;

type Account = {
  id: string;
  email: string;
  name: string;
  role: string;
  title: string | null;
  staffId: string | null;
  patientId: string | null;
  ward: string | null;
  dept: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(body: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user) {
      throw new UnauthorizedException({ error: 'Invalid email or password.' });
    }

    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({ error: 'Invalid email or password.' });
    }

    if (body.role && body.role !== user.role) {
      throw new ForbiddenException({
        error: `This account is assigned the ${user.role} role. Choose “${user.role}” or use another account.`,
      });
    }

    const token = this.sign(user);
    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'auth.login',
        entity: 'User',
        metaJson: JSON.stringify({ role: user.role }),
      },
    });

    return { token, user: publicUser(user) };
  }

  async signup(body: SignupDto) {
    const email = body.email.toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new ConflictException({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(body.password, BCRYPT_COST);
    const name = `${body.first} ${body.last}`.trim();
    const template = await this.prisma.user.findFirst({ where: { role: body.role } });

    let staffId: string | null = null;
    let patientId: string | null = null;
    const ward = template?.ward ?? null;
    const dept = template?.dept ?? (body.role === 'doctor' ? 'General Medicine' : null);

    if (body.role === 'patient') {
      const patient = await this.prisma.patient.create({
        data: {
          name,
          age: 30,
          condition: 'New patient registration',
          doctorId: 's-doc-1',
        },
      });
      patientId = patient.id;
    } else {
      const staff = await this.prisma.staff.create({
        data: {
          name,
          role: body.role,
          dept: dept || 'Administration',
          ward,
          status: 'active',
        },
      });
      staffId = staff.id;
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: body.role,
        title: body.role === 'patient' ? 'Patient' : body.role,
        staffId,
        patientId,
        ward,
        dept,
      },
    });

    const token = this.sign(user);
    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'auth.signup',
        entity: 'User',
        metaJson: JSON.stringify({ role: user.role }),
      },
    });

    return { token, user: publicUser(user) };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({ error: 'User not found.' });
    }
    return { user: publicUser(user) };
  }

  demoAccounts() {
    return {
      password: 'filfilu',
      accounts: [
        { email: 'admin@filfilu.com', role: 'admin', name: 'Selam Bekele' },
        { email: 'doctor@filfilu.com', role: 'doctor', name: 'Dr. Helen Tesfaye' },
        { email: 'nurse@filfilu.com', role: 'nurse', name: 'Rahel Abebe' },
        { email: 'patient@filfilu.com', role: 'patient', name: 'Amina Mohammed' },
      ],
    };
  }

  private sign(user: Account): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as JwtPayload['role'],
      name: user.name,
      staffId: user.staffId,
      patientId: user.patientId,
      ward: user.ward,
      dept: user.dept,
      title: user.title,
    };
    return this.jwt.sign(payload);
  }
}

function publicUser(user: Account) {
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    title: user.title,
    staffId: user.staffId,
    patientId: user.patientId,
    ward: user.ward,
    dept: user.dept,
    permissions: permissionsFor(user.role),
  };
}
