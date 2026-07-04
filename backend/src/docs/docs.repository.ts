import { Injectable } from '@nestjs/common';
import { PrismaService } from '../lib/prisma/prisma.service';

@Injectable()
export class DocsRepository {
  public constructor(private readonly prismaService: PrismaService) {}

  public findServicesWithDocs() {
    return this.prismaService.service.findMany({
      where: { deletedAt: null, docs: { some: {} } },
      select: {
        id: true,
        name: true,
        type: true,
        tier: true,
        docs: { select: { id: true, path: true, title: true }, orderBy: { path: 'asc' } },
      },
      orderBy: [{ tier: 'asc' }, { name: 'asc' }],
    });
  }

  public findDocsByServiceId(serviceId: string) {
    return this.prismaService.serviceDoc.findMany({
      where: { serviceId },
      select: { id: true, path: true, title: true },
      orderBy: { path: 'asc' },
    });
  }

  public serviceExists(serviceId: string): Promise<number> {
    return this.prismaService.service.count({ where: { id: serviceId, deletedAt: null } });
  }

  public findDocByIdAndServiceId(docId: number, serviceId: string) {
    return this.prismaService.serviceDoc.findFirst({ where: { id: docId, serviceId } });
  }
}
