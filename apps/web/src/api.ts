import type {
  ServiceListResponse,
  TeamListResponse,
  HealthResponse,
  StatsResponse,
  ServiceDocListResponse,
  ServiceDoc,
  TechDocsIndexResponse,
  JenkinsHealthResponse,
  JenkinsConfigResponse,
  JenkinsConfigRequest,
  JenkinsTestResponse,
  CreateServiceRequest,
  Service,
  MeResponse,
  UploadServiceDocRequest,
  UploadServiceDocResponse,
} from '@daleelex/shared';

const BASE = '/api/v1';

type ApiErrorPayload = {
  error?: string | { message?: string };
  message?: string;
};

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw await toApiError(res);
  return res.json() as Promise<T>;
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw await toApiError(res);
  }
  return res.json() as Promise<T>;
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' });
  if (!res.ok) {
    throw await toApiError(res);
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw await toApiError(res);
  }
  return res.json() as Promise<T>;
}

async function getWithAuth<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw await toApiError(res);
  return res.json() as Promise<T>;
}

async function postWithAuth<T>(path: string, body: unknown, token: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await toApiError(res);
  return res.json() as Promise<T>;
}

async function toApiError(res: Response) {
  const body = (await res.json().catch(() => ({}))) as ApiErrorPayload;
  // Fastify's default error body puts the status phrase ("Conflict") in `error`
  // and the useful text in `message` — prefer the message.
  const message =
    (typeof body.error === 'object' ? body.error?.message : undefined) ??
    body.message ??
    (typeof body.error === 'string' ? body.error : undefined) ??
    `${res.status} ${res.statusText}`;

  return new Error(message);
}

export const api = {
  health: () => get<HealthResponse>('/health'),
  stats: () => get<StatsResponse>('/stats'),
  services: () => get<ServiceListResponse>('/services'),
  teams: () => get<TeamListResponse>('/teams'),
  techDocsIndex: () => get<TechDocsIndexResponse>('/docs'),
  serviceDocs: (serviceId: string) => get<ServiceDocListResponse>(`/services/${serviceId}/docs`),
  serviceDoc: (serviceId: string, docId: number) =>
    get<ServiceDoc>(`/services/${serviceId}/docs/${docId}`),
  uploadServiceDoc: (serviceId: string, body: UploadServiceDocRequest, token: string) =>
    postWithAuth<UploadServiceDocResponse>(`/services/${serviceId}/docs`, body, token),
  jenkinsHealth: () => get<JenkinsHealthResponse>('/integrations/jenkins/health'),
  jenkinsConfig: () => get<JenkinsConfigResponse>('/integrations/jenkins'),
  saveJenkinsConfig: (body: JenkinsConfigRequest) =>
    put<JenkinsConfigResponse>('/integrations/jenkins', body),
  testJenkinsConnection: (body: JenkinsConfigRequest) =>
    post<JenkinsTestResponse>('/integrations/jenkins/test', body),
  createService: (body: CreateServiceRequest) => post<Service>('/services', body),
  deleteService: (id: string) => del(`/services/${id}`),
  me: (token: string) => getWithAuth<MeResponse>('/me', token),
};
