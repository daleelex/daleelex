/**
 * API Client
 *
 * Centralized Axios instance with:
 *  - Base URL from env
 *  - Auth token injection
 *  - Response interceptor that tracks consecutive failures
 *  - Connection state events (no polling — reacts to real traffic)
 *
 * Every service file should import `api` from here instead of
 * creating its own axios/fetch instance.
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { connectionState } from './connection-state';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request: inject auth token ────────────────────────────────────────────────
// api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
//   const token = localStorage.getItem('access_token');
//   if (token && config.headers) {
//     config.headers.Authorization = `Bearer ${token}`;
//   }
//   return config;
// });

// ── Response: track connection health ─────────────────────────────────────────
api.interceptors.response.use(
  (response) => {
    // Any successful response = backend is alive
    connectionState.onSuccess();
    return response;
  },
  (error: AxiosError) => {
    if (isConnectionError(error)) {
      connectionState.onFailure();
    }

    // 401 → redirect to login (token expired)
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      // Only redirect if not already on login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  },
);

/**
 * Determines if an error is a connection-level failure
 * (network down, timeout, 502/503/504) vs a normal API error (400, 404, 422).
 *
 * Normal errors (validation, not found) should NOT trigger the banner.
 */
function isConnectionError(error: AxiosError): boolean {
  // No response at all = network error or CORS
  if (!error.response) return true;

  // Timeout
  if (error.code === 'ECONNABORTED') return true;

  // Gateway/server infrastructure errors
  const status = error.response.status;
  return status === 502 || status === 503 || status === 504;
}