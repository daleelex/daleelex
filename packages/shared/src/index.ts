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

export interface HealthResponse {
  status: 'ok';
  version: string;
}
