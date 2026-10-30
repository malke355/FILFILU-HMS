import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { BookingDto } from './dto/booking.dto';
import { ContactDto } from './dto/contact.dto';
import { IntakeService } from './intake.service';

@Controller()
export class IntakeController {
  constructor(private readonly intake: IntakeService) {}

  @Post('contact')
  @HttpCode(201)
  contact(@Body() body: ContactDto) {
    return this.intake.contact(body);
  }

  @Post('bookings')
  @HttpCode(201)
  booking(@Body() body: BookingDto) {
    return this.intake.booking(body);
  }
}
