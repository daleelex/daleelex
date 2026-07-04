import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { HealthService } from './health.service';
import { HealthStatus } from './health.types';
import { GlobalInterceptor } from '../../global/global.interceptor';

@ApiTags('Health')
@Controller('health')
// @UseGuards(RoleGuard)
@UseInterceptors(GlobalInterceptor)
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async getHealth(): Promise<HealthStatus> {
    return this.healthService.getHealth();
  }
}
