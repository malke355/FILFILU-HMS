import { Injectable } from '@nestjs/common';
import type { BookingDto } from './dto/booking.dto';
import type { ContactDto } from './dto/contact.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IntakeService {
  constructor(private readonly prisma: PrismaService) {}

  async contact(body: ContactDto) {
    const row = await this.prisma.contactMessage.create({
      data: {
        name: body.name,
        email: body.email,
        topic: body.topic,
        message: body.message,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        action: 'contact.create',
        entity: row.id,
        metaJson: JSON.stringify({ email: body.email, topic: body.topic }),
      },
    });
    return {
      data: { id: row.id },
      message: `Thanks, ${body.name}. Your message was recorded.`,
    };
  }

  async booking(body: BookingDto) {
    const row = await this.prisma.bookingRequest.create({
      data: {
        name: body.name,
        department: body.department,
        date: body.date,
        status: 'requested',
      },
    });
    await this.prisma.auditLog.create({
      data: {
        action: 'booking.create',
        entity: row.id,
        metaJson: JSON.stringify({
          name: body.name,
          department: body.department,
          date: body.date,
        }),
      },
    });
    return {
      data: { id: row.id, status: row.status },
      message: `${body.name}, your ${body.department} visit is requested for ${body.date}.`,
    };
  }
}
