import { Injectable } from '@nestjs/common';
import { PrismaService } from '../lib/prisma/prisma.service';

@Injectable()
export class TeamsRepository {
  public constructor(private readonly prismaService: PrismaService) {}

  public findAllWithActiveServices() {
    return this.prismaService.team.findMany({
      include: {
        services: {
          where: { deletedAt: null },
          select: { id: true, name: true, type: true, tier: true },
          orderBy: [{ tier: 'asc' }, { name: 'asc' }],
        },
      },
      orderBy: { name: 'asc' },
    });
  }
}
