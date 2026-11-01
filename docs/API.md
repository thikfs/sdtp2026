# Scheduling API

The contract between the staff scheduling app (`/app/`) and our backend.
The frontend code for it lives in `src/app/api/` — `types.ts` (shapes) and `http.ts` (the calls).

## Connecting the frontend

Set `VITE_API_BASE_URL` in `.env` (e.g. `VITE_API_BASE_URL=https://api.example.com`).
When it is empty the app uses an in-browser mock with sample data (`src/app/api/mock.ts`), so the UI and the tests work before the backend exists.

The app sends `Authorization: Bearer <token>` when a token is stored (placeholder until Supabase auth lands) and `credentials: include` for cookie sessions.
Errors: any non-2xx response is shown to the user as "… failed. Please try again." The body may be plain text or JSON.

## Data shapes

All date-times are ISO 8601 with a timezone (`2026-11-03T13:00:00.000Z`). Dates are `YYYY-MM-DD`.

```ts
type Treatment = 'cons' | 'prof' | 'rest' | 'endo' | 'orto';
// Consulta, Profilaxia, Restauração, Endodontia, Ortodontia
type PreferredSlot = 'morning' | 'early_afternoon' | 'mid_afternoon' | 'late_afternoon';

interface StaffUser { id: string; name: string; role: 'dentist' | 'assistant' }

interface Appointment {
  id: string;
  patientName: string;
  patientPhone?: string;    // E.164, used for the WhatsApp button
  treatment: Treatment;
  start: string;            // date-time
  end: string;              // date-time
  requestId?: string;       // set when created from a request
  notes?: string;
}

interface AppointmentRequest {
  id: string;
  patientName: string;
  patientPhone?: string;
  treatment: Treatment;
  preferredDate: string;    // YYYY-MM-DD
  preferredSlot: PreferredSlot;
  durationMinutes?: number; // if absent the app uses: cons 45, prof 60, rest 90, endo 90, orto 45
  source: 'whatsapp';
  status: 'pending' | 'scheduled' | 'declined';
  createdAt: string;        // date-time
}
```

## Staff endpoints (called by the app)

Only signed-in staff (dentist or assistant) may call these. Both roles have the same rights for now.

| Method | Path | Body | Returns | Used for |
|---|---|---|---|---|
| GET | `/api/me` | – | `StaffUser` | name and role in the sidebar |
| GET | `/api/appointments?from=<date-time>&to=<date-time>` | – | `Appointment[]` | every appointment that overlaps `[from, to)` |
| POST | `/api/appointments` | `{ patientName, patientPhone?, treatment, start, end, notes? }` | `Appointment` (201) | **Create** dialog |
| PATCH | `/api/appointments/:id` | any of `{ start, end, treatment, notes }` | `Appointment` | dragging / resizing an appointment |
| DELETE | `/api/appointments/:id` | – | 204 | **Delete** button |
| GET | `/api/requests?status=pending` | – | `AppointmentRequest[]` | Requested Appointments list |
| POST | `/api/requests/:id/schedule` | `{ start, end }` | `Appointment` (201) | dropping a request on the calendar, or **Confirm** in the chat drawer |

`POST /api/requests/:id/schedule` must, in one transaction, create the appointment (copying name, phone and treatment from the request, setting `requestId`) and set the request's `status` to `scheduled`. If the request is not `pending` it returns `409`.

## External endpoint (meta dashboard → us)

The only third party that talks to the system. It creates requests; it never reads the calendar.

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/external/requests` | `{ patientName, patientPhone?, treatment, preferredDate, preferredSlot, durationMinutes?, externalId? }` | `AppointmentRequest` (201) |

- Auth: header `X-Api-Key: <key>`. The key lives in the host's secret store, never in the repository.
- The backend sets `id`, `source: 'whatsapp'`, `status: 'pending'` and `createdAt`.
- `externalId` (the meta dashboard's own id) makes the call idempotent: sending the same `externalId` twice returns the existing request with `200`.
- Validation errors return `422` with `{ "error": "<what is wrong>" }`.

## Not covered yet
- Live updates between the dentist's phone and the assistant's desktop (story: real-time sync). The app reloads data when the view changes; a Supabase Realtime subscription or polling can be added in `src/app/main.ts`.
- Declining a request, and the real WhatsApp conversation in the chat drawer (it shows a sample conversation today).
