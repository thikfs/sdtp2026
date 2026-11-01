import { ApiError } from './errors';
import type { Appointment, AppointmentPatch, AppointmentRequest, NewAppointment, SchedulingApi, StaffUser } from './types';

/** Talks to the real backend at `baseUrl` (e.g. https://api.example.com). See docs/API.md. */
export function httpApi(baseUrl: string, getToken: () => string | null = () => null): SchedulingApi {
  const root = baseUrl.replace(/\/$/, '');

  async function call<T>(method: string, path: string, body?: unknown, version?: number): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (version !== undefined) headers['If-Match'] = `"${version}"`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    let res: Response;
    try {
      res = await fetch(root + path, {
      method,
      headers,
      credentials: 'include',
      // undefined → null so "clear this field" survives JSON (which drops undefined keys)
      body: body === undefined ? undefined : JSON.stringify(body, (_k, v) => (v === undefined ? null : v)),
      signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      throw new ApiError(0, `Network error: ${(err as Error).message}`); // offline, DNS, timeout, CORS
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ApiError(res.status, text || res.statusText);
    }
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  }

  return {
    me: () => call<StaffUser>('GET', '/api/me'),
    listAppointments: (from, to) =>
      call<Appointment[]>('GET', `/api/appointments?${new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })}`),
    createAppointment: (input: NewAppointment) => call<Appointment>('POST', '/api/appointments', input),
    updateAppointment: (id, patch: AppointmentPatch, version) =>
      call<Appointment>('PATCH', `/api/appointments/${encodeURIComponent(id)}`, patch, version),
    deleteAppointment: (id, version) => call<void>('DELETE', `/api/appointments/${encodeURIComponent(id)}`, undefined, version),
    listRequests: () => call<AppointmentRequest[]>('GET', '/api/requests?status=pending'),
    scheduleRequest: (id, slot) => call<Appointment>('POST', `/api/requests/${encodeURIComponent(id)}/schedule`, slot),
  };
}
