export type ServiceType = 'api' | 'db' | 'web' | 'ml' | 'tool';
export type ServiceTier = 1 | 2 | 3;
export type ServiceLifecycle = 'production' | 'beta' | 'deprecated';
export type LinkType = 'runbook' | 'dashboard' | 'docs' | 'other';

export interface ServiceOwner {
  id: string;
  name: string;
  slackChannel: string | null;
  onCallSchedule: string | null;
}

export interface ServiceLink {
  id: number;
  url: string;
  title: string | null;
  type: LinkType;
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  type: ServiceType;
  tier: ServiceTier;
  lifecycle: ServiceLifecycle;
  ownerTeamId: string | null;
  owner: ServiceOwner | null;
  language: string | null;
  repository: string | null;
  sloTarget: string | null;
  sloWindow: string | null;
  tags: string[];
  links: ServiceLink[];
  createdAt: string;
  updatedAt: string;
}

export interface ServiceListResponse {
  data: Service[];
  total: number;
}

export interface CreateServiceRequest {
  id: string;
  name: string;
  type: ServiceType;
  tier: ServiceTier;
  lifecycle: ServiceLifecycle;
  ownerTeamId?: string;
  description?: string;
  language?: string;
  repository?: string;
}

export interface TeamServiceSummary {
  id: string;
  name: string;
  type: ServiceType;
  tier: ServiceTier;
}

export interface TeamWithStats {
  id: string;
  name: string;
  slackChannel: string | null;
  onCallSchedule: string | null;
  serviceCount: number;
  tier1Count: number;
  tier2Count: number;
  tier3Count: number;
  topServices: TeamServiceSummary[];
}

export interface TeamListResponse {
  data: TeamWithStats[];
  total: number;
}

export interface ServiceDocSummary {
  id: number;
  path: string;
  title: string;
}

export interface ServiceDocListResponse {
  data: ServiceDocSummary[];
}

export interface ServiceDocContent {
  id: number;
  path: string;
  title: string;
  contentMd: string;
  fetchedAt: string;
}

export interface TechDocsIndexResponse {
  data: Array<{
    service: { id: string; name: string; type: ServiceType; tier: ServiceTier };
    docs: ServiceDocSummary[];
  }>;
}

export interface TechDocsIndexEntry {
  service: { id: string; name: string; type: ServiceType; tier: ServiceTier };
  docs: ServiceDocSummary[];
}

export interface TechDocsIndexResponse {
  data: TechDocsIndexEntry[];
}