import { httpApi } from './http';
import { mockApi } from './mock';
import type { SchedulingApi } from './types';

export * from './types';
export { ApiError } from './errors';

/**
 * Picks the backend. Set VITE_API_BASE_URL in .env to talk to the real API;
 * leave it empty to use the in-browser mock with sample data.
 */
export function createApi(): SchedulingApi {
  const base = import.meta.env.VITE_API_BASE_URL as string | undefined;
  // ponytail: swap for the Supabase session token once auth lands
  const token = () => {
    try {
      return localStorage.getItem('authToken');
    } catch {
      return null;
    }
  };
  return base ? httpApi(base, token) : mockApi();
}
