import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { HealthStatus } from './health.types';

@Injectable()
export class HealthService {
  public constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  public async getHealth(): Promise<HealthStatus> {
    const version = this.configService.get<string>('app.version') ?? '0.0.0';

    try {
      await this.prismaService.checkDatabaseConnection();
      return { status: 'up', version, dateTime: new Date().toISOString() };
    } catch {
      return { status: 'down', version, dateTime: new Date().toISOString() };
    }
  }
}
