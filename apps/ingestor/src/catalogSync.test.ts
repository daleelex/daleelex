import { describe, expect, it } from 'vitest';
import { planCatalogSync } from './catalogSync.js';
import type { ManagementSource } from '@daleelex/shared';

function file(repository: string, overrides: Record<string, string> = {}) {
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
`,
  };
}

const teams = new Set(['platform-identity']);
const nothingExists = new Map<string, ManagementSource>();

describe('planCatalogSync', () => {
  it('turns a valid file into an upsert with its owner linked', () => {
    const plan = planCatalogSync({
      files: [file('acme/one')],
      knownTeamIds: teams,
      existing: nothingExists,
    });

    expect(plan.skipped).toEqual([]);
    expect(plan.warnings).toEqual([]);
    expect(plan.upserts).toEqual([
      expect.objectContaining({
        id: 'svc-one-001',
        ownerTeamId: 'platform-identity',
        repository: 'acme/one',
        sourceSha: 'sha-acme/one',
      }),
    ]);
  });

  it('imports a service whose owner is unknown, and says so', () => {
    const plan = planCatalogSync({
      files: [file('acme/one', { owner: 'ghost-team' })],
      knownTeamIds: teams,
      existing: nothingExists,
    });

    expect(plan.upserts[0].ownerTeamId).toBeNull();
    expect(plan.warnings[0].messages).toContain(
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
    expect(plan.upserts[0].repository).toBe('acme/aaa');
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

    expect(plan.upserts[0]).toMatchObject({ id: 'svc-one-001', name: 'Renamed' });
  });
});
