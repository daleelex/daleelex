import type { JenkinsHealthResponse } from '@daleelex/shared';

interface JenkinsConfig {
  baseUrl: string | null;
  username: string | null;
  apiToken: string | null;
}

interface JenkinsRootResponse {
  mode?: string;
  nodeDescription?: string;
  nodeName?: string;
  useCrumbs?: boolean;
  useSecurity?: boolean;
  version?: string;
}

const REQUEST_TIMEOUT_MS = 5000;

export async function checkJenkinsHealth(): Promise<JenkinsHealthResponse> {
  const config = readJenkinsConfig();
  const checkedAt = new Date().toISOString();

  if (!config.baseUrl) {
    return {
      provider: 'jenkins',
      configured: false,
      reachable: false,
      authenticated: false,
      baseUrl: null,
      mode: 'not_configured',
      status: 'not_configured',
      version: null,
      message: 'Set JENKINS_BASE_URL to enable the Jenkins integration.',
      checkedAt,
    };
  }

  const authHeader = buildAuthHeader(config);
  const url = new URL('/api/json', config.baseUrl);

  try {
    const response = await fetchWithTimeout(url, {
      headers: authHeader ? { Authorization: authHeader } : undefined,
    });

    const version = response.headers.get('x-jenkins') ?? null;

    if (response.status === 401 || response.status === 403) {
      return {
        provider: 'jenkins',
        configured: true,
        reachable: true,
        authenticated: false,
        baseUrl: config.baseUrl,
        mode: authHeader ? 'basic_auth' : 'anonymous',
        status: 'auth_required',
        version,
        message: authHeader
          ? 'Jenkins rejected the configured username or API token.'
          : 'Jenkins is reachable but requires credentials.',
        checkedAt,
      };
    }

    if (!response.ok) {
      return {
        provider: 'jenkins',
        configured: true,
        reachable: false,
        authenticated: false,
        baseUrl: config.baseUrl,
        mode: authHeader ? 'basic_auth' : 'anonymous',
        status: 'unreachable',
        version,
        message: `Jenkins returned HTTP ${response.status}.`,
        checkedAt,
      };
    }

    const body = (await response.json()) as JenkinsRootResponse;

    return {
      provider: 'jenkins',
      configured: true,
      reachable: true,
      authenticated: Boolean(authHeader) || body.useSecurity === false,
      baseUrl: config.baseUrl,
      mode: authHeader ? 'basic_auth' : 'anonymous',
      status: 'ok',
      version: version ?? body.version ?? null,
      message: 'Jenkins is reachable.',
      checkedAt,
    };
  } catch (error) {
    return {
      provider: 'jenkins',
      configured: true,
      reachable: false,
      authenticated: false,
      baseUrl: config.baseUrl,
      mode: authHeader ? 'basic_auth' : 'anonymous',
      status: 'unreachable',
      version: null,
      message: error instanceof Error ? error.message : 'Jenkins health check failed.',
      checkedAt,
    };
  }
}

function readJenkinsConfig(): JenkinsConfig {
  return {
    baseUrl: normalizeBaseUrl(process.env.JENKINS_BASE_URL),
    username: normalizeOptionalEnv(process.env.JENKINS_USERNAME),
    apiToken: normalizeOptionalEnv(process.env.JENKINS_API_TOKEN),
  };
}

function normalizeBaseUrl(value: string | undefined) {
  const trimmed = normalizeOptionalEnv(value);
  return trimmed ? trimmed.replace(/\/+$/, '') : null;
}

function normalizeOptionalEnv(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function buildAuthHeader(config: JenkinsConfig) {
  if (!config.username || !config.apiToken) {
    return null;
  }

  return `Basic ${Buffer.from(`${config.username}:${config.apiToken}`).toString('base64')}`;
}

async function fetchWithTimeout(url: URL, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
