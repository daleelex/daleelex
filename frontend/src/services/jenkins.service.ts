import { api } from '../providers/api-client';
import type { JenkinsHealthResponse, JenkinsConfigResponse, JenkinsConfigRequest, JenkinsTestResponse } from '../types/jenkins.types';

export const JenkinsApi = {
  async health(): Promise<JenkinsHealthResponse> {
    const { data } = await api.get('/integrations/jenkins/health');
    return data;
  },

  async getConfig(): Promise<JenkinsConfigResponse> {
    const { data } = await api.get('/integrations/jenkins');
    return data;
  },

  async saveConfig(payload: JenkinsConfigRequest): Promise<JenkinsConfigResponse> {
    const { data } = await api.put('/integrations/jenkins', payload);
    return data;
  },

  async testConnection(payload: JenkinsConfigRequest): Promise<JenkinsTestResponse> {
    const { data } = await api.post('/integrations/jenkins/test', payload);
    return data;
  },
};