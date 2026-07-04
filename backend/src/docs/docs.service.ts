import { Injectable, NotFoundException } from '@nestjs/common';
import { DocsRepository } from './docs.repository';
import { ServiceType, ServiceTier } from '../common/enums/catalog.enums';
import { TechDocsIndexResponse, ServiceDocListResponse, ServiceDocResponse } from './docs.interface';

@Injectable()
export class DocsService {
  public constructor(private readonly docsRepository: DocsRepository) {}

  public async getIndex(): Promise<TechDocsIndexResponse> {
    const services = await this.docsRepository.findServicesWithDocs();
    return {
      data: services.map((service) => ({
        service: {
          id: service.id,
          name: service.name,
          type: service.type as ServiceType,
          tier: service.tier as ServiceTier,
        },
        docs: service.docs,
      })),
    };
  }

  public async getDocsForService(serviceId: string): Promise<ServiceDocListResponse> {
    const docs = await this.docsRepository.findDocsByServiceId(serviceId);

    if (docs.length === 0) {
      const exists = await this.docsRepository.serviceExists(serviceId);
      if (!exists) {
        throw new NotFoundException(`Service "${serviceId}" not found.`);
      }
    }

    return { data: docs };
  }

  public async getDoc(serviceId: string, docId: number): Promise<ServiceDocResponse> {
    const doc = await this.docsRepository.findDocByIdAndServiceId(docId, serviceId);

    if (!doc) {
      throw new NotFoundException('Doc not found.');
    }

    return {
      id: doc.id,
      path: doc.path,
      title: doc.title,
      contentMd: doc.contentMd,
      fetchedAt: doc.fetchedAt.toISOString(),
    };
  }
}
