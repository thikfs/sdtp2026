// SchedulingApi backed by Supabase: reads from tables/views, writes through the database functions
// in supabase/migrations/*_scheduling_api.sql. Row level security decides what the signed-in user may see.
import { createClient, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from './errors';
import type { Appointment, AppointmentPatch, AppointmentRequest, SchedulingApi, StaffUser } from './types';

export interface Auth {
  hasSession(): Promise<boolean>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  /** Called when the session ends on its own (expired, signed out in another tab). */
  onSignedOut(cb: () => void): void;
}

type Row = Record<string, unknown>;
type Result<T> = { data: T | null; error: PostgrestError | null; status: number };

/** PostgREST error → ApiError with an HTTP-like status the UI understands. */
export function toApiError(error: PostgrestError, status: number): ApiError {
  const code = error.code ?? '';
  const custom = /^PT(\d{3})$/.exec(code); // raised by our database functions, e.g. PT409
  const s = custom ? Number(custom[1])
    : code === '42501' ? 403 // permission denied
    : code === 'PGRST301' || code === 'PGRST303' ? 401 // bad or expired token
    : /^2[23]/.test(code) ? 422 // bad value / constraint violation
    : status; // 0 when the request never reached the server
  return new ApiError(s, error.message || 'Request failed');
}

async function run<T>(q: PromiseLike<Result<T>>): Promise<T> {
  const { data, error, status } = await q;
  if (error) throw toApiError(error, status);
  return data as T;
}

const iso = (v: unknown) => new Date(String(v)).toISOString();
const opt = (v: unknown) => (v == null ? undefined : (v as string));

export const rowToAppointment = (r: Row): Appointment => ({
  id: r.id as string,
  patientName: r.patient_name as string,
  patientPhone: opt(r.patient_phone),
  treatment: r.treatment as Appointment['treatment'],
  start: iso(r.starts_at),
  end: iso(r.ends_at),
  requestId: opt(r.request_id),
  notes: opt(r.notes),
  status: r.status as Appointment['status'],
  version: r.version as number,
});

export const rowToRequest = (r: Row): AppointmentRequest => ({
  id: r.id as string,
  patientName: r.patient_name as string,
  patientPhone: opt(r.patient_phone),
  treatment: r.treatment as AppointmentRequest['treatment'],
  preferredDate: r.preferred_date as string,
  preferredSlot: r.preferred_slot as AppointmentRequest['preferredSlot'],
  durationMinutes: (r.duration_minutes as number | null) ?? undefined,
  source: 'whatsapp',
  status: r.status as AppointmentRequest['status'],
  createdAt: r.created_at as string,
});

const PATCH_KEYS: Record<keyof AppointmentPatch, string> = {
  patientName: 'patient_name', patientPhone: 'patient_phone', treatment: 'treatment',
  start: 'starts_at', end: 'ends_at', status: 'status', notes: 'notes',
};
/** A key present with `undefined` means "clear it", so it becomes null rather than disappearing. */
export function patchToRow(patch: AppointmentPatch): Row {
  const out: Row = {};
  for (const k of Object.keys(patch) as (keyof AppointmentPatch)[]) out[PATCH_KEYS[k]] = patch[k] ?? null;
  return out;
}

export function supabaseBackend(url: string, anonKey: string): { api: SchedulingApi; auth: Auth } {
  const db: SupabaseClient = createClient(url, anonKey);

  const api: SchedulingApi = {
    async me(): Promise<StaffUser> {
      const { data } = await db.auth.getUser();
      if (!data.user) throw new ApiError(401, 'Not signed in');
      const row = await run(db.from('staff').select('id, full_name, role').eq('id', data.user.id).eq('active', true).maybeSingle<Row>());
      if (!row) throw new ApiError(403, 'This account is not set up as clinic staff');
      return { id: row.id as string, name: row.full_name as string, role: row.role as StaffUser['role'] };
    },
    async listAppointments(from, to) {
      const rows = await run(
        db.from('appointment_details').select('*').lt('starts_at', to.toISOString()).gt('ends_at', from.toISOString()).order('starts_at'),
      );
      return (rows ?? []).map(rowToAppointment);
    },
    async createAppointment(a) {
      return rowToAppointment(await run(db.rpc('create_appointment', {
        p_patient_name: a.patientName, p_treatment: a.treatment, p_starts_at: a.start, p_ends_at: a.end,
        p_patient_phone: a.patientPhone ?? null, p_notes: a.notes ?? null, p_status: a.status ?? 'booked',
      }).single<Row>()));
    },
    async updateAppointment(id, patch, version) {
      return rowToAppointment(await run(db.rpc('update_appointment', { p_id: id, p_version: version, p_patch: patchToRow(patch) }).single<Row>()));
    },
    async deleteAppointment(id, version) {
      await run(db.rpc('delete_appointment', { p_id: id, p_version: version }));
    },
    async listRequests() {
      const rows = await run(db.from('appointment_requests').select('*').eq('status', 'pending').order('preferred_date').order('created_at'));
      return (rows ?? []).map(rowToRequest);
    },
    async scheduleRequest(id, { start, end }) {
      return rowToAppointment(await run(db.rpc('schedule_request', { p_id: id, p_starts_at: start, p_ends_at: end }).single<Row>()));
    },
    subscribe(onChange) {
      const channel = db
        .channel('schedule')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => onChange())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'appointment_requests' }, () => onChange())
        .subscribe();
      return () => void db.removeChannel(channel);
    },
  };

  const auth: Auth = {
    async hasSession() {
      return !!(await db.auth.getSession()).data.session;
    },
    async signIn(email, password) {
      const { error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw new ApiError(error.status ?? 0, error.message);
    },
    async signOut() {
      await db.auth.signOut();
    },
    onSignedOut(cb) {
      db.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') cb();
      });
    },
  };

  return { api, auth };
}
