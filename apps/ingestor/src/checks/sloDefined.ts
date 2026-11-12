import type { Check } from './types.js';

export const sloDefined: Check = {
  id: 'slo-defined',
  label: 'SLO defined',
  category: 'reliability',
  weight: 7,
  async run({ service }) {
    if (!service.sloTarget) return { status: 'fail', message: 'No SLO target is declared.' };
    return {
      status: 'pass',
      message: service.sloWindow
        ? `Target ${service.sloTarget} over ${service.sloWindow}.`
        : `Target ${service.sloTarget}.`,
    };
  },
};
