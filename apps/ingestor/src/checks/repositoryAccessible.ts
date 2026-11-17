import { REPOSITORY } from './repository.js';
import type { Check } from './types.js';

export const repositoryAccessible: Check = {
  id: 'repository-accessible',
  label: 'Repository accessible',
  category: 'basics',
  weight: 6,
  async run({ service, github }) {
    const { repository } = service;
    if (!repository) {
      return { status: 'skip', message: 'No repository is recorded for this service.' };
    }
    if (!REPOSITORY.test(repository)) {
      return { status: 'fail', message: `"${repository}" is not in "owner/repo" form.` };
    }
    if (!github) {
      return {
        status: 'skip',
        message: 'The ingestor has no GitHub token, so repositories cannot be checked.',
      };
    }
    return (await github.exists(repository))
      ? { status: 'pass', message: `${repository} is reachable.` }
      : {
          status: 'fail',
          message: `${repository} was not found, or the ingestor's token cannot see it.`,
        };
  },
};
