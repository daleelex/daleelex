import type { ServiceLogEntry } from '@daleelex/shared';

export interface LogSelector {
  serviceId: string;
}

export interface LogQuery {
  selector: LogSelector;
  start: string;
  end: string;
  search?: string;
  cursor?: string;
  limit: number;
}

export interface LogPage {
  entries: ServiceLogEntry[];
  nextCursor: string | null;
}

export interface LogSource {
  query(query: LogQuery): Promise<LogPage>;
}

export interface LogViewer {
  id: string;
  isAdmin: boolean;
}

export interface LogService {
  id: string;
  ownerTeamId: string | null;
}

/**
 * Authorization seam for log access. Admins only, for now: real logs can carry
 * secrets and customer data, and the schema has no user-to-team membership yet, so
 * "the owning team can see its own logs" cannot be checked. Once membership exists,
 * widen this to members of `service.ownerTeamId` — the route needs no change.
 */
export function canViewLogs(user: LogViewer, _service: LogService): boolean {
  return user.isAdmin;
}

export class InvalidLogCursorError extends Error {
  constructor(message = 'The log cursor is invalid for this query.') {
    super(message);
    this.name = 'InvalidLogCursorError';
  }
}

/** The log backend could not answer — unreachable, or it rejected the query. */
export class LogSourceUnavailableError extends Error {
  constructor(message = 'The log backend is unavailable.') {
    super(message);
    this.name = 'LogSourceUnavailableError';
  }
}
