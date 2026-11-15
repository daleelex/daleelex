import { describe, expect, it } from 'vitest';
import { checks, type Check, type CheckService, type RepositoryProbe } from './checks/index.js';
import { changedResults, runChecks } from './scorecard.js';

const complete: CheckService = {
  id: 'svc-auth-001',
  ownerTeamId: 'platform-identity',
  repository: 'platform/auth-gateway',
  sloTarget: '99.95%',
  sloWindow: '30d',
  links: [{ type: 'runbook', url: 'https://runbook.internal/auth' }],
};

const bare: CheckService = {
  id: 'svc-bare-002',
  ownerTeamId: null,
  repository: null,
  sloTarget: null,
  sloWindow: null,
  links: [{ type: 'dashboard', url: 'https://grafana.internal/d/bare' }],
};

const reachable: RepositoryProbe = {
  exists: async () => true,
  hasReadme: async () => true,
  openVulnerabilityAlerts: async () => ({ count: 0, more: false }),
};

function statuses(results: { serviceId: string; checkId: string; status: string }[], id: string) {
  return Object.fromEntries(
    results.filter((r) => r.serviceId === id).map((r) => [r.checkId, r.status]),
  );
}

describe('registered checks', () => {
  it('pass a fully described service', async () => {
    const { results, errors } = await runChecks(checks, [complete], reachable);

    expect(errors).toEqual([]);
    expect(statuses(results, complete.id)).toEqual({
      'readme-present': 'pass',
      'owner-assigned': 'pass',
      'repository-accessible': 'pass',
      'slo-defined': 'pass',
      'runbook-linked': 'pass',
      'vulnerability-scan-clean': 'pass',
    });
  });

  it('fail what is missing and skip the repository checks when there is no repository', async () => {
    const { results } = await runChecks(checks, [bare], reachable);

    expect(statuses(results, bare.id)).toEqual({
      'readme-present': 'skip',
      'owner-assigned': 'fail',
      'repository-accessible': 'skip',
      'slo-defined': 'fail',
      'runbook-linked': 'fail',
      'vulnerability-scan-clean': 'skip',
    });
  });

  it('fail a repository GitHub cannot show us, without asking about a malformed one', async () => {
    const asked: string[] = [];
    const hidden: RepositoryProbe = {
      ...reachable,
      exists: async (repository) => {
        asked.push(repository);
        return false;
      },
    };

    const { results } = await runChecks(
      checks,
      [complete, { ...complete, id: 'svc-odd-003', repository: 'not a repository' }],
      hidden,
    );

    expect(statuses(results, complete.id)['repository-accessible']).toBe('fail');
    expect(statuses(results, 'svc-odd-003')['repository-accessible']).toBe('fail');
    expect(asked).toEqual(['platform/auth-gateway']);
  });

  it('skip every repository check when there is no GitHub token to ask with', async () => {
    const { results, errors } = await runChecks(checks, [complete], null);

    expect(errors).toEqual([]);
    expect(statuses(results, complete.id)).toEqual(
      expect.objectContaining({
        'readme-present': 'skip',
        'repository-accessible': 'skip',
        'vulnerability-scan-clean': 'skip',
      }),
    );
  });

  it('fail a repository with no README', async () => {
    const { results } = await runChecks(checks, [complete], {
      ...reachable,
      hasReadme: async () => false,
    });

    expect(statuses(results, complete.id)['readme-present']).toBe('fail');
  });

  it('fail on open high-severity alerts and say how many', async () => {
    const { results } = await runChecks(checks, [complete], {
      ...reachable,
      openVulnerabilityAlerts: async () => ({ count: 3, more: false }),
    });

    const result = results.find((r) => r.checkId === 'vulnerability-scan-clean');
    expect(result).toEqual(
      expect.objectContaining({
        status: 'fail',
        message: '3 open high or critical Dependabot alerts.',
      }),
    );
  });

  it('skip the vulnerability check, rather than pass it, when GitHub will not share alerts', async () => {
    const { results } = await runChecks(checks, [complete], {
      ...reachable,
      openVulnerabilityAlerts: async () => null,
    });

    expect(statuses(results, complete.id)['vulnerability-scan-clean']).toBe('skip');
  });

  it('do not charge a malformed repository twice', async () => {
    const { results } = await runChecks(
      checks,
      [{ ...complete, repository: 'not a repository' }],
      reachable,
    );

    expect(statuses(results, complete.id)).toEqual(
      expect.objectContaining({
        'readme-present': 'skip',
        'repository-accessible': 'fail',
        'vulnerability-scan-clean': 'skip',
      }),
    );
  });

  it('have unique ids and weights within 1-10', () => {
    expect(new Set(checks.map((check) => check.id)).size).toBe(checks.length);
    for (const check of checks) {
      expect(check.weight).toBeGreaterThanOrEqual(1);
      expect(check.weight).toBeLessThanOrEqual(10);
    }
  });
});

describe('runChecks', () => {
  it('reports a check that throws as an error and still runs the others', async () => {
    const down: RepositoryProbe = {
      ...reachable,
      exists: async () => {
        throw new Error('GitHub request failed (503)');
      },
    };

    const { results, errors } = await runChecks(checks, [complete], down);

    expect(errors).toEqual([
      {
        serviceId: complete.id,
        checkId: 'repository-accessible',
        message: 'GitHub request failed (503)',
      },
    ]);
    expect(Object.keys(statuses(results, complete.id))).toEqual([
      'readme-present',
      'owner-assigned',
      'slo-defined',
      'runbook-linked',
      'vulnerability-scan-clean',
    ]);
  });
});

describe('changedResults', () => {
  const always = (status: 'pass' | 'fail', message: string): Check => ({
    id: 'always',
    label: 'Always',
    category: 'basics',
    weight: 1,
    run: async () => ({ status, message }),
  });

  it('keeps only results that are new or differ from the stored outcome', async () => {
    const { results } = await runChecks(
      [always('fail', 'Still broken.')],
      [complete, bare],
      reachable,
    );

    const changed = changedResults(
      [
        { serviceId: complete.id, checkId: 'always', status: 'fail', message: 'Still broken.' },
        { serviceId: bare.id, checkId: 'always', status: 'pass', message: 'Fine.' },
      ],
      results,
    );

    expect(changed.map((result) => result.serviceId)).toEqual([bare.id]);
  });

  it('treats a first run as all new', async () => {
    const { results } = await runChecks([always('pass', 'Fine.')], [complete], reachable);

    expect(changedResults([], results)).toHaveLength(1);
  });

  it('rewrites a result whose message changed even if the status did not', async () => {
    const { results } = await runChecks(
      [always('fail', 'Now broken differently.')],
      [complete],
      reachable,
    );

    expect(
      changedResults(
        [{ serviceId: complete.id, checkId: 'always', status: 'fail', message: 'Still broken.' }],
        results,
      ),
    ).toHaveLength(1);
  });
});
