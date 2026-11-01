import type { Appointment, AppointmentPatch, AppointmentRequest, NewAppointment, SchedulingApi, StaffUser } from './types';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Talks to the real backend at `baseUrl` (e.g. https://api.example.com). See docs/API.md. */
export function httpApi(baseUrl: string, getToken: () => string | null = () => null): SchedulingApi {
  const root = baseUrl.replace(/\/$/, '');

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(root + path, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
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
    updateAppointment: (id, patch: AppointmentPatch) => call<Appointment>('PATCH', `/api/appointments/${encodeURIComponent(id)}`, patch),
    deleteAppointment: (id) => call<void>('DELETE', `/api/appointments/${encodeURIComponent(id)}`),
    listRequests: () => call<AppointmentRequest[]>('GET', '/api/requests?status=pending'),
    scheduleRequest: (id, slot) => call<Appointment>('POST', `/api/requests/${encodeURIComponent(id)}/schedule`, slot),
  };
}
