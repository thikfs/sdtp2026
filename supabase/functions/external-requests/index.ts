// POST /functions/v1/external-requests
// The only entry point for the third party (the meta dashboard). It creates appointment requests;
// it can never read the calendar. Auth: header `X-Api-Key` = secret META_DASHBOARD_API_KEY.
// Set it with: supabase secrets set META_DASHBOARD_API_KEY=<long random value>
// No dependencies: it calls the database function submit_request through the Data API with the service role.

const TREATMENTS = ['cons', 'prof', 'rest', 'endo', 'orto'];
const SLOTS = ['morning', 'early_afternoon', 'mid_afternoon', 'late_afternoon'];

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Constant-time comparison so the key cannot be guessed byte by byte from response timing. */
function sameKey(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** Returns an error message, or null when the body is acceptable. The database re-checks everything. */
export function validate(b: Record<string, unknown>): string | null {
  const str = (k: string) => typeof b[k] === 'string' && (b[k] as string).trim() !== '';
  if (!str('patientName')) return 'patientName is required';
  if (b.patientPhone != null && !/^\+?[0-9 ()-]{6,20}$/.test(String(b.patientPhone))) return 'patientPhone is not a phone number';
  if (!TREATMENTS.includes(b.treatment as string)) return `treatment must be one of ${TREATMENTS.join(', ')}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.preferredDate)) || isNaN(Date.parse(String(b.preferredDate)))) return 'preferredDate must be YYYY-MM-DD';
  if (!SLOTS.includes(b.preferredSlot as string)) return `preferredSlot must be one of ${SLOTS.join(', ')}`;
  if (b.durationMinutes != null && !(Number.isInteger(b.durationMinutes) && (b.durationMinutes as number) >= 5 && (b.durationMinutes as number) <= 720))
    return 'durationMinutes must be a whole number between 5 and 720';
  if (b.externalId != null && !str('externalId')) return 'externalId must be a non-empty string';
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST' });

  const expected = Deno.env.get('META_DASHBOARD_API_KEY');
  if (!expected) return json(500, { error: 'Server is not configured' });
  if (!sameKey(req.headers.get('x-api-key') ?? '', expected)) return json(401, { error: 'Invalid API key' });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Body must be JSON' });
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return json(422, { error: 'Body must be a JSON object' });
  const invalid = validate(body);
  if (invalid) return json(422, { error: invalid });

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/submit_request`, {
    method: 'POST',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_request: {
      patient_name: body.patientName,
      patient_phone: body.patientPhone ?? null,
      treatment: body.treatment,
      preferred_date: body.preferredDate,
      preferred_slot: body.preferredSlot,
      duration_minutes: body.durationMinutes ?? null,
      external_id: body.externalId ?? null,
    } }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({})) as { code?: string; message?: string };
    console.error('submit_request failed', res.status, error);
    // 23xxx = constraint violation, 22xxx = bad value: the caller sent something the database refuses.
    const callerError = /^2[23]/.test(error.code ?? '');
    return json(callerError ? 422 : 500, { error: callerError ? error.message : 'Could not save the request' });
  }

  const r = await res.json() as Record<string, unknown>;
  return json(r.created ? 201 : 200, {
    id: r.id,
    externalId: r.external_id,
    patientName: r.patient_name,
    patientPhone: r.patient_phone ?? undefined,
    treatment: r.treatment,
    preferredDate: r.preferred_date,
    preferredSlot: r.preferred_slot,
    durationMinutes: r.duration_minutes ?? undefined,
    source: r.source,
    status: r.status,
    createdAt: r.created_at,
  });
});
