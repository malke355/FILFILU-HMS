import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { JwtPayload } from './jwt-payload';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() body: LoginDto) {
    return this.auth.login(body);
  }

  @Post('signup')
  @HttpCode(201)
  signup(@Body() body: SignupDto) {
    return this.auth.signup(body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() request: { user: JwtPayload }) {
    return this.auth.me(request.user.sub);
  }

  @Get('demo-accounts')
  demoAccounts() {
    return this.auth.demoAccounts();
  }
}
