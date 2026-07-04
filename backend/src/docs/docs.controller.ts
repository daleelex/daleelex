import { Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DocsService } from './docs.service';
import { TechDocsIndexResponse, ServiceDocListResponse, ServiceDocResponse } from './docs.interface';
import { GlobalInterceptor } from '../global/global.interceptor';
import { LoggerInterceptor } from '../global/logger/logger.interceptor';

@ApiTags('Docs')
@Controller()
@UseInterceptors(GlobalInterceptor, LoggerInterceptor)
export class DocsController {
  public constructor(private readonly docsService: DocsService) {}

  @Get('docs')
  @HttpCode(HttpStatus.OK)
  getIndex(): Promise<TechDocsIndexResponse> {
    return this.docsService.getIndex();
  }

  @Get('services/:id/docs')
  @HttpCode(HttpStatus.OK)
  getDocsForService(@Param('id') id: string): Promise<ServiceDocListResponse> {
    return this.docsService.getDocsForService(id);
  }

  @Get('services/:id/docs/:docId')
  @HttpCode(HttpStatus.OK)
  getDoc(@Param('id') id: string, @Param('docId', ParseIntPipe) docId: number): Promise<ServiceDocResponse> {
    return this.docsService.getDoc(id, docId);
  }
}
