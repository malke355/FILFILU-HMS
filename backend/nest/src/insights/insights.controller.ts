import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-payload';
import { InsightsService } from './insights.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get('activity')
  activity(@Req() request: { user: JwtPayload }) {
    return this.insights.activity(request.user);
  }

  @Get('notifications')
  notifications(@Req() request: { user: JwtPayload }) {
    return this.insights.notifications(request.user);
  }

  @Get('reports/summary')
  reportSummary(@Req() request: { user: JwtPayload }) {
    return this.insights.reportSummary(request.user);
  }

  @Get('dashboard/stats')
  dashboard(@Req() request: { user: JwtPayload }) {
    return this.insights.dashboard(request.user);
  }
}
