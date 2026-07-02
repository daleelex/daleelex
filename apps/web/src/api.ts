import type { ServiceListResponse, TeamListResponse, HealthResponse, ServiceDocListResponse, ServiceDoc, TechDocsIndexResponse, JenkinsHealthResponse, JenkinsConfigResponse, JenkinsConfigRequest, JenkinsTestResponse, CreateServiceRequest, Service } from '@daleelex/shared';

const BASE = '/api/v1';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `${res.status} ${res.statusText}`);
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => get<HealthResponse>('/health'),
  services: () => get<ServiceListResponse>('/services'),
  teams: () => get<TeamListResponse>('/teams'),
  techDocsIndex: () => get<TechDocsIndexResponse>('/docs'),
  serviceDocs: (serviceId: string) => get<ServiceDocListResponse>(`/services/${serviceId}/docs`),
  serviceDoc: (serviceId: string, docId: number) => get<ServiceDoc>(`/services/${serviceId}/docs/${docId}`),
  jenkinsHealth: () => get<JenkinsHealthResponse>('/integrations/jenkins/health'),
  jenkinsConfig: () => get<JenkinsConfigResponse>('/integrations/jenkins'),
  saveJenkinsConfig: (body: JenkinsConfigRequest) => put<JenkinsConfigResponse>('/integrations/jenkins', body),
  testJenkinsConnection: (body: JenkinsConfigRequest) => post<JenkinsTestResponse>('/integrations/jenkins/test', body),
  createService: (body: CreateServiceRequest) => post<Service>('/services', body),
  deleteService: (id: string) => del(`/services/${id}`),
};
