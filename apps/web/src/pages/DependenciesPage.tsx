import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { Service } from '@daleelex/shared';
import { api } from '../api';
import {
  layoutDependencyGraph,
  neighbourInDirection,
  NODE_HEIGHT,
  NODE_WIDTH,
  type ArrowKey,
  type GraphEdge,
  type GraphLayout,
  type GraphNode,
} from '../lib/dependencyGraph';
import './DependenciesPage.css';

const ARROWS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

export function DependenciesPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['services'],
    queryFn: api.services,
  });
  const [params, setParams] = useSearchParams();
  const services = useMemo(() => data?.data ?? [], [data]);
  const sorted = useMemo(
    () => [...services].sort((a, b) => a.name.localeCompare(b.name)),
    [services],
  );

  const focus = services.find((service) => service.id === params.get('service')) ?? null;
  const layout = useMemo(
    () => layoutDependencyGraph(services, focus?.id ?? null),
    [services, focus?.id],
  );

  function setFocus(id: string | null) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set('service', id);
      else next.delete('service');
      return next;
    });
  }

  const upstream = layout.nodes.filter((node) => node.role === 'upstream').length;
  const downstream = layout.nodes.filter((node) => node.role === 'downstream').length;

  return (
    <div className="graph-body">
      <header className="graph-head">
        <div className="graph-kicker">Dependencies</div>
        <h1 className="graph-title">{focus ? focus.name : 'How services connect'}</h1>
        <p className="graph-sub">
          {focus ? (
            <>
              Everything <strong>{focus.name}</strong> relies on is to its left; everything that
              would notice if it went down is to its right.
            </>
          ) : (
            <>
              Each arrow points from a service to one it depends on, as declared in{' '}
              <code>catalog-info.yaml</code>. Pick a service to see what it relies on and what
              relies on it.
            </>
          )}
        </p>
      </header>

      <div className="graph-toolbar">
        <label className="graph-picker">
          <span>Focus on</span>
          <select
            value={focus?.id ?? ''}
            onChange={(event) => setFocus(event.target.value || null)}
            disabled={isLoading || isError}
          >
            <option value="">Whole catalogue</option>
            {sorted.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </label>

        {focus && (
          <>
            <dl className="graph-stats">
              <div>
                <dt>Depends on</dt>
                <dd>{upstream}</dd>
              </div>
              <div>
                <dt>Used by</dt>
                <dd>{downstream}</dd>
              </div>
            </dl>
            <Link className="graph-action" to={`/services?service=${encodeURIComponent(focus.id)}`}>
              Open details
            </Link>
            <button type="button" className="graph-action" onClick={() => setFocus(null)}>
              Show whole catalogue
            </button>
          </>
        )}
      </div>

      {isLoading && <p className="graph-state">Loading the catalogue…</p>}
      {isError && <p className="graph-state">The catalogue could not be loaded.</p>}

      {!isLoading && !isError && (
        <>
          {layout.nodes.length === 0 ? (
            <p className="graph-state">
              No service declares a dependency yet. Add a <code>dependencies</code> list to a{' '}
              <code>catalog-info.yaml</code> and it will appear here.
            </p>
          ) : (
            <>
              <Legend hasCycles={layout.edges.some((edge) => edge.cycle)} />
              <Graph layout={layout} focusId={focus?.id ?? null} onSelect={setFocus} />
            </>
          )}

          {layout.isolated.length > 0 && (
            <details className="graph-isolated">
              <summary>
                {layout.isolated.length} service{layout.isolated.length === 1 ? '' : 's'} with no
                dependencies in either direction
              </summary>
              <ul>
                {layout.isolated.map((service) => (
                  <li key={service.id}>
                    <button type="button" onClick={() => setFocus(service.id)}>
                      {service.name}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function Graph({
  layout,
  focusId,
  onSelect,
}: {
  layout: GraphLayout;
  focusId: string | null;
  onSelect: (id: string) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [tabStop, setTabStop] = useState<string | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const scroller = useRef<HTMLDivElement>(null);

  // A new focus is a new drawing, so the old scroll position means nothing.
  // Centre the focused service, so what it depends on and what depends on it
  // both start in view; with no focus, start from the top left.
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const node = layout.nodes.find((entry) => entry.service.id === focusId);
    element.scrollTo({
      left: node ? Math.max(0, node.x + NODE_WIDTH / 2 - element.clientWidth / 2) : 0,
      top: node ? Math.max(0, node.y + NODE_HEIGHT / 2 - element.clientHeight / 2) : 0,
    });
  }, [layout, focusId]);

  const byId = useMemo(
    () => new Map(layout.nodes.map((node) => [node.service.id, node])),
    [layout],
  );
  // Exactly one node is in the tab order; the arrow keys move between the rest.
  const reachable =
    tabStop && byId.has(tabStop) ? tabStop : (focusId ?? layout.nodes[0].service.id);
  const active = hovered ?? focusId;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!ARROWS.has(event.key)) return;
    const id = (event.target as HTMLElement).dataset.nodeId;
    if (!id) return;
    const target = neighbourInDirection(layout, id, event.key as ArrowKey);
    event.preventDefault();
    if (target) buttons.current.get(target)?.focus();
  }

  return (
    <div className="graph-scroll" ref={scroller}>
      <div
        className="graph-canvas"
        style={{ width: layout.width, height: layout.height }}
        role="group"
        aria-label="Dependency graph. Use the arrow keys to move between services."
        onKeyDown={handleKeyDown}
      >
        <svg className="graph-edges" width={layout.width} height={layout.height} aria-hidden="true">
          <defs>
            {(['plain', 'active', 'cycle'] as const).map((kind) => (
              <marker
                key={kind}
                id={`graph-arrow-${kind}`}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M0,0 L10,5 L0,10 z" className={`graph-arrow ${kind}`} />
              </marker>
            ))}
          </defs>
          {layout.edges.map((edge) => {
            const touches = active !== null && (edge.from === active || edge.to === active);
            const kind = edge.cycle ? 'cycle' : touches ? 'active' : 'plain';
            return (
              <path
                key={`${edge.from}->${edge.to}`}
                d={edgePath(byId.get(edge.from)!, byId.get(edge.to)!, edge)}
                className={`graph-edge ${kind}${active !== null && !touches ? ' dim' : ''}`}
                markerEnd={`url(#graph-arrow-${kind})`}
              />
            );
          })}
        </svg>

        {layout.nodes.map((node) => (
          <NodeButton
            key={node.service.id}
            node={node}
            tabbable={node.service.id === reachable}
            onSelect={onSelect}
            onHover={setHovered}
            onFocus={setTabStop}
            register={(element) => {
              if (element) buttons.current.set(node.service.id, element);
              else buttons.current.delete(node.service.id);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function NodeButton({
  node,
  tabbable,
  onSelect,
  onHover,
  onFocus,
  register,
}: {
  node: GraphNode;
  tabbable: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onFocus: (id: string) => void;
  register: (element: HTMLButtonElement | null) => void;
}) {
  const { service } = node;
  const owner = service.owner?.name ?? null;

  return (
    <button
      ref={register}
      type="button"
      data-node-id={service.id}
      className={`graph-node graph-tier-${service.tier} role-${node.role}`}
      style={{ left: node.x, top: node.y, width: NODE_WIDTH, height: NODE_HEIGHT }}
      tabIndex={tabbable ? 0 : -1}
      aria-current={node.role === 'focus' ? 'true' : undefined}
      aria-label={describe(service, node)}
      onClick={() => onSelect(service.id)}
      onMouseEnter={() => onHover(service.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => {
        onFocus(service.id);
        onHover(service.id);
      }}
      onBlur={() => onHover(null)}
    >
      <span className="graph-node-name">{service.name}</span>
      <span className="graph-node-meta">
        <span className="graph-node-tier">T{service.tier}</span>
        <span className={owner ? 'graph-node-owner' : 'graph-node-owner unowned'}>
          {owner ?? 'Unowned'}
        </span>
      </span>
    </button>
  );
}

function Legend({ hasCycles }: { hasCycles: boolean }) {
  return (
    <ul className="graph-legend" aria-label="Legend">
      <li>
        <span className="graph-legend-swatch graph-tier-1" /> Tier 1
      </li>
      <li>
        <span className="graph-legend-swatch graph-tier-2" /> Tier 2
      </li>
      <li>
        <span className="graph-legend-swatch graph-tier-3" /> Tier 3
      </li>
      {hasCycles && (
        <li>
          <span className="graph-legend-cycle" /> Part of a dependency cycle
        </li>
      )}
    </ul>
  );
}

/**
 * From the dependent's left edge to the dependency's right edge. A cycle edge
 * runs the other way across the page, so it bows out below both nodes instead
 * of cutting back through the columns between them.
 */
function edgePath(from: GraphNode, to: GraphNode, edge: GraphEdge): string {
  const startX = from.x;
  const startY = from.y + NODE_HEIGHT / 2;
  const endX = to.x + NODE_WIDTH;
  const endY = to.y + NODE_HEIGHT / 2;

  if (edge.cycle || endX >= startX) {
    const drop = Math.max(startY, endY) + NODE_HEIGHT;
    return `M${startX},${startY} C${startX - 60},${drop} ${endX + 60},${drop} ${endX},${endY}`;
  }
  const bend = (startX - endX) / 2;
  return `M${startX},${startY} C${startX - bend},${startY} ${endX + bend},${endY} ${endX},${endY}`;
}

function describe(service: Service, node: GraphNode): string {
  const owner = service.owner?.name ? `owned by ${service.owner.name}` : 'no owner';
  const role =
    node.role === 'focus'
      ? ', focused'
      : node.role === 'upstream'
        ? ', a dependency'
        : node.role === 'downstream'
          ? ', depends on the focused service'
          : '';
  return `${service.name}, tier ${service.tier}, ${owner}${role}`;
}
