export interface HealthStatus {
  status: 'up' | 'down';
  version: string;
  dateTime: string;
}
