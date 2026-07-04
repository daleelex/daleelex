import type { Service, TeamWithStats } from '../../types/catalog.types';

export interface DashboardStats {
  totalServices: number;
  totalTeams: number;
  tier1Count: number;
  docsCount: number;
}

export interface DashboardData {
  stats: DashboardStats;
  recentServices: Service[];
  teams: TeamWithStats[];
}