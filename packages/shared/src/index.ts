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

export interface TechDocsIndexEntry {
  service: { id: string; name: string; type: ServiceType; tier: ServiceTier };
  docs: ServiceDocSummary[];
}

export interface TechDocsIndexResponse {
  data: TechDocsIndexEntry[];
}

export interface TeamWithStats extends Team {
  serviceCount: number;
  tier1Count: number;
  tier2Count: number;
  tier3Count: number;
  averageScorecardHealth: number | null;
  scoredServiceCount: number;
  openOwnershipGaps: {
    serviceId: string;
    serviceName: string;
    message: string | null;
  }[];
  services: {
    id: string;
    name: string;
    type: ServiceType;
    tier: ServiceTier;
    scorecardHealth: number | null;
    hasOwnershipGap: boolean;
  }[];
}

export interface TeamListResponse {
  data: TeamWithStats[];
  total: number;
  unownedServiceCount: number;
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

export interface HealthResponse {
  status: 'ok';
  version: string;
}

export interface MeResponse {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface JenkinsHealthResponse {
  provider: 'jenkins';
  configured: boolean;
  reachable: boolean;
  authenticated: boolean;
  baseUrl: string | null;
  mode: 'anonymous' | 'basic_auth' | 'not_configured';
  status: 'ok' | 'auth_required' | 'unreachable' | 'not_configured';
  version: string | null;
  message: string;
  checkedAt: string;
}

export interface JenkinsConfigResponse {
  baseUrl: string | null;
  username: string | null;
  tokenSet: boolean;
  source: 'db' | 'env' | 'none';
}

export interface JenkinsConfigRequest {
  baseUrl: string;
  username?: string;
  token?: string;
}

export interface JenkinsTestResponse {
  ok: boolean;
  message: string;
  version: string | null;
}
