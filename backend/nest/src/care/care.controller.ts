import { Body, Controller, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-payload';
import { AppointmentCreateGuard } from './appointment-create.guard';
import { CareService } from './care.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class CareController {
  constructor(private readonly care: CareService) {}

  @Get('patients')
  patients(@Req() request: { user: JwtPayload }) {
    return this.care.patients(request.user);
  }

  @Get('appointments')
  appointments(@Req() request: { user: JwtPayload }) {
    return this.care.appointments(request.user);
  }

  @Post('appointments')
  @HttpCode(201)
  @UseGuards(AppointmentCreateGuard)
  createAppointment(@Req() request: { user: JwtPayload }, @Body() body: CreateAppointmentDto) {
    return this.care.createAppointment(request.user, body);
  }

  @Patch('appointments/:id')
  updateAppointment(
    @Req() request: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: UpdateAppointmentDto,
  ) {
    return this.care.updateAppointment(request.user, id, body);
  }
}
