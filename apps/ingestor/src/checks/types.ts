import type { ScorecardCategory, ScorecardStatus } from '@daleelex/shared';

/** The slice of a catalogue entry that checks are allowed to look at. */
export interface CheckService {
  id: string;
  ownerTeamId: string | null;
  repository: string | null;
  sloTarget: string | null;
  sloWindow: string | null;
  links: { type: string; url: string }[];
}

/** What a check may ask GitHub. Narrow on purpose, so tests can supply a fake. */
export interface RepositoryProbe {
  /** False when the repository is missing or hidden from the ingestor's token. */
  exists(repository: string): Promise<boolean>;
  /** Whether GitHub recognises a README in the repository's default branch. */
  hasReadme(repository: string): Promise<boolean>;
  /**
   * Open Dependabot alerts of high or critical severity. Null when GitHub
   * will not say: alerts are disabled, or the token may not read them.
   */
  openVulnerabilityAlerts(repository: string): Promise<VulnerabilityAlerts | null>;
}

export interface VulnerabilityAlerts {
  count: number;
  /** True when there are more alerts than the one page that was counted. */
  more: boolean;
}

export interface CheckContext {
  service: CheckService;
  /** Null when the ingestor has no GitHub token; checks that need it should skip. */
  github: RepositoryProbe | null;
}

export interface CheckResult {
  /** `skip` means the check does not apply; it neither helps nor hurts the score. */
  status: ScorecardStatus;
  /** Shown in the UI next to the check. */
  message: string;
  evidence?: Record<string, unknown>;
}

export interface Check {
  id: string;
  label: string;
  category: ScorecardCategory;
  /** Relative importance, 1-10. */
  weight: number;
  run(ctx: CheckContext): Promise<CheckResult>;
}
