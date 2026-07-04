import { Injectable } from '@nestjs/common';
import { IntegrationConfig } from '../../lib/prisma/generated/client';
import { PrismaService } from '../../lib/prisma/prisma.service';
import { Logger } from '../../global/logger/logger';
import { UpsertJenkinsConfig } from './jenkins.interface';

@Injectable()
export class JenkinsRepository {
  private static readonly PROVIDER = 'jenkins';

  public constructor(
    private readonly prismaService: PrismaService,
    private readonly logger: Logger,
  ) {}

  /**
   * @function findConfig - Returns the stored Jenkins config, or null when absent.
   * DB errors propagate so the service can fall back to env config.
   */
  public findConfig(): Promise<IntegrationConfig | null> {
    return this.prismaService.integrationConfig.findUnique({
      where: { provider: JenkinsRepository.PROVIDER },
    });
  }

  /**
   * @function upsertConfig - Creates or updates the Jenkins integration config.
   * @param {UpsertJenkinsConfig} data
   */
  public async upsertConfig(data: UpsertJenkinsConfig): Promise<void> {
    try {
      await this.prismaService.integrationConfig.upsert({
        where: { provider: JenkinsRepository.PROVIDER },
        create: {
          provider: JenkinsRepository.PROVIDER,
          baseUrl: data.baseUrl,
          username: data.username,
          encryptedToken: data.encryptedToken ?? null,
        },
        update: {
          baseUrl: data.baseUrl,
          username: data.username,
          ...(data.encryptedToken !== undefined ? { encryptedToken: data.encryptedToken } : {}),
        },
      });
    } catch (err: any) {
      this.logger.error('Failed to upsert Jenkins config', { repository: 'JenkinsRepository' }, { err });
      throw err;
    }
  }
}
