import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppInfoController {
  @Get()
  info() {
    return {
      name: 'Filfilu HMS API',
      version: '1.0.0',
      ui: '/login.html',
      health: '/api/health',
    };
  }
}
