import { askableRepository } from './repository.js';
import type { Check } from './types.js';

export const readmePresent: Check = {
  id: 'readme-present',
  label: 'README present',
  category: 'basics',
  weight: 4,
  async run(ctx) {
    const target = askableRepository(ctx);
    if ('skip' in target) return target.skip;

    return (await target.github.hasReadme(target.repository))
      ? { status: 'pass', message: `${target.repository} has a README.` }
      : { status: 'fail', message: `No README was found in ${target.repository}.` };
  },
};
