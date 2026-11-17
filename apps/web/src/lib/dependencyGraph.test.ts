import { describe, expect, it } from 'vitest';
import type { Service } from '@daleelex/shared';
import { layoutDependencyGraph, neighbourInDirection, type GraphLayout } from './dependencyGraph';

function service(id: string, dependencies: string[] = []): Service {
  return {
    id,
    name: id.toUpperCase(),
    description: null,
    type: 'api',
    tier: 2,
    lifecycle: 'production',
    ownerTeamId: null,
    owner: null,
    language: null,
    repository: null,
    sloTarget: null,
    sloWindow: null,
    tags: [],
    links: [],
    dependencies,
    createdAt: '',
    updatedAt: '',
    managementSource: 'repository',
  };
}

const layerOf = (layout: GraphLayout) =>
  Object.fromEntries(layout.nodes.map((node) => [node.service.id, node.layer]));
const drawn = (layout: GraphLayout) => layout.nodes.map((node) => node.service.id).sort();

describe('layoutDependencyGraph', () => {
  it('puts what a service depends on to its left', () => {
    const layout = layoutDependencyGraph(
      [service('web', ['api']), service('api', ['db']), service('db')],
      null,
    );

    expect(layerOf(layout)).toEqual({ db: 0, api: 1, web: 2 });
    expect(layout.edges).toEqual(
      expect.arrayContaining([
        { from: 'web', to: 'api', cycle: false },
        { from: 'api', to: 'db', cycle: false },
      ]),
    );
  });

  it('places a service by its longest chain of dependencies', () => {
    const layout = layoutDependencyGraph(
      [service('web', ['api', 'db']), service('api', ['db']), service('db')],
      null,
    );

    expect(layerOf(layout).web).toBe(2);
  });

  it('draws a cycle without looping, flagging the edge that closes it', () => {
    const layout = layoutDependencyGraph([service('a', ['b']), service('b', ['a'])], null);

    expect(drawn(layout)).toEqual(['a', 'b']);
    expect(layout.edges.filter((edge) => edge.cycle)).toHaveLength(1);
  });

  it('leaves out services connected to nothing, and lists them', () => {
    const layout = layoutDependencyGraph(
      [service('a', ['b']), service('b'), service('loner')],
      null,
    );

    expect(drawn(layout)).toEqual(['a', 'b']);
    expect(layout.isolated.map((entry) => entry.id)).toEqual(['loner']);
  });

  it('ignores self-references and services outside the catalogue', () => {
    const layout = layoutDependencyGraph([service('a', ['a', 'ghost'])], null);

    expect(layout.nodes).toEqual([]);
    expect(layout.edges).toEqual([]);
    expect(layout.isolated.map((entry) => entry.id)).toEqual(['a']);
  });

  it('with a focus, draws only what it reaches in either direction', () => {
    const all = [
      service('web', ['api']),
      service('api', ['db']),
      service('db'),
      service('batch', ['db']),
      service('unrelated', ['other']),
      service('other'),
    ];

    const layout = layoutDependencyGraph(all, 'api');

    expect(drawn(layout)).toEqual(['api', 'db', 'web']);
    const roles = Object.fromEntries(layout.nodes.map((node) => [node.service.id, node.role]));
    expect(roles).toEqual({ api: 'focus', db: 'upstream', web: 'downstream' });
    expect(layout.isolated).toEqual([]);
  });

  it('follows the focus through several hops each way', () => {
    const all = [service('a', ['b']), service('b', ['c']), service('c', ['d']), service('d')];

    expect(drawn(layoutDependencyGraph(all, 'b'))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('draws a focused service with no dependencies on its own', () => {
    const layout = layoutDependencyGraph([service('a'), service('b', ['c']), service('c')], 'a');

    expect(drawn(layout)).toEqual(['a']);
  });

  it('falls back to the whole catalogue for an unknown focus', () => {
    const layout = layoutDependencyGraph([service('a', ['b']), service('b')], 'missing');

    expect(drawn(layout)).toEqual(['a', 'b']);
    expect(layout.nodes.every((node) => node.role === 'none')).toBe(true);
  });

  it('orders a column to avoid crossings', () => {
    // a1 and b1 depend on a0 and b0 respectively; name order alone would cross them.
    const layout = layoutDependencyGraph(
      [service('x0'), service('a0'), service('b1', ['a0']), service('a1', ['x0'])],
      null,
    );

    const rowOf = Object.fromEntries(layout.nodes.map((node) => [node.service.id, node.row]));
    expect(rowOf.a0 < rowOf.x0).toBe(rowOf.b1 < rowOf.a1);
  });

  it('lays out a few hundred tangled services quickly and deterministically', () => {
    const all = Array.from({ length: 300 }, (_, index) =>
      service(
        `svc-${index}`,
        [index * 7 + 3, index * 13 + 1, index - 1].map((n) => `svc-${n % 300}`),
      ),
    );

    const started = performance.now();
    const first = layoutDependencyGraph(all, null);
    expect(performance.now() - started).toBeLessThan(1000);

    expect(first.nodes).toHaveLength(300);
    expect(layoutDependencyGraph([...all].reverse(), null).nodes).toEqual(first.nodes);
  });
});

describe('neighbourInDirection', () => {
  const layout = layoutDependencyGraph(
    [service('web', ['api', 'auth']), service('api', ['db']), service('auth'), service('db')],
    null,
  );
  const at = (id: string) => layout.nodes.find((node) => node.service.id === id)!;

  it('moves within a column', () => {
    const column = layout.nodes.filter((node) => node.layer === at('db').layer);
    const top = column.find((node) => node.row === 0)!.service.id;
    const bottom = column.find((node) => node.row === 1)!.service.id;

    expect(neighbourInDirection(layout, top, 'ArrowDown')).toBe(bottom);
    expect(neighbourInDirection(layout, bottom, 'ArrowUp')).toBe(top);
    expect(neighbourInDirection(layout, top, 'ArrowUp')).toBeNull();
  });

  it('moves across columns to the nearest service', () => {
    expect(neighbourInDirection(layout, 'web', 'ArrowLeft')).toBe('api');
    expect(neighbourInDirection(layout, 'api', 'ArrowRight')).toBe('web');
    expect(neighbourInDirection(layout, 'web', 'ArrowRight')).toBeNull();
  });
});
