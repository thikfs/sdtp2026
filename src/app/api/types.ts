// Shapes exchanged with the backend. Keep in sync with docs/API.md.

export type Treatment = 'cons' | 'prof' | 'rest' | 'endo' | 'orto';
export type PreferredSlot = 'morning' | 'early_afternoon' | 'mid_afternoon' | 'late_afternoon';
export type Role = 'dentist' | 'assistant';

export interface StaffUser {
  id: string;
  name: string;
  role: Role;
}

export interface Appointment {
  id: string;
  patientName: string;
  patientPhone?: string;
  treatment: Treatment;
  start: string; // ISO 8601 date-time
  end: string; // ISO 8601 date-time
  requestId?: string; // set when the appointment was created from a request
  notes?: string;
}

export interface AppointmentRequest {
  id: string;
  patientName: string;
  patientPhone?: string;
  treatment: Treatment;
  preferredDate: string; // YYYY-MM-DD
  preferredSlot: PreferredSlot;
  durationMinutes?: number;
  source: 'whatsapp';
  status: 'pending' | 'scheduled' | 'declined';
  createdAt: string;
}

export interface NewAppointment {
  patientName: string;
  patientPhone?: string;
  treatment: Treatment;
  start: string;
  end: string;
  notes?: string;
}

export type AppointmentPatch = Partial<Pick<Appointment, 'start' | 'end' | 'treatment' | 'notes'>>;

/** Everything the scheduling UI needs from a backend. */
export interface SchedulingApi {
  me(): Promise<StaffUser>;
  listAppointments(from: Date, to: Date): Promise<Appointment[]>;
  createAppointment(input: NewAppointment): Promise<Appointment>;
  updateAppointment(id: string, patch: AppointmentPatch): Promise<Appointment>;
  deleteAppointment(id: string): Promise<void>;
  listRequests(): Promise<AppointmentRequest[]>;
  /** Turns a pending request into an appointment; the request leaves the pending list. */
  scheduleRequest(id: string, slot: { start: string; end: string }): Promise<Appointment>;
}
