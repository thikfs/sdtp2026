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
