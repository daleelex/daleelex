import { describe, expect, it } from 'vitest';
import { planCatalogSync } from './catalogSync.js';
import type { ManagementSource } from '@daleelex/shared';

function file(repository: string, overrides: Record<string, string> = {}, extraSpec = '') {
  const spec = {
    id: 'svc-one-001',
    name: 'One',
    type: 'api',
    tier: '1',
    lifecycle: 'production',
    owner: 'platform-identity',
    ...overrides,
  };
  return {
    repository,
    sourceSha: `sha-${repository}`,
    source: `apiVersion: daleelex.io/v1
kind: Service
metadata:
  id: ${spec.id}
  name: ${spec.name}
spec:
  type: ${spec.type}
  tier: ${spec.tier}
  lifecycle: ${spec.lifecycle}
  owner: ${spec.owner}
${extraSpec}`,
  };
}

const teams = new Set(['platform-identity']);
const nothingExists = new Map<string, ManagementSource>();

function warningsFor(plan: ReturnType<typeof planCatalogSync>, repository: string) {
  return plan.warnings.find((entry) => entry.repository === repository)?.messages ?? [];
}

describe('planCatalogSync', () => {
  it('turns a valid file into an upsert with its owner linked', () => {
    const plan = planCatalogSync({
      files: [file('acme/one')],
      knownTeamIds: teams,
      existing: nothingExists,
    });

    expect(plan.skipped).toEqual([]);
    expect(plan.warnings).toEqual([]);
    expect(plan.upserts).toHaveLength(1);
    expect(plan.upserts[0].service).toEqual(
      expect.objectContaining({
        id: 'svc-one-001',
        ownerTeamId: 'platform-identity',
        repository: 'acme/one',
        sourceSha: 'sha-acme/one',
      }),
    );
  });

  it('imports a service whose owner is unknown, and says so', () => {
    const plan = planCatalogSync({
      files: [file('acme/one', { owner: 'ghost-team' })],
      knownTeamIds: teams,
      existing: nothingExists,
    });

    expect(plan.upserts[0].service.ownerTeamId).toBeNull();
    expect(warningsFor(plan, 'acme/one')).toContain(
      'Owner "ghost-team" is not a known team; importing without an owner.',
    );
  });

  it('skips a broken file without losing the rest of the run', () => {
    const plan = planCatalogSync({
      files: [file('acme/one'), { repository: 'acme/bad', sourceSha: 'x', source: 'kind: Nope\n' }],
      knownTeamIds: teams,
      existing: nothingExists,
    });

    expect(plan.upserts).toHaveLength(1);
    expect(plan.skipped[0].repository).toBe('acme/bad');
  });

  it('refuses to let two repositories claim the same service id', () => {
    const plan = planCatalogSync({
      files: [file('acme/zzz'), file('acme/aaa')],
      knownTeamIds: teams,
      existing: nothingExists,
    });

    expect(plan.upserts).toHaveLength(1);
    expect(plan.upserts[0].service.repository).toBe('acme/aaa');
    expect(plan.skipped).toEqual([
      {
        repository: 'acme/zzz',
        reasons: ['Service id "svc-one-001" is already claimed by acme/aaa.'],
      },
    ]);
  });

  it('will not take over a service that is managed in the portal', () => {
    const plan = planCatalogSync({
      files: [file('acme/one')],
      knownTeamIds: teams,
      existing: new Map<string, ManagementSource>([['svc-one-001', 'portal']]),
    });

    expect(plan.upserts).toEqual([]);
    expect(plan.skipped[0].reasons[0]).toContain('managed in the portal');
  });

  it('does update a service it already owns', () => {
    const plan = planCatalogSync({
      files: [file('acme/one', { name: 'Renamed' })],
      knownTeamIds: teams,
      existing: new Map<string, ManagementSource>([['svc-one-001', 'repository']]),
    });

    expect(plan.upserts[0].service).toMatchObject({ id: 'svc-one-001', name: 'Renamed' });
  });

  it('carries the links the file declares', () => {
    const plan = planCatalogSync({
      files: [
        file(
          'acme/one',
          {},
          `  links:
    - url: https://runbook.internal/one
      title: Runbook
      type: runbook
    - url: https://grafana.internal/one
`,
        ),
      ],
      knownTeamIds: teams,
      existing: nothingExists,
    });

    expect(plan.upserts[0].links).toEqual([
      { url: 'https://runbook.internal/one', title: 'Runbook', type: 'runbook' },
      { url: 'https://grafana.internal/one', title: null, type: 'other' },
    ]);
  });

  it('resolves a dependency on a service another repository registers', () => {
    const plan = planCatalogSync({
      files: [
        file('acme/one', {}, '  dependencies:\n    - svc-two-002\n'),
        file('acme/two', { id: 'svc-two-002', name: 'Two' }),
      ],
      knownTeamIds: teams,
      existing: nothingExists,
    });

    const one = plan.upserts.find((record) => record.service.id === 'svc-one-001');
    expect(one?.dependencies).toEqual(['svc-two-002']);
  });

  it('resolves a dependency on a service that is already in the catalogue', () => {
    const plan = planCatalogSync({
      files: [file('acme/one', {}, '  dependencies:\n    - svc-seeded-009\n')],
      knownTeamIds: teams,
      existing: new Map<string, ManagementSource>([['svc-seeded-009', 'portal']]),
    });

    expect(plan.upserts[0].dependencies).toEqual(['svc-seeded-009']);
  });

  it('drops a dependency nothing in the catalogue provides, and says so', () => {
    const plan = planCatalogSync({
      files: [file('acme/one', {}, '  dependencies:\n    - svc-ghost-404\n')],
      knownTeamIds: teams,
      existing: nothingExists,
    });

    expect(plan.upserts[0].dependencies).toEqual([]);
    expect(warningsFor(plan, 'acme/one')).toContain(
      'Dependency "svc-ghost-404" is not in the catalogue; ignoring it.',
    );
  });

  it('drops a service that depends on itself', () => {
    const plan = planCatalogSync({
      files: [file('acme/one', {}, '  dependencies:\n    - svc-one-001\n')],
      knownTeamIds: teams,
      existing: nothingExists,
    });

    expect(plan.upserts[0].dependencies).toEqual([]);
    expect(warningsFor(plan, 'acme/one')).toContain(
      'Service "svc-one-001" lists itself as a dependency; ignoring it.',
    );
  });
});

