import { describe, expect, it } from 'vitest';
import { buildDependencyTree, flatten, MAX_CHILDREN, MAX_DEPTH } from './dependencyTree';
import type { Service } from '@daleelex/shared';

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

const ids = (node: ReturnType<typeof buildDependencyTree>) =>
  flatten(node).map((child) => child.service.id);

describe('buildDependencyTree upstream', () => {
  it('follows dependencies through several levels', () => {
    const all = [service('a', ['b']), service('b', ['c']), service('c', ['d']), service('d')];

    expect(ids(buildDependencyTree(all[0], all, 'upstream'))).toEqual(['b', 'c', 'd']);
  });

  it('ignores a dependency on a service that is not in the catalogue', () => {
    const all = [service('a', ['b', 'ghost']), service('b')];

    expect(ids(buildDependencyTree(all[0], all, 'upstream'))).toEqual(['b']);
  });

  it('stops at a cycle instead of recursing forever', () => {
    const all = [service('a', ['b']), service('b', ['c']), service('c', ['a'])];

    const tree = buildDependencyTree(all[0], all, 'upstream');
    const nodes = flatten(tree);

    expect(nodes.map((n) => n.service.id)).toEqual(['b', 'c', 'a']);
    expect(nodes.at(-1)).toMatchObject({ service: { id: 'a' }, cycle: true, children: [] });
  });

  it('survives a service that depends on itself', () => {
    const all = [service('a', ['a'])];

    const nodes = flatten(buildDependencyTree(all[0], all, 'upstream'));
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ cycle: true, children: [] });
  });

  it('stops at the depth limit and marks the node', () => {
    const all = Array.from({ length: 10 }, (_, i) => service(`s${i}`, i < 9 ? [`s${i + 1}`] : []));

    const nodes = flatten(buildDependencyTree(all[0], all, 'upstream'));

    expect(nodes).toHaveLength(MAX_DEPTH);
    expect(nodes.at(-1)).toMatchObject({ depth: MAX_DEPTH, truncated: true });
  });

  it('caps fan-out and counts what it left out', () => {
    const children = Array.from({ length: MAX_CHILDREN + 5 }, (_, i) => service(`c${i}`));
    const root = service(
      'root',
      children.map((child) => child.id),
    );

    const tree = buildDependencyTree(root, [root, ...children], 'upstream');

    expect(tree.children).toHaveLength(MAX_CHILDREN);
    expect(tree.overflow).toBe(5);
  });
});

describe('buildDependencyTree downstream', () => {
  it('follows the edges backwards', () => {
    const all = [service('db'), service('api', ['db']), service('web', ['api'])];

    expect(ids(buildDependencyTree(all[0], all, 'downstream'))).toEqual(['api', 'web']);
  });

  it('is empty for a service nothing depends on', () => {
    const all = [service('a', ['b']), service('b')];

    expect(ids(buildDependencyTree(all[0], all, 'downstream'))).toEqual([]);
  });
});
