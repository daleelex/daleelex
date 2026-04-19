export type ServiceType = 'api' | 'db' | 'web' | 'ml' | 'tool';
export type ServiceLifecycle = 'production' | 'beta' | 'deprecated';
export type ServiceTier = 1 | 2 | 3;

export interface Team {
  id: string;
  name: string;
  slackChannel: string | null;
  onCallSchedule: string | null;
}

export interface ServiceLink {
  id: number;
  url: string;
  title: string | null;
  type: 'runbook' | 'dashboard' | 'docs' | 'other';
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  type: ServiceType;
  tier: ServiceTier;
  lifecycle: ServiceLifecycle;
  ownerTeamId: string | null;
  owner: Team | null;
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

export interface ServiceDocSummary {
  id: number;
  path: string;
  title: string;
}

export interface ServiceDoc extends ServiceDocSummary {
  contentMd: string;
  fetchedAt: string;
}

export interface ServiceDocListResponse {
  data: ServiceDocSummary[];
}

export interface TeamWithStats extends Team {
  serviceCount: number;
  tier1Count: number;
  tier2Count: number;
  tier3Count: number;
  topServices: { id: string; name: string; type: ServiceType; tier: ServiceTier }[];
}

export interface TeamListResponse {
  data: TeamWithStats[];
  total: number;
}

export interface HealthResponse {
  status: 'ok';
  version: string;
}
