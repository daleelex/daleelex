import { parse } from 'yaml';
import type { ServiceLifecycle, ServiceTier, ServiceType } from '@daleelex/shared';

export const API_VERSION = 'daleelex.io/v1';
export const KIND = 'Service';
export const CATALOG_FILE = 'catalog-info.yaml';

const TYPES: ServiceType[] = ['api', 'db', 'web', 'ml', 'tool'];
const LIFECYCLES: ServiceLifecycle[] = ['production', 'beta', 'deprecated'];
const TIERS: ServiceTier[] = [1, 2, 3];

const KNOWN_ROOT = ['apiVersion', 'kind', 'metadata', 'spec'];
const KNOWN_METADATA = ['id', 'name', 'description'];
const KNOWN_SPEC = [
  'type',
  'tier',
  'lifecycle',
  'owner',
  'language',
  'repository',
  'slo',
  'tags',
  'links',
  'dependencies',
];
const KNOWN_SLO = ['target', 'window'];

export interface ParsedService {
  id: string;
  name: string;
  description: string | null;
  type: ServiceType;
  tier: ServiceTier;
  lifecycle: ServiceLifecycle;
  /** Raw team id from the file; resolved against the teams table by the caller. */
  ownerRef: string | null;
  language: string | null;
  repository: string;
  sloTarget: string | null;
  sloWindow: string | null;
  tags: string[];
}

export interface ParseResult {
  /** null when the file was rejected; `errors` then says why. */
  service: ParsedService | null;
  errors: string[];
  warnings: string[];
}

/**
 * Parses one repository's catalog-info.yaml.
 *
 * Anything the schema does not recognise is a warning, never an error — one
 * team's experiment must not keep the rest of the catalogue from syncing.
 * Only a malformed or incomplete *required* field rejects the file.
 */
export function parseCatalogInfo(source: string, repository: string): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let document: unknown;
  try {
    document = parse(source);
  } catch (error) {
    return {
      service: null,
      errors: [`${CATALOG_FILE} is not valid YAML: ${message(error)}`],
      warnings,
    };
  }

  if (!isRecord(document)) {
    return { service: null, errors: [`${CATALOG_FILE} must be a YAML mapping.`], warnings };
  }

  if (document.apiVersion !== API_VERSION) {
    errors.push(`Expected apiVersion "${API_VERSION}", got ${describe(document.apiVersion)}.`);
  }
  if (document.kind !== KIND) {
    errors.push(`Expected kind "${KIND}", got ${describe(document.kind)}.`);
  }

  const metadata = isRecord(document.metadata) ? document.metadata : {};
  const spec = isRecord(document.spec) ? document.spec : {};
  if (!isRecord(document.metadata)) errors.push('metadata is missing or not a mapping.');
  if (!isRecord(document.spec)) errors.push('spec is missing or not a mapping.');

  warnings.push(...unknownKeys(document, KNOWN_ROOT, ''));
  warnings.push(...unknownKeys(metadata, KNOWN_METADATA, 'metadata.'));
  warnings.push(...unknownKeys(spec, KNOWN_SPEC, 'spec.'));

  const id = requiredString(metadata.id, 'metadata.id', errors);
  if (id && !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    errors.push(`metadata.id "${id}" must be lowercase letters, digits and hyphens.`);
  }
  const name = requiredString(metadata.name, 'metadata.name', errors);
  const type = requiredEnum(spec.type, TYPES, 'spec.type', errors);
  const lifecycle = requiredEnum(spec.lifecycle, LIFECYCLES, 'spec.lifecycle', errors);

  let tier: ServiceTier | null = null;
  if (TIERS.includes(spec.tier as ServiceTier)) {
    tier = spec.tier as ServiceTier;
  } else {
    errors.push(`spec.tier must be one of 1, 2, 3 — got ${describe(spec.tier)}.`);
  }

  const slo = isRecord(spec.slo) ? spec.slo : {};
  if (spec.slo !== undefined && !isRecord(spec.slo)) {
    warnings.push('spec.slo is not a mapping; ignoring it.');
  } else {
    warnings.push(...unknownKeys(slo, KNOWN_SLO, 'spec.slo.'));
  }

  // The repository we found the file in wins: a stale value in the file would
  // otherwise point docs sync and the UI's "edit" link at the wrong place.
  const declared = optionalString(spec.repository);
  if (declared && declared !== repository) {
    warnings.push(
      `spec.repository "${declared}" does not match ${repository}; using ${repository}.`,
    );
  }

  if (errors.length > 0) return { service: null, errors, warnings };

  return {
    service: {
      id: id!,
      name: name!,
      description: optionalString(metadata.description),
      type: type!,
      tier: tier!,
      lifecycle: lifecycle!,
      ownerRef: optionalString(spec.owner),
      language: optionalString(spec.language),
      repository,
      sloTarget: optionalString(slo.target),
      sloWindow: optionalString(slo.window),
      tags: stringList(spec.tags, warnings),
    },
    errors,
    warnings,
  };
}

function unknownKeys(value: Record<string, unknown>, known: string[], prefix: string) {
  return Object.keys(value)
    .filter((key) => !known.includes(key))
    .map((key) => `Unknown field ${prefix}${key}; ignoring it.`);
}

function requiredString(value: unknown, field: string, errors: string[]) {
  const text = optionalString(value);
  if (!text) {
    errors.push(`${field} is required — got ${describe(value)}.`);
    return null;
  }
  return text;
}

function requiredEnum<T extends string>(
  value: unknown,
  allowed: T[],
  field: string,
  errors: string[],
) {
  if (typeof value === 'string' && allowed.includes(value as T)) return value as T;
  errors.push(`${field} must be one of ${allowed.join(', ')} — got ${describe(value)}.`);
  return null;
}

function optionalString(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function stringList(value: unknown, warnings: string[]) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    warnings.push('spec.tags is not a list; ignoring it.');
    return [];
  }
  const tags = value.filter((entry): entry is string => typeof entry === 'string');
  if (tags.length !== value.length)
    warnings.push('spec.tags has non-string entries; ignoring them.');
  return tags.map((tag) => tag.trim()).filter(Boolean);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describe(value: unknown) {
  if (value === undefined) return 'nothing';
  if (value === null) return 'null';
  return JSON.stringify(value);
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
