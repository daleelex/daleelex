import type { Service } from '@daleelex/shared';

export const NODE_WIDTH = 208;
export const NODE_HEIGHT = 56;
export const COLUMN_GAP = 96;
export const ROW_GAP = 14;
export const PADDING = 24;

/** Ordering passes over the layers. More stop paying for themselves quickly. */
const SWEEPS = 6;

export type NodeRole = 'focus' | 'upstream' | 'downstream' | 'none';

export interface GraphNode {
  service: Service;
  /** Column. Services that depend on nothing sit in column 0, on the left. */
  layer: number;
  /** Position within the column, top to bottom. */
  row: number;
  x: number;
  y: number;
  role: NodeRole;
}

export interface GraphEdge {
  /** The service that declares the dependency. */
  from: string;
  /** The service it depends on. */
  to: string;
  /** Part of a dependency cycle, so it could not point leftwards. */
  cycle: boolean;
}

export interface GraphLayout {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
  /** Overview only: services with no dependencies in either direction, left out of the drawing. */
  isolated: Service[];
}

/**
 * Lays out the dependency graph as columns: what a service depends on is to
 * its left, what depends on it is to its right.
 *
 * With `focusId`, only that service and everything it reaches in either
 * direction is drawn. Without it, every service that has a dependency in
 * either direction is drawn and the rest are returned as `isolated`.
 *
 * Hand-rolled rather than a graph library: a longest-path layering plus a few
 * barycentre passes to reduce crossings is enough at catalogue scale, and
 * keeps a few hundred kilobytes of layout engine out of the bundle.
 */
export function layoutDependencyGraph(services: Service[], focusId: string | null): GraphLayout {
  const byId = new Map(services.map((service) => [service.id, service]));
  const dependsOn = new Map<string, string[]>();
  const usedBy = new Map<string, string[]>();

  for (const service of sortByName(services)) {
    const targets = unique(service.dependencies).filter((id) => id !== service.id && byId.has(id));
    dependsOn.set(service.id, targets);
    for (const target of targets) {
      const list = usedBy.get(target) ?? [];
      list.push(service.id);
      usedBy.set(target, list);
    }
  }

  const focus = focusId ? (byId.get(focusId) ?? null) : null;
  const upstream = focus ? reach(focus.id, dependsOn) : new Set<string>();
  const downstream = focus ? reach(focus.id, usedBy) : new Set<string>();

  let included: Service[];
  let isolated: Service[] = [];
  if (focus) {
    included = services.filter(
      (service) =>
        service.id === focus.id || upstream.has(service.id) || downstream.has(service.id),
    );
  } else {
    const connected = (id: string) =>
      (dependsOn.get(id)?.length ?? 0) > 0 || (usedBy.get(id)?.length ?? 0) > 0;
    included = services.filter((service) => connected(service.id));
    isolated = sortByName(services.filter((service) => !connected(service.id)));
  }

  const ids = new Set(included.map((service) => service.id));
  const ordered = sortByName(included);
  const edges: GraphEdge[] = [];
  for (const service of ordered) {
    for (const target of dependsOn.get(service.id) ?? []) {
      if (ids.has(target)) edges.push({ from: service.id, to: target, cycle: false });
    }
  }

  markCycles(ordered, edges);
  const layerOf = assignLayers(ordered, edges);
  const columns = orderColumns(ordered, edges, layerOf);

  const tallest = Math.max(0, ...columns.map((column) => column.length));
  const rowHeight = NODE_HEIGHT + ROW_GAP;
  const nodes: GraphNode[] = [];
  columns.forEach((column, layer) => {
    // Centre short columns against the tallest, so edges run mostly level.
    const offset = ((tallest - column.length) * rowHeight) / 2;
    column.forEach((id, row) => {
      const service = byId.get(id)!;
      nodes.push({
        service,
        layer,
        row,
        x: PADDING + layer * (NODE_WIDTH + COLUMN_GAP),
        y: PADDING + offset + row * rowHeight,
        role: !focus
          ? 'none'
          : id === focus.id
            ? 'focus'
            : upstream.has(id)
              ? 'upstream'
              : 'downstream',
      });
    });
  });

  return {
    nodes,
    edges,
    width:
      columns.length === 0
        ? 0
        : PADDING * 2 + columns.length * NODE_WIDTH + (columns.length - 1) * COLUMN_GAP,
    height: tallest === 0 ? 0 : PADDING * 2 + tallest * rowHeight - ROW_GAP,
    isolated,
  };
}

