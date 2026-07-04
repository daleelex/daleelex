import { api } from '../providers/api-client';
import type { ServiceListResponse, Service, CreateServiceRequest } from '../types/catalog.types';

export const ServicesApi = {
  async getAll(): Promise<ServiceListResponse> {
    const { data } = await api.get('/services');
    console.log('ServicesApi.getAll data:', data);
    return data;
  },

  async create(payload: CreateServiceRequest): Promise<Service> {
    const { data } = await api.post('/services', payload);
    return data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/services/${id}`);
  },
};