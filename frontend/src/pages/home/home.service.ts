import { ServicesApi } from '../../services/services.service';
import { TeamsApi } from '../../services/teams.service';
import { DocsApi } from '../../services/docs.service';
import type { DashboardData } from './home.types';

export const HomeService = {
  async getDashboard(): Promise<DashboardData> {
    const [services, teams, docs] = await Promise.all([
      ServicesApi.getAll(),
      TeamsApi.getAll(),
      DocsApi.index(),
    ]);

    const tier1Count = services.data.filter((s) => s.tier === 1).length;
    const docsCount = docs.data.reduce((sum, group) => sum + group.docs.length, 0);

    return {
      stats: { totalServices: services.total, totalTeams: teams.total, tier1Count, docsCount },
      recentServices: services.data.slice(0, 6),
      teams: teams.data.slice(0, 4),
    };
  },
};