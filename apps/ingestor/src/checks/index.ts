import { ownerAssigned } from './ownerAssigned.js';
import { readmePresent } from './readmePresent.js';
import { repositoryAccessible } from './repositoryAccessible.js';
import { runbookLinked } from './runbookLinked.js';
import { sloDefined } from './sloDefined.js';
import { vulnerabilityScanClean } from './vulnerabilityScanClean.js';
import type { Check } from './types.js';

/** Every check the ingestor runs. Adding one is a new file plus a line here. */
export const checks: Check[] = [
  readmePresent,
  ownerAssigned,
  repositoryAccessible,
  sloDefined,
  runbookLinked,
  vulnerabilityScanClean,
];

export type {
  Check,
  CheckContext,
  CheckResult,
  CheckService,
  RepositoryProbe,
  VulnerabilityAlerts,
} from './types.js';
