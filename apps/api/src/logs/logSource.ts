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
  /** Teams the viewer belongs to. Callers may pass only the ones relevant to the check. */
  teamIds: readonly string[];
}

export interface LogService {
  id: string;
  ownerTeamId: string | null;
}

/**
 * Authorization seam for log access. Real logs can carry secrets and customer data,
 * so access is narrow: admins, plus members of the service's owning team. A service
 * with no owner has no team to grant access through, so it stays admin-only.
 */
export function canViewLogs(user: LogViewer, service: LogService): boolean {
  if (user.isAdmin) return true;
  return service.ownerTeamId !== null && user.teamIds.includes(service.ownerTeamId);
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
