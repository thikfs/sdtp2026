import { httpApi } from './http';
import { mockApi } from './mock';
import type { Auth } from './supabase';
import type { SchedulingApi } from './types';

export * from './types';
export { ApiError } from './errors';
export type { Auth } from './supabase';

export interface Backend {
  api: SchedulingApi;
  /** null when the backend needs no sign-in (mock data). */
  auth: Auth | null;
  label: 'supabase' | 'http' | 'mock';
}

/**
 * Picks the backend from .env:
 *   VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY → Supabase (staff sign in)
 *   VITE_API_BASE_URL                           → a custom REST backend (docs/API.md)
 *   neither                                     → in-browser mock with sample data
 */
export async function createBackend(env: Record<string, string | undefined> = import.meta.env): Promise<Backend> {
  if (env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY) {
    // Loaded on demand so the mock/http builds don't ship the Supabase client.
    const { supabaseBackend } = await import('./supabase');
    return { ...supabaseBackend(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY), label: 'supabase' };
  }
  if (env.VITE_API_BASE_URL) {
    const token = () => {
      try {
        return localStorage.getItem('authToken');
      } catch {
        return null;
      }
    };
    return { api: httpApi(env.VITE_API_BASE_URL, token), auth: null, label: 'http' };
  }
  return { api: mockApi(), auth: null, label: 'mock' };
}
