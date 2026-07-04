import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client';
import { Logger } from '../../global/logger/logger';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private initialized = false;

  public constructor(@Inject(Logger) private readonly logger: Logger) {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
    });
    super({ adapter });
  }

  async onModuleInit() {
    if (this.initialized) return;
    this.initialized = true;
    try {
      await this.$connect();
      await this.$queryRaw`SELECT 1`;
    } catch (e) {
      this.initialized = false;
      throw e;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async checkDatabaseConnection(): Promise<void> {
    try {
      await this.$queryRaw`SELECT 1`;
    } catch (e: any) {
      this.logger.error('Failed to connect to Database', { system: 'database' }, { err: e });
      throw e;
    }
  }
}
