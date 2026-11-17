import type { Check } from './types.js';

export const runbookLinked: Check = {
  id: 'runbook-linked',
  label: 'Runbook linked',
  category: 'reliability',
  weight: 6,
  async run({ service }) {
    const runbook = service.links.find((link) => link.type === 'runbook');
    return runbook
      ? { status: 'pass', message: 'A runbook is linked.', evidence: { url: runbook.url } }
      : { status: 'fail', message: 'No link of type "runbook" is declared.' };
  },
};
