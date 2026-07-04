import { Controller, Get, Put, Post, Body, HttpCode, HttpStatus, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JenkinsService } from './jenkins.service';
import { JenkinsConfigDto } from './jenkins.dto';
import { JenkinsHealthResponse, JenkinsConfigResponse, JenkinsTestResponse } from './jenkins.interface';
import { GlobalInterceptor } from '../../global/global.interceptor';
import { LoggerInterceptor } from '../../global/logger/logger.interceptor';

@ApiTags('Integrations')
@Controller('integrations/jenkins')
@UseInterceptors(GlobalInterceptor, LoggerInterceptor)
export class JenkinsController {
  public constructor(private readonly jenkinsService: JenkinsService) {}

  @Get('health')
  @HttpCode(HttpStatus.OK)
  checkHealth(): Promise<JenkinsHealthResponse> {
    return this.jenkinsService.checkHealth();
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  getConfig(): Promise<JenkinsConfigResponse> {
    return this.jenkinsService.getConfig();
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  async saveConfig(@Body() dto: JenkinsConfigDto): Promise<JenkinsConfigResponse> {
    await this.jenkinsService.saveConfig(dto);
    return this.jenkinsService.getConfig();
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  testConnection(@Body() dto: JenkinsConfigDto): Promise<JenkinsTestResponse> {
    return this.jenkinsService.testConnection(dto);
  }
}
