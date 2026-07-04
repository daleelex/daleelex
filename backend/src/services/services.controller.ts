import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './services.dto';
import { ServiceResponse, ServiceListResponse } from './services.interface';
import { AdminGuard } from '../global/guards/admin.guard';
import { GlobalInterceptor } from '../global/global.interceptor';
import { LoggerInterceptor } from '../global/logger/logger.interceptor';

@ApiTags('Services')
@Controller('services')
@UseInterceptors(GlobalInterceptor, LoggerInterceptor)
export class ServicesController {
  public constructor(private readonly servicesService: ServicesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(): Promise<ServiceListResponse> {
    return this.servicesService.findAll();
  }

  @Post()
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateServiceDto): Promise<ServiceResponse> {
    return this.servicesService.create(dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string): Promise<void> {
    return this.servicesService.delete(id);
  }
}
