import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkforceController } from './workforce.controller';
import { WorkforceService } from './workforce.service';

@Module({
  imports: [AuthModule],
  controllers: [WorkforceController],
  providers: [WorkforceService],
})
export class WorkforceModule {}