import { ServiceType, ServiceTier } from '../common/enums/catalog.enums';

export interface TeamServiceSummary {
  id: string;
  name: string;
  type: ServiceType;
  tier: ServiceTier;
}

export interface TeamSummary {
  id: string;
  name: string;
  slackChannel: string | null;
  onCallSchedule: string | null;
  serviceCount: number;
  tier1Count: number;
  tier2Count: number;
  tier3Count: number;
  topServices: TeamServiceSummary[];
}

export interface TeamListResponse {
  data: TeamSummary[];
  total: number;
}
