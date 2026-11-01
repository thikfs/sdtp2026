import { describe, expect, it } from 'vitest';
import { endFor, fromYmd, preferredRange, toYmd } from '../../src/app/schedule';
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
    await expect(api.scheduleRequest(first.id, { start, end })).rejects.toThrow();
  });

  it('moves and deletes appointments', async () => {
    const api = mockApi({ now: new Date(2026, 10, 2, 8) });
    const all = await api.listAppointments(new Date(2026, 9, 1), new Date(2026, 11, 31));
    const moved = await api.updateAppointment(all[0].id, { start: '2026-11-10T09:00:00.000Z', end: '2026-11-10T10:00:00.000Z' });
    expect(moved.start).toBe('2026-11-10T09:00:00.000Z');
    await api.deleteAppointment(all[0].id);
    expect((await api.listAppointments(new Date(2026, 9, 1), new Date(2026, 11, 31))).length).toBe(all.length - 1);
  });
});
