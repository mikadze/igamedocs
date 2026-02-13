import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth(): { status: string; timestamp: string } {
    return this.appService.getHealth();
  }

  @Get()
  getInfo(): { name: string; version: string } {
    return {
      name: 'Aviatrix Platform API',
      version: '0.0.1',
    };
  }
}
