import { Module } from '@nestjs/common';
import { DocsController } from './docs.controller';
import { DocsService } from './docs.service';
import { DocsRepository } from './docs.repository';

@Module({
  controllers: [DocsController],
  providers: [DocsService, DocsRepository],
})
export class DocsModule {}
