import type { ManagementSource, ServiceTier, ServiceType, TeamWithStats } from '@daleelex/shared';
import { weightedScore } from './scorecard.js';

export interface TeamRow {
  id: string;
  name: string;
  slackChannel: string | null;
  onCallSchedule: string | null;
  managementSource: string;
  services: {
    id: string;
    name: string;
    type: string;
    tier: number;
  }[];
}

export interface ScorecardResultRow {
  serviceId: string;
  checkId: string;
  status: string;
  message: string | null;
  ranAt: Date;
  check: {
    weight: number;
    enabled: boolean;
  };
}

export function buildTeamStats(
  teams: TeamRow[],
  scorecardResults: ScorecardResultRow[],
): TeamWithStats[] {
  const latestByServiceAndCheck = new Map<string, ScorecardResultRow>();

  for (const result of scorecardResults) {
    const key = `${result.serviceId}:${result.checkId}`;
    const current = latestByServiceAndCheck.get(key);
    if (!current || result.ranAt > current.ranAt) {
      latestByServiceAndCheck.set(key, result);
    }
  }

  const latestByService = new Map<string, ScorecardResultRow[]>();
  for (const result of latestByServiceAndCheck.values()) {
    if (!result.check.enabled) continue;
    const results = latestByService.get(result.serviceId) ?? [];
    results.push(result);
    latestByService.set(result.serviceId, results);
  }

  return teams.map((team) => {
    const services = team.services.map((service) => {
      const results = latestByService.get(service.id) ?? [];
      const ownershipResult = results.find((result) => result.checkId === 'owner-assigned');

      return {
        id: service.id,
        name: service.name,
        type: service.type as ServiceType,
        tier: service.tier as ServiceTier,
        scorecardHealth: weightedScore(
          results.map((result) => ({ status: result.status, weight: result.check.weight })),
        ),
        hasOwnershipGap: ownershipResult?.status === 'fail',
      };
    });

    const scoredServices = services.filter(
      (service): service is typeof service & { scorecardHealth: number } =>
        service.scorecardHealth !== null,
    );
    const openOwnershipGaps = services
      .filter((service) => service.hasOwnershipGap)
      .map((service) => {
        const result = latestByServiceAndCheck.get(`${service.id}:owner-assigned`);
        return {
          serviceId: service.id,
          serviceName: service.name,
          message: result?.message ?? null,
        };
      });

    return {
      id: team.id,
      name: team.name,
      slackChannel: team.slackChannel,
      onCallSchedule: team.onCallSchedule,
      managementSource: team.managementSource as ManagementSource,
      serviceCount: services.length,
      tier1Count: services.filter((service) => service.tier === 1).length,
      tier2Count: services.filter((service) => service.tier === 2).length,
      tier3Count: services.filter((service) => service.tier === 3).length,
      averageScorecardHealth:
        scoredServices.length > 0
          ? Math.round(
              scoredServices.reduce((sum, service) => sum + service.scorecardHealth, 0) /
                scoredServices.length,
            )
          : null,
      scoredServiceCount: scoredServices.length,
      openOwnershipGaps,
      services,
    };
  });
}
