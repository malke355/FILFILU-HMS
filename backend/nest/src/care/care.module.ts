import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AppointmentCreateGuard } from './appointment-create.guard';
import { CareController } from './care.controller';
import { CareService } from './care.service';

@Module({
  imports: [AuthModule],
  controllers: [CareController],
  providers: [CareService, AppointmentCreateGuard],
})
export class CareModule {}