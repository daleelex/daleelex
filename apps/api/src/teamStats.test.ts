import { describe, expect, it } from 'vitest';
import { buildTeamStats, type ScorecardResultRow, type TeamRow } from './teamStats.js';

const teams: TeamRow[] = [
  {
    id: 'platform',
    name: 'Platform',
    slackChannel: '#platform',
    onCallSchedule: null,
    services: [
      { id: 'svc-a', name: 'Service A', type: 'api', tier: 1 },
      { id: 'svc-b', name: 'Service B', type: 'web', tier: 2 },
    ],
  },
];

function result(
  serviceId: string,
  checkId: string,
  status: string,
  weight: number,
  ranAt: string,
  message: string | null = null,
): ScorecardResultRow {
  return {
    serviceId,
    checkId,
    status,
    message,
    ranAt: new Date(ranAt),
    check: { weight, enabled: true },
  };
}

describe('buildTeamStats', () => {
  it('does not count a skipped check against a service', () => {
    const stats = buildTeamStats(teams, [
      result('svc-a', 'owner-assigned', 'pass', 5, '2026-01-02'),
      result('svc-a', 'repository-accessible', 'skip', 5, '2026-01-02'),
      result('svc-b', 'repository-accessible', 'skip', 5, '2026-01-02'),
    ]);

    expect(stats[0].services).toEqual([
      expect.objectContaining({ id: 'svc-a', scorecardHealth: 100 }),
      expect.objectContaining({ id: 'svc-b', scorecardHealth: null }),
    ]);
    expect(stats[0].scoredServiceCount).toBe(1);
  });

  it('uses the latest weighted scorecard results and exposes ownership gaps', () => {
    const stats = buildTeamStats(teams, [
      result('svc-a', 'owner-assigned', 'fail', 5, '2026-01-01', 'Missing owner'),
      result('svc-a', 'owner-assigned', 'pass', 5, '2026-01-02'),
      result('svc-a', 'runbook-present', 'fail', 5, '2026-01-02'),
      result('svc-b', 'owner-assigned', 'fail', 4, '2026-01-02', 'Owner cannot be resolved'),
    ]);

    expect(stats[0]).toMatchObject({
      serviceCount: 2,
      tier1Count: 1,
      averageScorecardHealth: 25,
      scoredServiceCount: 2,
      openOwnershipGaps: [
        {
          serviceId: 'svc-b',
          serviceName: 'Service B',
          message: 'Owner cannot be resolved',
        },
      ],
    });
    expect(stats[0].services).toEqual([
      expect.objectContaining({ id: 'svc-a', scorecardHealth: 50, hasOwnershipGap: false }),
      expect.objectContaining({ id: 'svc-b', scorecardHealth: 0, hasOwnershipGap: true }),
    ]);
  });

  it('returns null health when a team has no scorecard results', () => {
    const stats = buildTeamStats(teams, []);

    expect(stats[0].averageScorecardHealth).toBeNull();
    expect(stats[0].scoredServiceCount).toBe(0);
    expect(stats[0].openOwnershipGaps).toEqual([]);
  });

  it('ignores disabled checks', () => {
    const disabled = result('svc-a', 'legacy-check', 'fail', 10, '2026-01-02');
    disabled.check.enabled = false;

    expect(buildTeamStats(teams, [disabled])[0].averageScorecardHealth).toBeNull();
  });
});
