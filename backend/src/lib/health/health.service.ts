import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface HealthStatus {
  status: 'up' | 'down';
  dateTime: string;
}

@Injectable()
export class HealthService {
  public constructor(private readonly prismaService: PrismaService) {}

  async getHealth(): Promise<HealthStatus> {
    try {
      await this.prismaService.checkDatabaseConnection();
      return { status: 'up', dateTime: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException({
        status: 'down',
        dateTime: new Date().toISOString(),
      });
    }
  }
}
