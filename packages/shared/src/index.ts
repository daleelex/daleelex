export type ServiceType = 'api' | 'db' | 'web' | 'ml' | 'tool';
export type ServiceLifecycle = 'production' | 'beta' | 'deprecated';
export type ServiceTier = 1 | 2 | 3;
export type ManagementSource = 'portal' | 'repository';

export interface Team {
  id: string;
  name: string;
  slackChannel: string | null;
  onCallSchedule: string | null;
  managementSource: ManagementSource;
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
  /** Upstream service ids this service declares in its catalog-info.yaml. */
  dependencies: string[];
  createdAt: string;
  updatedAt: string;
  managementSource: ManagementSource;
}

export interface ServiceListResponse {
  data: Service[];
  total: number;
}

export type ScorecardStatus = 'pass' | 'fail' | 'skip';
export type ScorecardCategory = 'basics' | 'observability' | 'security' | 'reliability';

export interface ScorecardCheckResult {
  checkId: string;
  label: string;
  category: ScorecardCategory;
  weight: number;
  status: ScorecardStatus;
  message: string | null;
  /** When this outcome was first recorded; unchanged results are not rewritten. */
  since: string;
}

export interface ServiceScorecardResponse {
  serviceId: string;
  /** Weighted share of applicable checks passing, 0-100. Null when none apply or none have run. */
  score: number | null;
  results: ScorecardCheckResult[];
}

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

export interface ServiceLogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  labels: Record<string, string>;
}

export interface ServiceLogListResponse {
  data: ServiceLogEntry[];
  next_cursor: string | null;
}

export interface ServiceDocSummary {
  id: number;
  path: string;
  title: string;
}

export interface ServiceDoc extends ServiceDocSummary {
  contentMd: string;
  sourceRepository: string | null;
  sourceSha: string | null;
  uploadedByUserId: string | null;
  updatedByUserId: string | null;
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

export interface UploadServiceDocRequest {
  filename: string;
  contentMd: string;
  overwrite: boolean;
}

export interface UploadServiceDocResponse {
  data: ServiceDoc;
  operation: 'created' | 'updated';
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

export interface CreateTeamRequest {
  id: string;
  name: string;
  slackChannel?: string | null;
  onCallSchedule?: string | null;
}

export interface UpdateServiceRequest {
  name: string;
  type: ServiceType;
  tier: ServiceTier;
  lifecycle: ServiceLifecycle;
  ownerTeamId: string | null;
  description: string | null;
  language: string | null;
  repository: string | null;
  sloTarget: string | null;
  sloWindow: string | null;
  tags: string[];
}

export interface UpdateTeamRequest {
  name: string;
  slackChannel: string | null;
  onCallSchedule: string | null;
}

export interface UpdateServiceDocRequest {
  filename: string;
  contentMd: string;
  /** fetchedAt of the revision the client loaded; a mismatch means someone
   * else saved in between and the edit is rejected with document_modified. */
  baseFetchedAt: string;
}

export interface HealthResponse {
  status: 'ok';
  version: string;
}

export interface StatsResponse {
  teamCount: number;
  serviceCount: number;
  docCount: number;
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
