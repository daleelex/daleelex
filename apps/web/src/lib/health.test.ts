import { describe, expect, it } from 'vitest';
import type { Service, ServiceLink } from '@daleelex/shared';
import { computeHealth, toServiceHealth } from './health';

const link = (type: ServiceLink['type']): ServiceLink => ({
  id: 1,
  url: `https://example.test/${type}`,
  title: null,
  type,
});

function service(overrides: Partial<Service> = {}): Service {
  return {
    id: 'svc-1',
    name: 'Service',
    description: null,
    type: 'api',
    tier: 2,
    lifecycle: 'production',
    ownerTeamId: 'team-1',
    owner: {
      id: 'team-1',
      name: 'Team',
      slackChannel: null,
      onCallSchedule: null,
      managementSource: 'repository',
    },
    language: null,
    repository: null,
    sloTarget: '99.9%',
    sloWindow: '30d',
    tags: [],
    links: [link('runbook'), link('dashboard')],
    dependencies: [],
    createdAt: '',
    updatedAt: '',
    managementSource: 'repository',
    ...overrides,
  };
}

describe('toServiceHealth', () => {
  it('is ready only when every check passes', () => {
    const health = toServiceHealth(service());
    expect(health.state).toBe('healthy');
    expect(health.gaps).toEqual([]);
    expect(health.runbookUrl).toBe('https://example.test/runbook');
  });

  it('is partly ready with exactly one failed check', () => {
    const health = toServiceHealth(service({ links: [link('runbook')] }));
    expect(health.state).toBe('watch');
    expect(health.checks.dashboard).toBe(false);
    expect(health.dashboardUrl).toBeNull();
  });

  it('is not ready with two or more failed checks', () => {
    const health = toServiceHealth(service({ links: [], lifecycle: 'beta' }));
    expect(health.state).toBe('risk');
    expect(health.gaps).toHaveLength(3);
  });

  it('needs both an SLO target and a window', () => {
    expect(toServiceHealth(service({ sloWindow: null })).checks.slo).toBe(false);
  });
});

describe('computeHealth', () => {
  it('lists failing checks most widespread first', () => {
    const health = computeHealth([
      service({ id: 'a' }),
      service({ id: 'b', links: [link('dashboard')] }),
      service({ id: 'c', links: [], owner: null }),
    ]);
    const summary = health.checkSummary.map((s) => [s.check.id, s.missing]);
    expect(summary[0]).toEqual(['runbook', 2]);
    expect(Object.fromEntries(summary)).toMatchObject({ dashboard: 1, owner: 1, slo: 0 });
  });
});
