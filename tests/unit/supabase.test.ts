import { describe, expect, it } from 'vitest';
import type { PostgrestError } from '@supabase/supabase-js';
import { patchToRow, rowToAppointment, rowToRequest, toApiError } from '../../src/app/api/supabase';
import { createBackend } from '../../src/app/api';

const pgErr = (code: string, message = 'x') => ({ code, message, details: '', hint: '', name: 'PostgrestError' }) as PostgrestError;

describe('supabase adapter', () => {
  it('maps database errors to statuses the UI understands', () => {
    expect(toApiError(pgErr('PT409'), 409).status).toBe(409);
    expect(toApiError(pgErr('PT401'), 401).status).toBe(401);
    expect(toApiError(pgErr('42501'), 403).status).toBe(403);
    expect(toApiError(pgErr('23514'), 400).status).toBe(422);
    expect(toApiError(pgErr('PGRST301'), 401).status).toBe(401);
    expect(toApiError(pgErr('', 'TypeError: Failed to fetch'), 0).status).toBe(0);
  });

  it('turns database rows into the app shapes', () => {
    expect(rowToAppointment({
      id: 'a1', patient_name: 'Ana', patient_phone: null, treatment: 'cons', starts_at: '2026-11-04T09:00:00+00:00',
      ends_at: '2026-11-04T10:00:00+00:00', request_id: null, notes: null, status: 'booked', version: 3,
    })).toEqual({
      id: 'a1', patientName: 'Ana', patientPhone: undefined, treatment: 'cons', start: '2026-11-04T09:00:00.000Z',
      end: '2026-11-04T10:00:00.000Z', requestId: undefined, notes: undefined, status: 'booked', version: 3,
    });
    expect(rowToRequest({
      id: 'r1', patient_name: 'Rui', patient_phone: '+351 1', treatment: 'prof', preferred_date: '2026-11-05',
      preferred_slot: 'morning', duration_minutes: null, status: 'pending', created_at: 't',
    })).toMatchObject({ preferredDate: '2026-11-05', preferredSlot: 'morning', durationMinutes: undefined, source: 'whatsapp' });
  });

  it('sends cleared fields as null and renames keys for the database', () => {
    expect(patchToRow({ start: 's', end: 'e', notes: undefined, patientPhone: undefined })).toEqual({
      starts_at: 's', ends_at: 'e', notes: null, patient_phone: null,
    });
  });

  it('picks the backend from the environment', async () => {
    expect((await createBackend({})).label).toBe('mock');
    expect((await createBackend({ VITE_API_BASE_URL: 'https://api.test' })).label).toBe('http');
    const sb = await createBackend({ VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_ANON_KEY: 'k' });
    expect(sb.label).toBe('supabase');
    expect(sb.auth).not.toBeNull();
  });
});
