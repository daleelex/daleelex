import type { LokiConfigResponse, LokiTestResponse } from '@daleelex/shared';
import { prisma } from '../db.js';
import type { LogSource } from '../logs/logSource.js';
import { LokiLogSource } from '../logs/lokiLogSource.js';
import { MockLogSource } from '../logs/mockLogSource.js';

const PROVIDER = 'loki';
export const DEFAULT_SERVICE_LABEL = 'service_id';
const REQUEST_TIMEOUT_MS = 5000;
// Loki's own rule for label names. Enforced because the label is interpolated into
// LogQL unquoted — anything else would be a query-injection seam.
const LABEL_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export class LokiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LokiConfigError';
  }
}

interface ResolvedLokiConfig {
  baseUrl: string | null;
  serviceLabel: string;
  source: 'db' | 'env' | 'none';
}

/** A saved config wins; LOKI_URL is the fallback; with neither, logs are mock. */
export async function getLokiConfig(): Promise<LokiConfigResponse> {
  const row = await prisma.integrationConfig.findUnique({ where: { provider: PROVIDER } });
  if (row?.baseUrl) {
    return { baseUrl: row.baseUrl, serviceLabel: readServiceLabel(row.settings), source: 'db' };
  }
  return envConfig();
}

export async function saveLokiConfig(
  baseUrl: string,
  serviceLabel: string | undefined,
): Promise<void> {
  const normalizedBaseUrl = normalizeLokiBaseUrl(baseUrl);
  const normalizedLabel = normalizeServiceLabel(serviceLabel);
  const settings = { serviceLabel: normalizedLabel };

  await prisma.integrationConfig.upsert({
    where: { provider: PROVIDER },
    create: { provider: PROVIDER, baseUrl: normalizedBaseUrl, settings },
    update: { baseUrl: normalizedBaseUrl, settings },
  });
}

/** Drops the saved config, so the API falls back to LOKI_URL or the mock. */
export async function deleteLokiConfig(): Promise<void> {
  await prisma.integrationConfig.deleteMany({ where: { provider: PROVIDER } });
}

export async function testLokiConnection(
  baseUrl: string,
  serviceLabel: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<LokiTestResponse> {
  let normalizedBaseUrl: string;
  let label: string;
  try {
    normalizedBaseUrl = normalizeLokiBaseUrl(baseUrl);
    label = normalizeServiceLabel(serviceLabel);
  } catch (error) {
    return { ok: false, message: (error as Error).message, labelFound: null };
  }

  let response: Response;
  try {
    response = await fetchImpl(`${normalizedBaseUrl}/loki/api/v1/labels`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, message: 'Loki could not be reached at that URL.', labelFound: null };
  }

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      message: 'Loki requires authentication, which this connector does not support yet.',
      labelFound: null,
    };
  }
  if (!response.ok) {
    return { ok: false, message: `Loki returned HTTP ${response.status}.`, labelFound: null };
  }

  const body = (await response.json().catch(() => null)) as {
    status?: string;
    data?: unknown;
  } | null;
  if (body?.status !== 'success') {
    return {
      ok: false,
      message: 'That URL answered, but not like a Loki API.',
      labelFound: null,
    };
  }

  const labels = Array.isArray(body.data) ? body.data : [];
  const labelFound = labels.includes(label);
  return {
    ok: true,
    message: labelFound
      ? `Connected. Streams with a "${label}" label were found.`
      : `Connected, but no recent stream has a "${label}" label, so the Logs tab would be empty.`,
    labelFound,
  };
}

/**
 * Picks the log backend per request rather than once at boot, so saving the Loki
 * config in Settings takes effect without restarting the API. The Loki client is
 * reused until the config changes.
 */
export function createLogSourceResolver(): () => Promise<LogSource> {
  const mock = new MockLogSource();
  let cached: { key: string; source: LogSource } | null = null;

  return async () => {
    const config = await getLokiConfig();
    if (!config.baseUrl) return mock;

    const key = `${config.baseUrl}\n${config.serviceLabel}`;
    if (cached?.key !== key) {
      cached = {
        key,
        source: new LokiLogSource({ baseUrl: config.baseUrl, serviceLabel: config.serviceLabel }),
      };
    }
    return cached.source;
  };
}

export function normalizeLokiBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new LokiConfigError('Loki URL must be a valid http(s) URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new LokiConfigError('Loki URL must be a valid http(s) URL.');
  }
  // The URL is stored and shown back in plain text, so it must not carry secrets.
  if (url.username || url.password) {
    throw new LokiConfigError('Loki URL must not contain credentials.');
  }
  if (url.search || url.hash) {
    throw new LokiConfigError('Loki URL must not contain a query string or fragment.');
  }
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
}

export function normalizeServiceLabel(value: string | undefined | null): string {
  const label = value?.trim() || DEFAULT_SERVICE_LABEL;
  if (!LABEL_NAME.test(label)) {
    throw new LokiConfigError(
      'Service label must be a valid Loki label name (letters, digits and underscores).',
    );
  }
  return label;
}

function envConfig(): ResolvedLokiConfig {
  const baseUrl = process.env.LOKI_URL?.trim();
  if (!baseUrl) return { baseUrl: null, serviceLabel: DEFAULT_SERVICE_LABEL, source: 'none' };
  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    serviceLabel: process.env.LOKI_SERVICE_LABEL?.trim() || DEFAULT_SERVICE_LABEL,
    source: 'env',
  };
}

function readServiceLabel(settings: unknown): string {
  const label =
    settings && typeof settings === 'object'
      ? (settings as { serviceLabel?: unknown }).serviceLabel
      : undefined;
  return typeof label === 'string' && LABEL_NAME.test(label) ? label : DEFAULT_SERVICE_LABEL;
}
