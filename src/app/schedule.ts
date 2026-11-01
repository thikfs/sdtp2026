// Pure scheduling helpers (no DOM, no network) so they can be unit tested.
import type { AppointmentRequest, PreferredSlot, Treatment } from './api/types';

export const TREATMENTS: Record<Treatment, string> = {
  cons: 'Consulta',
  prof: 'Profilaxia',
  rest: 'Restauração',
  endo: 'Endodontia',
  orto: 'Ortodontia',
};

/** Typical chair time per treatment, used when a request does not say how long it needs. */
export const DEFAULT_MINUTES: Record<Treatment, number> = { cons: 45, prof: 60, rest: 90, endo: 90, orto: 45 };

export const SLOT_LABEL: Record<PreferredSlot, string> = {
  morning: 'Manhã',
  early_afternoon: 'Começo da Tarde',
  mid_afternoon: 'Meio da Tarde',
  late_afternoon: 'Fim da Tarde',
};

/** Hour of day (local, fractional) where each preferred slot starts. */
export const SLOT_HOUR: Record<PreferredSlot, number> = {
  morning: 9.5,
  early_afternoon: 13,
  mid_afternoon: 15,
  late_afternoon: 17,
};

/** Clinic opening hours (local time). The calendar grid shows exactly this range. */
export const OPEN_HOUR = 8;
export const CLOSE_HOUR = 20;

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD. */
export const toYmd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export function fromYmd(ymd: string, hour = 0): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d, Math.floor(hour), Math.round((hour % 1) * 60));
}

export const requestMinutes = (r: Pick<AppointmentRequest, 'treatment' | 'durationMinutes'>) =>
  r.durationMinutes ?? DEFAULT_MINUTES[r.treatment];

/** Start/end of the slot the patient asked for. */
export function preferredRange(r: AppointmentRequest): { start: Date; end: Date } {
  const start = fromYmd(r.preferredDate, SLOT_HOUR[r.preferredSlot]);
  return { start, end: new Date(+start + requestMinutes(r) * 60_000) };
}

/** Where a request dropped at `start` ends. */
export const endFor = (r: AppointmentRequest, start: Date) => new Date(+start + requestMinutes(r) * 60_000);

export interface Slot { id: string; start: Date; end: Date }

/** Appointments that overlap [start, end), except `ignoreId` (the one being moved). Touching edges is not an overlap. */
export function conflicts<T extends Slot>(all: T[], start: Date, end: Date, ignoreId?: string): T[] {
  return all.filter((a) => a.id !== ignoreId && a.start < end && a.end > start).sort((a, b) => +a.start - +b.start);
}

/** Hard rules for a booking. Returns a message for the user, or null when the slot is valid. */
export function validateSlot(start: Date, end: Date): string | null {
  if (isNaN(+start) || isNaN(+end)) return 'Pick a valid date and time.';
  if (end <= start) return 'The appointment must end after it starts.';
  if (start.toDateString() !== new Date(+end - 1).toDateString()) return 'An appointment must start and end on the same day.';
  const open = new Date(start), close = new Date(start);
  open.setHours(OPEN_HOUR, 0, 0, 0);
  close.setHours(CLOSE_HOUR, 0, 0, 0);
  if (start < open || end > close) return `The clinic is open ${pad2(OPEN_HOUR)}:00–${pad2(CLOSE_HOUR)}:00.`;
  return null;
}

/** Digits-only phone for https://wa.me/<digits>, or null when there is no usable number. */
export function waNumber(phone?: string): string | null {
  const d = (phone ?? '').replace(/\D/g, '');
  return d.length >= 8 ? d : null;
}
