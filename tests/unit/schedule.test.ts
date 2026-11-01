import { describe, expect, it } from 'vitest';
import { conflicts, endFor, fromYmd, preferredRange, toYmd, validateSlot, waNumber } from '../../src/app/schedule';
import { ApiError } from '../../src/app/api/errors';
import { mockApi } from '../../src/app/api/mock';
import type { AppointmentRequest } from '../../src/app/api/types';

const req = (over: Partial<AppointmentRequest> = {}): AppointmentRequest => ({
  id: 'r1', patientName: 'Test Patient', treatment: 'endo', preferredDate: '2026-11-03', preferredSlot: 'mid_afternoon',
  source: 'whatsapp', status: 'pending', createdAt: '2026-11-01T10:00:00Z', ...over,
});

describe('schedule helpers', () => {
  it('round-trips local dates', () => {
    expect(toYmd(fromYmd('2026-02-28'))).toBe('2026-02-28');
  });

  it('places a request at its preferred slot with the treatment default length', () => {
    const { start, end } = preferredRange(req());
    expect(start).toEqual(new Date(2026, 10, 3, 15, 0));
    expect((+end - +start) / 60_000).toBe(90); // endodontia default
  });

  it('uses the duration the request asks for when given', () => {
    const start = new Date(2026, 10, 3, 9, 0);
    expect(endFor(req({ durationMinutes: 30 }), start)).toEqual(new Date(2026, 10, 3, 9, 30));
  });
});

describe('mock api', () => {
  it('scheduling a request creates an appointment and removes it from pending', async () => {
    const api = mockApi({ now: new Date(2026, 10, 2, 8) });
    const [first, ...rest] = await api.listRequests();
    const start = new Date(2026, 10, 4, 11).toISOString(), end = new Date(2026, 10, 4, 12).toISOString();
    const appt = await api.scheduleRequest(first.id, { start, end });
    expect(appt).toMatchObject({ patientName: first.patientName, treatment: first.treatment, start, end, requestId: first.id });
    expect((await api.listRequests()).map((r) => r.id)).toEqual(rest.map((r) => r.id));
    expect(await api.listAppointments(new Date(start), new Date(end))).toContainEqual(appt);
    await expect(api.scheduleRequest(first.id, { start, end })).rejects.toMatchObject({ status: 409 });
  });

  it('moves and deletes appointments, bumping the version', async () => {
    const api = mockApi({ now: new Date(2026, 10, 2, 8) });
    const all = await api.listAppointments(new Date(2026, 9, 1), new Date(2026, 11, 31));
    const moved = await api.updateAppointment(all[0].id, { start: '2026-11-10T09:00:00.000Z', end: '2026-11-10T10:00:00.000Z' }, all[0].version);
    expect(moved).toMatchObject({ start: '2026-11-10T09:00:00.000Z', version: all[0].version + 1 });
    await api.deleteAppointment(all[0].id, moved.version);
    expect((await api.listAppointments(new Date(2026, 9, 1), new Date(2026, 11, 31))).length).toBe(all.length - 1);
  });

  it('rejects a change based on an old version (two people editing at once)', async () => {
    const api = mockApi({ now: new Date(2026, 10, 2, 8) });
    const [a] = await api.listAppointments(new Date(2026, 9, 1), new Date(2026, 11, 31));
    await api.updateAppointment(a.id, { notes: 'assistant edit' }, a.version);
    const stale = api.updateAppointment(a.id, { notes: 'dentist edit' }, a.version);
    await expect(stale).rejects.toBeInstanceOf(ApiError);
    await expect(stale).rejects.toMatchObject({ status: 409 });
    await expect(api.deleteAppointment(a.id, a.version)).rejects.toMatchObject({ status: 409 });
    await expect(api.deleteAppointment('nope', 1)).rejects.toMatchObject({ status: 404 });
  });
});

describe('booking rules', () => {
  const at = (h: number, m = 0) => new Date(2026, 10, 3, h, m);
  const day = [
    { id: 'a', start: at(9), end: at(10) },
    { id: 'b', start: at(10), end: at(11, 30) },
  ];

  it('finds overlaps but not appointments that only touch', () => {
    expect(conflicts(day, at(11, 30), at(12)).map((x) => x.id)).toEqual([]);
    expect(conflicts(day, at(9, 30), at(10, 15)).map((x) => x.id)).toEqual(['a', 'b']);
    expect(conflicts(day, at(9, 15), at(9, 45), 'a')).toEqual([]); // moving an appointment within its own slot
  });

  it('accepts slots inside opening hours and rejects the rest', () => {
    expect(validateSlot(at(8), at(9))).toBeNull();
    expect(validateSlot(at(19), at(20))).toBeNull();
    expect(validateSlot(at(7, 45), at(8, 30))).toMatch(/open/);
    expect(validateSlot(at(19, 30), at(20, 15))).toMatch(/open/);
    expect(validateSlot(at(10), at(10))).toMatch(/end after/);
    expect(validateSlot(new Date(NaN), at(10))).toMatch(/valid/);
  });

  it('builds WhatsApp numbers only from usable phones', () => {
    expect(waNumber('+351 912 345 678')).toBe('351912345678');
    expect(waNumber('123')).toBeNull();
    expect(waNumber(undefined)).toBeNull();
  });
});
