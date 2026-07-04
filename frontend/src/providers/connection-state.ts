/**
 * Connection State
 *
 * Framework-agnostic observable that tracks backend connectivity.
 * The Axios interceptor calls onSuccess/onFailure.
 * React subscribes via useSyncExternalStore in the provider.
 *
 * Three states:
 *  - connected:    0 consecutive failures → normal operation
 *  - degraded:     1–4 consecutive failures → show dismissible banner
 *  - disconnected: 5+ consecutive failures → full-page takeover
 *
 * Why not Redux? This needs to live outside React (Axios interceptors fire
 * before React renders). A simple pub/sub keeps the dependency chain clean.
 */

export type ConnectionStatus = 'connected' | 'degraded' | 'disconnected';

interface ConnectionSnapshot {
  status: ConnectionStatus;
  consecutiveFailures: number;
  lastFailureAt: Date | null;
  lastSuccessAt: Date | null;
}

type Listener = () => void;

const DEGRADED_THRESHOLD = 1;
const DISCONNECTED_THRESHOLD = 5;

let state: ConnectionSnapshot = {
  status: 'connected',
  consecutiveFailures: 0,
  lastFailureAt: null,
  lastSuccessAt: null,
};

const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn());
}

function deriveStatus(failures: number): ConnectionStatus {
  if (failures >= DISCONNECTED_THRESHOLD) return 'disconnected';
  if (failures >= DEGRADED_THRESHOLD) return 'degraded';
  return 'connected';
}

export const connectionState = {
  /** Called by Axios interceptor on successful response */
  onSuccess() {
    if (state.consecutiveFailures === 0 && state.status === 'connected') return;

    state = {
      status: 'connected',
      consecutiveFailures: 0,
      lastFailureAt: state.lastFailureAt,
      lastSuccessAt: new Date(),
    };
    notify();
  },

  /** Called by Axios interceptor on connection-level failure */
  onFailure() {
    const failures = state.consecutiveFailures + 1;

    state = {
      status: deriveStatus(failures),
      consecutiveFailures: failures,
      lastFailureAt: new Date(),
      lastSuccessAt: state.lastSuccessAt,
    };
    notify();
  },

  /** Manual reset (e.g., after successful retry from the UI) */
  reset() {
    state = {
      status: 'connected',
      consecutiveFailures: 0,
      lastFailureAt: state.lastFailureAt,
      lastSuccessAt: new Date(),
    };
    notify();
  },

  // ── useSyncExternalStore API ────────────────────────────────────────────
  getSnapshot(): ConnectionSnapshot {
    return state;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
