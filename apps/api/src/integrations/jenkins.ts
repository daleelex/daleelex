import type { JenkinsHealthResponse, JenkinsConfigResponse, JenkinsTestResponse } from '@daleelex/shared';
import { prisma } from '../db.js';
import { encrypt, decrypt } from '../crypto.js';

interface ResolvedConfig {
  baseUrl: string | null;
  username: string | null;
  apiToken: string | null;
  source: 'db' | 'env' | 'none';
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

export class JenkinsConfigError extends Error {
  statusCode = 400;
}

export async function getJenkinsConfig(): Promise<JenkinsConfigResponse> {
  const resolved = await resolveConfig();
  return {
    baseUrl: resolved.baseUrl,
    username: resolved.username,
    tokenSet: Boolean(resolved.apiToken),
    source: resolved.source,
  };
}

export async function saveJenkinsConfig(
  baseUrl: string,
  username: string | undefined,
  token: string | undefined,
): Promise<void> {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const normalizedUsername = normalizeOptional(username);

  if (!normalizedBaseUrl) {
    throw new JenkinsConfigError('Valid Jenkins URL is required.');
  }

  if (!normalizedUsername) {
    throw new JenkinsConfigError('Username is required for saved Jenkins connections.');
  }

  const existing = await prisma.integrationConfig.findUnique({ where: { provider: 'jenkins' } });
  const envToken = normalizeOptional(process.env.JENKINS_API_TOKEN);
  const tokenToEncrypt = normalizeOptional(token) ?? (!existing?.encryptedToken ? envToken : null);

  if (!existing?.encryptedToken && !tokenToEncrypt) {
    throw new JenkinsConfigError('API token is required for the first saved Jenkins connection.');
  }

  const encryptedToken = tokenToEncrypt ? encrypt(tokenToEncrypt) : undefined;

  await prisma.integrationConfig.upsert({
    where: { provider: 'jenkins' },
    create: {
      provider: 'jenkins',
      baseUrl: normalizedBaseUrl,
      username: normalizedUsername,
      encryptedToken: encryptedToken ?? null,
    },
    update: {
      baseUrl: normalizedBaseUrl,
      username: normalizedUsername,
      ...(encryptedToken !== undefined ? { encryptedToken } : {}),
    },
  });
}

export async function testJenkinsConnection(
  baseUrl: string,
  username?: string,
  token?: string,
): Promise<JenkinsTestResponse> {
  const url = buildApiUrl(normalizeBaseUrl(baseUrl));
  if (!url) return { ok: false, message: 'Invalid URL.', version: null };

  const authHeader = buildAuthHeader(username ?? null, token ?? null);

  try {
    const response = await fetchWithTimeout(url, {
      headers: authHeader ? { Authorization: authHeader } : undefined,
    });

    const version = response.headers.get('x-jenkins') ?? null;

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        message: authHeader
          ? 'Jenkins rejected the credentials. Check your username and API token.'
          : 'Jenkins requires credentials.',
        version,
      };
    }

    if (!response.ok) {
      return { ok: false, message: `Jenkins returned HTTP ${response.status}.`, version };
    }

    const body = (await response.json()) as JenkinsRootResponse;
    return {
      ok: true,
      message: 'Connection successful.',
      version: version ?? body.version ?? null,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Connection failed.',
      version: null,
    };
  }
}

export async function checkJenkinsHealth(): Promise<JenkinsHealthResponse> {
  const config = await resolveConfig();
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
      message: 'Jenkins is not configured. Add a connection in Settings.',
      checkedAt,
    };
  }

  const authHeader = buildAuthHeader(config.username, config.apiToken);
  const url = buildApiUrl(config.baseUrl);

  if (!url) {
    return {
      provider: 'jenkins',
      configured: true,
      reachable: false,
      authenticated: false,
      baseUrl: config.baseUrl,
      mode: authHeader ? 'basic_auth' : 'anonymous',
      status: 'unreachable',
      version: null,
      message: 'Stored Jenkins URL is invalid.',
      checkedAt,
    };
  }

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

async function resolveConfig(): Promise<ResolvedConfig> {
  try {
    const row = await prisma.integrationConfig.findUnique({ where: { provider: 'jenkins' } });
    if (row?.baseUrl) {
      const apiToken = row.encryptedToken ? tryDecrypt(row.encryptedToken) : null;
      return { baseUrl: row.baseUrl, username: row.username, apiToken, source: 'db' };
    }
  } catch {
    // DB unavailable — fall through to env vars
  }

  const baseUrl = normalizeBaseUrl(process.env.JENKINS_BASE_URL);
  if (baseUrl) {
    return {
      baseUrl,
      username: normalizeOptional(process.env.JENKINS_USERNAME),
      apiToken: normalizeOptional(process.env.JENKINS_API_TOKEN),
      source: 'env',
    };
  }

  return { baseUrl: null, username: null, apiToken: null, source: 'none' };
}

function tryDecrypt(token: string): string | null {
  try {
    return decrypt(token);
  } catch {
    return null;
  }
}

function normalizeBaseUrl(value: string | undefined | null) {
  const trimmed = normalizeOptional(value);
  return trimmed ? trimmed.replace(/\/+$/, '') : null;
}

function normalizeOptional(value: string | undefined | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function buildApiUrl(baseUrl: string | null): URL | null {
  if (!baseUrl) return null;
  try {
    return new URL('/api/json', baseUrl);
  } catch {
    return null;
  }
}

function buildAuthHeader(username: string | null, apiToken: string | null) {
  if (!username || !apiToken) return null;
  return `Basic ${Buffer.from(`${username}:${apiToken}`).toString('base64')}`;
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
