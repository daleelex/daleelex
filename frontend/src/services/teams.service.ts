import { api } from '../providers/api-client';
import type { TeamListResponse } from '../types/catalog.types';

export const TeamsApi = {
  async getAll(): Promise<TeamListResponse> {
    const { data } = await api.get('/teams');
    return data;
  },
};