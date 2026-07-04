import { Injectable } from '@nestjs/common';
import { PrismaService } from '../lib/prisma/prisma.service';
import { CreateServiceDto } from './services.dto';
import { ServiceWithRelations } from './services.interface';

@Injectable()
export class ServicesRepository {
  public constructor(private readonly prismaService: PrismaService) {}

  public create(dto: CreateServiceDto): Promise<ServiceWithRelations> {
    return this.prismaService.service.create({
      data: {
        id: dto.id,
        name: dto.name,
        type: dto.type,
        tier: dto.tier,
        lifecycle: dto.lifecycle,
        ownerTeamId: dto.ownerTeamId || null,
        description: dto.description || null,
        language: dto.language || null,
        repository: dto.repository || null,
        tags: [],
      },
      include: { owner: true, links: true },
    });
  }

  public findActiveById(id: string): Promise<{ id: string } | null> {
    return this.prismaService.service.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
  }

  public softDelete(id: string): Promise<void> {
    return this.prismaService.service.update({ where: { id }, data: { deletedAt: new Date() } }).then(() => undefined);
  }

  public findAllActive(): Promise<ServiceWithRelations[]> {
    return this.prismaService.service.findMany({
      where: { deletedAt: null },
      include: { owner: true, links: true },
      orderBy: [{ tier: 'asc' }, { name: 'asc' }],
    });
  }
}
