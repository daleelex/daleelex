import { api } from '../providers/api-client';
import type { TechDocsIndexResponse, ServiceDocListResponse, ServiceDocContent } from '../types/catalog.types';

export const DocsApi = {
  async index(): Promise<TechDocsIndexResponse> {
    const { data } = await api.get('/docs');
    return data;
  },

  async forService(serviceId: string): Promise<ServiceDocListResponse> {
    const { data } = await api.get(`/services/${serviceId}/docs`);
    return data;
  },

  async content(serviceId: string, docId: number): Promise<ServiceDocContent> {
    const { data } = await api.get(`/services/${serviceId}/docs/${docId}`);
    return data;
  },
};