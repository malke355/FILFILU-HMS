import { Body, Controller, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-payload';
import { CreateExchangeDto } from './dto/create-exchange.dto';
import { UpdateExchangeDto } from './dto/update-exchange.dto';
import { WorkforceService } from './workforce.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class WorkforceController {
  constructor(private readonly workforce: WorkforceService) {}

  @Get('staff')
  staff(@Req() request: { user: JwtPayload }) {
    return this.workforce.staff(request.user);
  }

  @Get('shifts')
  shifts(@Req() request: { user: JwtPayload }) {
    return this.workforce.shifts(request.user);
  }

  @Post('shifts/publish-drafts')
  @HttpCode(200)
  publishDrafts(@Req() request: { user: JwtPayload }) {
    return this.workforce.publishDrafts(request.user);
  }

  @Patch('shifts/:id/publish')
  publishShift(@Req() request: { user: JwtPayload }, @Param('id') id: string) {
    return this.workforce.publishShift(request.user, id);
  }

  @Get('exchanges')
  exchanges(@Req() request: { user: JwtPayload }) {
    return this.workforce.exchanges(request.user);
  }

  @Post('exchanges/approve-pending')
  @HttpCode(200)
  approvePending(@Req() request: { user: JwtPayload }) {
    return this.workforce.approvePending(request.user);
  }

  @Post('exchanges')
  @HttpCode(201)
  createExchange(@Req() request: { user: JwtPayload }, @Body() body: CreateExchangeDto) {
    return this.workforce.createExchange(request.user, body);
  }

  @Patch('exchanges/:id')
  updateExchange(
    @Req() request: { user: JwtPayload },
    @Param('id') id: string,
    @Body() body: UpdateExchangeDto,
  ) {
    return this.workforce.updateExchange(request.user, id, body);
  }
}