describe('planCatalogSync retirement', () => {
  const tracked = new Map<string, ManagementSource>([
    ['svc-one-001', 'repository'],
    ['svc-gone-002', 'repository'],
  ]);
  const live = new Map<string, string | null>([
    ['svc-one-001', 'acme/one'],
    ['svc-gone-002', 'acme/gone'],
  ]);

  it('retires a service whose repository no longer declares it', () => {
    const plan = planCatalogSync({
      files: [file('acme/one')],
      knownTeamIds: teams,
      existing: tracked,
      retirable: live,
    });

    expect(plan.retirements).toEqual([{ id: 'svc-gone-002', repository: 'acme/gone' }]);
    expect(plan.retirementsHeld).toBeNull();
  });

  it('keeps a service that moved to another repository', () => {
    const plan = planCatalogSync({
      files: [file('acme/one'), file('acme/new-home', { id: 'svc-gone-002' })],
      knownTeamIds: teams,
      existing: tracked,
      retirable: live,
    });

    expect(plan.retirements).toEqual([]);
  });

  it('keeps a service whose catalog file could not be downloaded', () => {
    const plan = planCatalogSync({
      files: [file('acme/one')],
      knownTeamIds: teams,
      existing: tracked,
      retirable: live,
      unreadable: new Set(['acme/gone']),
    });

    expect(plan.retirements).toEqual([]);
  });

  it('keeps a service whose catalog file stopped validating', () => {
    const plan = planCatalogSync({
      files: [file('acme/one'), file('acme/gone', { id: 'svc-gone-002', type: 'nonsense' })],
      knownTeamIds: teams,
      existing: tracked,
      retirable: live,
    });

    expect(plan.skipped.map((entry) => entry.repository)).toEqual(['acme/gone']);
    expect(plan.retirements).toEqual([]);
  });

  it('retires nothing, and says why, when no catalog file was found anywhere', () => {
    const plan = planCatalogSync({
      files: [],
      knownTeamIds: teams,
      existing: tracked,
      retirable: live,
    });

    expect(plan.retirements).toEqual([]);
    expect(plan.retirementsHeld).toContain('2 service(s) were kept');
  });

  it('never retires a service it was not told is repository-managed', () => {
    const plan = planCatalogSync({
      files: [file('acme/one')],
      knownTeamIds: teams,
      existing: new Map<string, ManagementSource>([['svc-portal-003', 'portal']]),
    });

    expect(plan.retirements).toEqual([]);
    expect(plan.retirementsHeld).toBeNull();
  });
});
