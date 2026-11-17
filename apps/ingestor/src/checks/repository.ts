import type { CheckContext, CheckResult, RepositoryProbe } from './types.js';

export const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/**
 * For checks that inspect the contents of a service's repository: either the
 * repository to ask GitHub about, or the reason there is nothing to ask.
 *
 * A malformed repository is a skip here, not a failure. `repository-accessible`
 * already fails it, and one typo should not cost a service three checks.
 */
export function askableRepository({
  service,
  github,
}: CheckContext): { repository: string; github: RepositoryProbe } | { skip: CheckResult } {
  const { repository } = service;
  if (!repository) {
    return skip('No repository is recorded for this service.');
  }
  if (!REPOSITORY.test(repository)) {
    return skip(`"${repository}" is not in "owner/repo" form.`);
  }
  if (!github) {
    return skip('The ingestor has no GitHub token, so repositories cannot be checked.');
  }
  return { repository, github };
}

function skip(message: string): { skip: CheckResult } {
  return { skip: { status: 'skip', message } };
}
