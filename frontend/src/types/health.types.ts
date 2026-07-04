export interface HealthResponse {
  status: 'up' | 'down';
  version: string;
  dateTime: string;
}