/** Every service reachable from `start` along `next`, not counting `start`. */
export function reach(start: string, next: ReadonlyMap<string, string[]>): Set<string> {
  const seen = new Set<string>();
  const stack = [...(next.get(start) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (id === start || seen.has(id)) continue;
    seen.add(id);
    stack.push(...(next.get(id) ?? []));
  }
  return seen;
}

export type ArrowKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';

/**
 * The node an arrow key should move to from `id`: up and down within a
 * column, left and right to the nearest row of the next non-empty column.
 * Null at an edge of the drawing.
 */
export function neighbourInDirection(
  layout: GraphLayout,
  id: string,
  key: ArrowKey,
): string | null {
  const current = layout.nodes.find((node) => node.service.id === id);
  if (!current) return null;

  if (key === 'ArrowUp' || key === 'ArrowDown') {
    const row = current.row + (key === 'ArrowUp' ? -1 : 1);
    const target = layout.nodes.find((node) => node.layer === current.layer && node.row === row);
    return target?.service.id ?? null;
  }

  const step = key === 'ArrowLeft' ? -1 : 1;
  const layers = new Set(layout.nodes.map((node) => node.layer));
  for (let layer = current.layer + step; layers.has(layer); layer += step) {
    const column = layout.nodes.filter((node) => node.layer === layer);
    if (column.length === 0) continue;
    const centre = current.y + NODE_HEIGHT / 2;
    const nearest = column.reduce((best, node) =>
      Math.abs(node.y + NODE_HEIGHT / 2 - centre) < Math.abs(best.y + NODE_HEIGHT / 2 - centre)
        ? node
        : best,
    );
    return nearest.service.id;
  }
  return null;
}

/**
 * Flags the edges that close a cycle. Depth-first from each service in name
 * order, so the same catalogue always breaks its cycles at the same edge.
 */
function markCycles(services: Service[], edges: GraphEdge[]) {
  const outgoing = new Map<string, GraphEdge[]>();
  for (const edge of edges) {
    const list = outgoing.get(edge.from) ?? [];
    list.push(edge);
    outgoing.set(edge.from, list);
  }

  const state = new Map<string, 'open' | 'done'>();
  for (const service of services) {
    if (state.has(service.id)) continue;
    // Iterative, so a long chain of dependencies cannot overflow the stack.
    const stack: { id: string; next: number }[] = [{ id: service.id, next: 0 }];
    state.set(service.id, 'open');
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const out = outgoing.get(frame.id) ?? [];
      if (frame.next >= out.length) {
        state.set(frame.id, 'done');
        stack.pop();
        continue;
      }
      const edge = out[frame.next++];
      const seen = state.get(edge.to);
      if (seen === 'open') edge.cycle = true;
      else if (!seen) {
        state.set(edge.to, 'open');
        stack.push({ id: edge.to, next: 0 });
      }
    }
  }
}

/** Longest path to a service with no dependencies, ignoring cycle edges. */
function assignLayers(services: Service[], edges: GraphEdge[]): Map<string, number> {
  const targets = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.cycle) continue;
    const list = targets.get(edge.from) ?? [];
    list.push(edge.to);
    targets.set(edge.from, list);
  }

  const layer = new Map<string, number>();
  // Without cycle edges the graph is acyclic, so repeated relaxation settles
  // in at most one pass per service; iterating avoids deep recursion.
  for (const service of services) layer.set(service.id, 0);
  let changed = true;
  for (let pass = 0; changed && pass <= services.length; pass += 1) {
    changed = false;
    for (const service of services) {
      const deps = targets.get(service.id) ?? [];
      const want = deps.length === 0 ? 0 : 1 + Math.max(...deps.map((id) => layer.get(id)!));
      if (want !== layer.get(service.id)) {
        layer.set(service.id, want);
        changed = true;
      }
    }
  }
  return layer;
}

/** Orders each column to keep edges short and uncrossed, by barycentre. */
function orderColumns(
  services: Service[],
  edges: GraphEdge[],
  layerOf: Map<string, number>,
): string[][] {
  const count = services.length === 0 ? 0 : Math.max(...layerOf.values()) + 1;
  const columns: string[][] = Array.from({ length: count }, () => []);
  for (const service of services) columns[layerOf.get(service.id)!].push(service.id);

  const left = new Map<string, string[]>();
  const right = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.cycle) continue;
    left.set(edge.from, [...(left.get(edge.from) ?? []), edge.to]);
    right.set(edge.to, [...(right.get(edge.to) ?? []), edge.from]);
  }

  // Positions as a fraction of column height, so columns of different sizes compare.
  const position = new Map<string, number>();
  const record = (column: string[]) =>
    column.forEach((id, index) => position.set(id, (index + 0.5) / column.length));
  columns.forEach(record);

  const reorder = (column: string[], neighbours: Map<string, string[]>) => {
    const weight = new Map(
      column.map((id) => {
        const near = neighbours.get(id) ?? [];
        return [
          id,
          near.length === 0
            ? position.get(id)!
            : near.reduce((sum, other) => sum + position.get(other)!, 0) / near.length,
        ];
      }),
    );
    // Array.prototype.sort is stable, so ties keep their previous order.
    column.sort((a, b) => weight.get(a)! - weight.get(b)!);
    record(column);
  };

  for (let sweep = 0; sweep < SWEEPS; sweep += 1) {
    for (let layer = 1; layer < count; layer += 1) reorder(columns[layer], left);
    for (let layer = count - 2; layer >= 0; layer -= 1) reorder(columns[layer], right);
  }
  return columns;
}

function sortByName(services: Service[]): Service[] {
  return [...services].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
