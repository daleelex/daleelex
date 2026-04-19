import type { ServiceListResponse, TeamListResponse, HealthResponse, ServiceDocListResponse, ServiceDoc, TechDocsIndexResponse } from '@daleelex/shared';

const BASE = '/api/v1';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const api = {
  health: () => get<HealthResponse>('/health'),
  services: () => get<ServiceListResponse>('/services'),
  teams: () => get<TeamListResponse>('/teams'),
  techDocsIndex: () => get<TechDocsIndexResponse>('/docs'),
  serviceDocs: (serviceId: string) => get<ServiceDocListResponse>(`/services/${serviceId}/docs`),
  serviceDoc: (serviceId: string, docId: number) => get<ServiceDoc>(`/services/${serviceId}/docs/${docId}`),
};
