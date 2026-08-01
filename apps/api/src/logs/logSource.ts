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
}

export interface LogService {
  id: string;
  ownerTeamId: string | null;
}

/**
 * Authorization seam for log access. The MVP policy permits every authenticated
 * user; ownership-aware enforcement belongs here before a real backend is wired.
 */
export function canViewLogs(_user: LogViewer, _service: LogService): boolean {
  return true;
}

export class InvalidLogCursorError extends Error {
  constructor(message = 'The log cursor is invalid for this query.') {
    super(message);
    this.name = 'InvalidLogCursorError';
  }
}
