import { Injectable } from '@nestjs/common';
import { TeamsRepository } from './teams.repository';
import { ServiceType, ServiceTier } from '../common/enums/catalog.enums';
import { TeamListResponse } from './teams.interface';

const TOP_SERVICES_LIMIT = 4;

@Injectable()
export class TeamsService {
  public constructor(private readonly teamsRepository: TeamsRepository) {}

  public async findAll(): Promise<TeamListResponse> {
    const teams = await this.teamsRepository.findAllWithActiveServices();

    const data = teams.map((team) => ({
      id: team.id,
      name: team.name,
      slackChannel: team.slackChannel,
      onCallSchedule: team.onCallSchedule,
      serviceCount: team.services.length,
      tier1Count: team.services.filter((s) => s.tier === ServiceTier.TIER_1).length,
      tier2Count: team.services.filter((s) => s.tier === ServiceTier.TIER_2).length,
      tier3Count: team.services.filter((s) => s.tier === ServiceTier.TIER_3).length,
      topServices: team.services.slice(0, TOP_SERVICES_LIMIT).map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type as ServiceType,
        tier: s.tier as ServiceTier,
      })),
    }));

    return { data, total: data.length };
  }
}
