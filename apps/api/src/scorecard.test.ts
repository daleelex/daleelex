import { describe, expect, it } from 'vitest';
import { buildServiceScorecard, weightedScore, type LatestCheckRow } from './scorecard.js';

function row(checkId: string, status: string, weight: number): LatestCheckRow {
  return {
    checkId,
    label: checkId,
    category: 'basics',
    weight,
    status,
    message: null,
    ranAt: new Date('2026-11-12T10:00:00Z'),
  };
}

describe('weightedScore', () => {
  it('weights passes against everything that applies', () => {
    expect(
      weightedScore([
        { status: 'pass', weight: 8 },
        { status: 'fail', weight: 2 },
      ]),
    ).toBe(80);
  });

  it('leaves skipped checks out of the denominator', () => {
    expect(
      weightedScore([
        { status: 'pass', weight: 5 },
        { status: 'skip', weight: 10 },
      ]),
    ).toBe(100);
  });

  it('is null when nothing applies', () => {
    expect(weightedScore([])).toBeNull();
    expect(weightedScore([{ status: 'skip', weight: 4 }])).toBeNull();
  });
});

describe('buildServiceScorecard', () => {
  it('orders checks heaviest first and reports when each outcome began', () => {
    const scorecard = buildServiceScorecard('svc-a', [
      row('runbook-linked', 'fail', 6),
      row('owner-assigned', 'pass', 8),
      row('repository-accessible', 'skip', 6),
    ]);

    expect(scorecard.serviceId).toBe('svc-a');
    expect(scorecard.score).toBe(57);
    expect(scorecard.results.map((result) => result.checkId)).toEqual([
      'owner-assigned',
      'repository-accessible',
      'runbook-linked',
    ]);
    expect(scorecard.results[0].since).toBe('2026-11-12T10:00:00.000Z');
  });

  it('has no score for a service no check has run against', () => {
    expect(buildServiceScorecard('svc-new', [])).toEqual({
      serviceId: 'svc-new',
      score: null,
      results: [],
    });
  });
});
