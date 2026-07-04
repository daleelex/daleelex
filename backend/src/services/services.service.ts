import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ServicesRepository } from './services.repository';
import { CreateServiceDto } from './services.dto';
import { Prisma } from '../lib/prisma/generated/client';
import { ServiceType, ServiceTier, ServiceLifecycle, LinkType } from '../common/enums/catalog.enums';
import { ServiceResponse, ServiceListResponse, ServiceWithRelations } from './services.interface';

const PRISMA_UNIQUE_VIOLATION = 'P2002';
const PRISMA_FK_VIOLATION = 'P2003';

@Injectable()
export class ServicesService {
  public constructor(private readonly servicesRepository: ServicesRepository) {}

  public async create(dto: CreateServiceDto): Promise<ServiceResponse> {
    try {
      const row = await this.servicesRepository.create(dto);
      return this.toResponse(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === PRISMA_UNIQUE_VIOLATION) {
          throw new ConflictException(`A service with ID "${dto.id}" already exists.`);
        }
        if (err.code === PRISMA_FK_VIOLATION) {
          throw new UnprocessableEntityException(`Team "${dto.ownerTeamId}" does not exist.`);
        }
      }
      throw err;
    }
  }

  public async delete(id: string): Promise<void> {
    const existing = await this.servicesRepository.findActiveById(id);
    if (!existing) {
      throw new NotFoundException(`Service "${id}" not found.`);
    }
    await this.servicesRepository.softDelete(id);
  }

  public async findAll(): Promise<ServiceListResponse> {
    const rows = await this.servicesRepository.findAllActive();
    const data = rows.map((row) => this.toResponse(row));
    return { data, total: data.length };
  }

  private toResponse(row: ServiceWithRelations): ServiceResponse {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.type as ServiceType,
      tier: row.tier as ServiceTier,
      lifecycle: row.lifecycle as ServiceLifecycle,
      ownerTeamId: row.ownerTeamId,
      owner: row.owner
        ? {
            id: row.owner.id,
            name: row.owner.name,
            slackChannel: row.owner.slackChannel,
            onCallSchedule: row.owner.onCallSchedule,
          }
        : null,
      language: row.language,
      repository: row.repository,
      sloTarget: row.sloTarget,
      sloWindow: row.sloWindow,
      tags: row.tags,
      links: (row.links ?? []).map((link) => ({
        id: link.id,
        url: link.url,
        title: link.title,
        type: link.type as LinkType,
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
