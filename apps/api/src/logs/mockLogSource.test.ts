import { describe, expect, it } from 'vitest';
import { canViewLogs, InvalidLogCursorError, type LogQuery } from './logSource.js';
import { MockLogSource } from './mockLogSource.js';

const baseQuery: LogQuery = {
  selector: { serviceId: 'svc-payments' },
  start: '2026-08-01T09:00:00.000Z',
  end: '2026-08-01T10:00:00.000Z',
  limit: 5,
};

describe('MockLogSource', () => {
  it('uses stable keyset pagination and exposes query identity in the opaque cursor', async () => {
    const source = new MockLogSource();
    const first = await source.query(baseQuery);
    const second = await source.query({ ...baseQuery, cursor: first.nextCursor! });

    const firstIds = first.entries.map((entry) => entry.id);
    const secondIds = second.entries.map((entry) => entry.id);

    expect(first.entries).toHaveLength(5);
    expect(first.nextCursor).toBeTruthy();
    expect(second.entries).toHaveLength(5);
    // Disjoint, not merely "not a superset" — an off-by-one that repeats only the
    // boundary entry still satisfies `not.arrayContaining`.
    expect(secondIds.filter((id) => firstIds.includes(id))).toEqual([]);
    expect(second.entries[0].timestamp <= first.entries.at(-1)!.timestamp).toBe(true);

    const payload = JSON.parse(Buffer.from(first.nextCursor!, 'base64url').toString('utf8'));
    expect(payload.scope).toEqual({
      serviceId: baseQuery.selector.serviceId,
      start: baseQuery.start,
      end: baseQuery.end,
      search: null,
    });
    expect(payload.after).toEqual({
      timestamp: first.entries.at(-1)!.timestamp,
      id: first.entries.at(-1)!.id,
    });
  });

  it.each([
    ['service', { selector: { serviceId: 'svc-orders' } }],
    ['start', { start: '2026-08-01T09:01:00.000Z' }],
    ['end', { end: '2026-08-01T10:01:00.000Z' }],
    ['search', { search: 'retry' }],
  ])('rejects a cursor reused with different %s filters', async (_name, override) => {
    const source = new MockLogSource();
    const first = await source.query(baseQuery);

    await expect(
      source.query({ ...baseQuery, ...override, cursor: first.nextCursor! }),
    ).rejects.toBeInstanceOf(InvalidLogCursorError);
  });

  it('filters mock entries by message text', async () => {
    const page = await new MockLogSource().query({ ...baseQuery, search: 'retry', limit: 100 });

    expect(page.entries.length).toBeGreaterThan(0);
    expect(page.entries.every((entry) => entry.message.toLowerCase().includes('retry'))).toBe(true);
  });

  it('rejects malformed cursor values', async () => {
    await expect(
      new MockLogSource().query({ ...baseQuery, cursor: 'not-a-cursor' }),
    ).rejects.toBeInstanceOf(InvalidLogCursorError);
  });
});

describe('canViewLogs', () => {
  const service = { id: 'svc-payments', ownerTeamId: 'team-payments' };
  const unowned = { id: 'svc-orphan', ownerTeamId: null };

  it('allows administrators', () => {
    expect(canViewLogs({ id: 'admin-1', isAdmin: true, teamIds: [] }, service)).toBe(true);
  });

  it('allows members of the owning team', () => {
    expect(
      canViewLogs(
        { id: 'user-1', isAdmin: false, teamIds: ['team-search', 'team-payments'] },
        service,
      ),
    ).toBe(true);
  });

  it('denies members of other teams', () => {
    expect(canViewLogs({ id: 'user-1', isAdmin: false, teamIds: ['team-search'] }, service)).toBe(
      false,
    );
  });

  it('denies users with no team', () => {
    expect(canViewLogs({ id: 'user-1', isAdmin: false, teamIds: [] }, service)).toBe(false);
  });

  it('keeps services with no owner admin-only', () => {
    expect(canViewLogs({ id: 'user-1', isAdmin: false, teamIds: ['team-payments'] }, unowned)).toBe(
      false,
    );
    expect(canViewLogs({ id: 'admin-1', isAdmin: true, teamIds: [] }, unowned)).toBe(true);
  });
});
