import { Controller, Get, HttpCode, HttpStatus, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TeamsService } from './teams.service';
import { TeamListResponse } from './teams.interface';
import { GlobalInterceptor } from '../global/global.interceptor';
import { LoggerInterceptor } from '../global/logger/logger.interceptor';

@ApiTags('Teams')
@Controller('teams')
@UseInterceptors(GlobalInterceptor, LoggerInterceptor)
export class TeamsController {
  public constructor(private readonly teamsService: TeamsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(): Promise<TeamListResponse> {
    return this.teamsService.findAll();
  }
}
