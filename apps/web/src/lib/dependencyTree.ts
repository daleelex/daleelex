import type { Service } from '@daleelex/shared';

export const MAX_DEPTH = 4;
export const MAX_CHILDREN = 8;

export interface TreeNode {
  service: Service;
  depth: number;
  children: TreeNode[];
  /** This id already appears on the path above, so the walk stopped here. */
  cycle: boolean;
  /** Children left out by MAX_CHILDREN. */
  overflow: number;
  /** Children left out because MAX_DEPTH was reached. */
  truncated: boolean;
}

export type Direction = 'upstream' | 'downstream';

/**
 * Walks the dependency graph from one service.
 *
 * "upstream" follows what each service declares it depends on; "downstream"
 * follows the reverse — who would notice if this went away. Real catalogues
 * contain cycles and services with dozens of dependents, so the walk is
 * bounded on both: depth, and children per node.
 */
export function buildDependencyTree(
  root: Service,
  services: Service[],
  direction: Direction,
): TreeNode {
  const byId = new Map(services.map((service) => [service.id, service]));

  const dependents = new Map<string, Service[]>();
  if (direction === 'downstream') {
    for (const service of services) {
      for (const id of service.dependencies) {
        const list = dependents.get(id) ?? [];
        list.push(service);
        dependents.set(id, list);
      }
    }
  }

  function neighbours(service: Service): Service[] {
    if (direction === 'downstream') return dependents.get(service.id) ?? [];
    return service.dependencies
      .map((id) => byId.get(id))
      .filter((entry): entry is Service => !!entry);
  }

  function walk(service: Service, depth: number, ancestors: Set<string>): TreeNode {
    const node: TreeNode = {
      service,
      depth,
      children: [],
      cycle: false,
      overflow: 0,
      truncated: false,
    };

    if (ancestors.has(service.id)) {
      node.cycle = true;
      return node;
    }

    const all = neighbours(service);
    if (all.length === 0) return node;

    if (depth >= MAX_DEPTH) {
      node.truncated = true;
      return node;
    }

    const shown = all.slice(0, MAX_CHILDREN);
    node.overflow = all.length - shown.length;
    const path = new Set(ancestors).add(service.id);
    node.children = shown.map((child) => walk(child, depth + 1, path));
    return node;
  }

  return walk(root, 0, new Set());
}

/** Every node below the root, flattened in render order. */
export function flatten(node: TreeNode): TreeNode[] {
  return node.children.flatMap((child) => [child, ...flatten(child)]);
}
