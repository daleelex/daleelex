import { api } from '../providers/api-client';
import type { HealthResponse } from '../types/health.types';

export const HealthApi = {
  async check(): Promise<HealthResponse> {
    const { data } = await api.get('/health');
    return data;
  },
};