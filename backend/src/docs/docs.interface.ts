import { ServiceType, ServiceTier } from '../common/enums/catalog.enums';

export interface DocSummary {
  id: number;
  path: string;
  title: string;
}

export interface ServiceDocGroup {
  service: { id: string; name: string; type: ServiceType; tier: ServiceTier };
  docs: DocSummary[];
}

export interface TechDocsIndexResponse {
  data: ServiceDocGroup[];
}

export interface ServiceDocListResponse {
  data: DocSummary[];
}

export interface ServiceDocResponse {
  id: number;
  path: string;
  title: string;
  contentMd: string;
  fetchedAt: string;
}
