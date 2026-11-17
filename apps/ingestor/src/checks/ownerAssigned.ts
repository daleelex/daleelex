import type { Check } from './types.js';

export const ownerAssigned: Check = {
  id: 'owner-assigned',
  label: 'Owner assigned',
  category: 'basics',
  weight: 8,
  async run({ service }) {
    return service.ownerTeamId
      ? { status: 'pass', message: `Owned by ${service.ownerTeamId}.` }
      : { status: 'fail', message: 'No owning team is assigned.' };
  },
};
