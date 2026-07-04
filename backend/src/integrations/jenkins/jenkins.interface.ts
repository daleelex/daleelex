export interface ResolvedJenkinsConfig {
  baseUrl: string | null;
  username: string | null;
  apiToken: string | null;
  source: 'db' | 'env' | 'none';
}

export interface JenkinsRootResponse {
  mode?: string;
  nodeDescription?: string;
  nodeName?: string;
  useCrumbs?: boolean;
  useSecurity?: boolean;
  version?: string;
}

export interface UpsertJenkinsConfig {
  baseUrl: string;
  username: string;
  encryptedToken?: string | null;
}

export interface JenkinsConfigResponse {
  baseUrl: string | null;
  username: string | null;
  tokenSet: boolean;
  source: 'db' | 'env' | 'none';
}

export interface JenkinsTestResponse {
  ok: boolean;
  message: string;
  version: string | null;
}

export type JenkinsHealthStatus = 'ok' | 'auth_required' | 'unreachable' | 'not_configured';
export type JenkinsAuthMode = 'basic_auth' | 'anonymous' | 'not_configured';

export interface JenkinsHealthResponse {
  provider: 'jenkins';
  configured: boolean;
  reachable: boolean;
  authenticated: boolean;
  baseUrl: string | null;
  mode: JenkinsAuthMode;
  status: JenkinsHealthStatus;
  version: string | null;
  message: string;
  checkedAt: string;
}
