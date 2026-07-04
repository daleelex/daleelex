export enum ServiceType {
  API = 'api',
  DB = 'db',
  WEB = 'web',
  ML = 'ml',
  TOOL = 'tool',
}

export enum ServiceTier {
  TIER_1 = 1,
  TIER_2 = 2,
  TIER_3 = 3,
}

export enum ServiceLifecycle {
  PRODUCTION = 'production',
  BETA = 'beta',
  DEPRECATED = 'deprecated',
}

export enum LinkType {
  RUNBOOK = 'runbook',
  DASHBOARD = 'dashboard',
  DOCS = 'docs',
  OTHER = 'other',
}
