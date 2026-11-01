// In-browser stand-in for the backend. Used when VITE_API_BASE_URL is not set,
// so the UI runs (and the e2e tests pass) before the real backend exists.
// All names are invented sample data.
import { toYmd } from '../schedule';
import { ApiError } from './errors';
import type { Appointment, AppointmentRequest, PreferredSlot, SchedulingApi, StaffUser, Treatment } from './types';

type Seed = { now?: Date; user?: StaffUser };

export function mockApi({ now = new Date(), user = { id: 'u1', name: 'Dra. Helena Matos', role: 'dentist' } }: Seed = {}): SchedulingApi {
  const day0 = new Date(now);
  day0.setHours(0, 0, 0, 0);
  const at = (offset: number, hour: number) => {
    const d = new Date(day0);
    d.setDate(d.getDate() + offset);
    d.setHours(Math.floor(hour), Math.round((hour % 1) * 60));
    return d;
  };
  let seq = 100;
  const p3 = (n: number) => String(n).padStart(3, '0');

  const appts: Appointment[] = (
    [
      ['Joaquina Dentadura', 'cons', 0, 14, 120], ['Ana Paz', 'prof', -2, 9, 60], ['Carlos Cárie', 'rest', -2, 11, 90],
      ['Inês Aparelho', 'orto', -1, 10, 45], ['Pedro Nervo', 'endo', -1, 15, 90], ['Luís Coroa', 'cons', 0, 9, 45],
      ['Marta Branca', 'prof', 1, 10, 60], ['Sofia Presa', 'orto', 1, 16, 45], ['Hugo Siso', 'rest', 2, 9, 90],
      ['Teresa Dente', 'cons', 2, 14.5, 45], ['Jorge Boca', 'endo', 5, 10, 90], ['Clara Lima', 'prof', 6, 11, 60],
      ['Rita Molar', 'cons', 8, 15, 45],
    ] as [string, Treatment, number, number, number][]
  ).map(([patientName, treatment, o, h, m], i) => ({
    id: 'a' + i, patientName, patientPhone: `+351 910 000 ${p3(i)}`, treatment, start: at(o, h).toISOString(), end: at(o, h + m / 60).toISOString(),
    status: o < 1 ? 'confirmed' : 'booked', version: 1,
  }));

  const reqs: AppointmentRequest[] = (
    [
      ['Zé da Roça', 'rest', 2, 'early_afternoon'], ['João Furacão', 'prof', 5, 'mid_afternoon'],
      ['Maria Sorriso', 'orto', 3, 'morning'], ['Tiago Molar', 'endo', 6, 'late_afternoon'],
      ['Beatriz Canino', 'cons', 4, 'morning'], ['Rui Siso', 'prof', 7, 'early_afternoon'],
    ] as [string, Treatment, number, PreferredSlot][]
  ).map(([patientName, treatment, o, preferredSlot], i) => ({
    id: 'r' + i, patientName, patientPhone: `+351 920 000 ${p3(i)}`, treatment, preferredSlot, preferredDate: toYmd(at(o, 0)),
    source: 'whatsapp', status: 'pending', createdAt: now.toISOString(),
  }));

  const copy = <T>(x: T): T => structuredClone(x);
  const find = (id: string, version: number) => {
    const a = appts.find((x) => x.id === id);
    if (!a) throw new ApiError(404, `Appointment ${id} not found`);
    if (a.version !== version) throw new ApiError(409, `Appointment ${id} was changed by someone else`);
    return a;
  };

  return {
    me: async () => copy(user),
    listAppointments: async (from, to) =>
      copy(appts.filter((a) => new Date(a.end) > from && new Date(a.start) < to)),
    createAppointment: async (input) => {
      const a: Appointment = { status: 'booked', ...input, id: 'a' + seq++, version: 1 };
      appts.push(a);
      return copy(a);
    },
    updateAppointment: async (id, patch, version) => {
      const a = find(id, version);
      return copy(Object.assign(a, patch, { version: a.version + 1 }));
    },
    deleteAppointment: async (id, version) => {
      appts.splice(appts.indexOf(find(id, version)), 1);
    },
    listRequests: async () => copy(reqs.filter((r) => r.status === 'pending')),
    scheduleRequest: async (id, { start, end }) => {
      const r = reqs.find((x) => x.id === id);
      if (!r) throw new ApiError(404, `Request ${id} not found`);
      if (r.status !== 'pending') throw new ApiError(409, `Request ${id} is not pending`);
      r.status = 'scheduled';
      const a: Appointment = {
        id: 'a' + seq++, patientName: r.patientName, patientPhone: r.patientPhone, treatment: r.treatment, start, end, requestId: r.id,
        status: 'booked', version: 1,
      };
      appts.push(a);
      return copy(a);
    },
  };
}
