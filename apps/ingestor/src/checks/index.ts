import { ownerAssigned } from './ownerAssigned.js';
import { repositoryAccessible } from './repositoryAccessible.js';
import { runbookLinked } from './runbookLinked.js';
import { sloDefined } from './sloDefined.js';
import type { Check } from './types.js';

/** Every check the ingestor runs. Adding one is a new file plus a line here. */
export const checks: Check[] = [ownerAssigned, repositoryAccessible, sloDefined, runbookLinked];

export type { Check, CheckContext, CheckResult, CheckService, RepositoryProbe } from './types.js';
