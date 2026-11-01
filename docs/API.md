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
type AppointmentStatus = 'booked' | 'confirmed';  // confirmed = the patient confirmed attendance

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
  status: AppointmentStatus;
  version: number;          // starts at 1, +1 on every change (see "Concurrent edits")
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
| POST | `/api/appointments` | `{ patientName, patientPhone?, treatment, start, end, notes?, status? }` | `Appointment` (201) | **Create**, selecting a time range, undoing a delete |
| PATCH | `/api/appointments/:id` + `If-Match: "<version>"` | any of `{ patientName, patientPhone, treatment, start, end, notes, status }` | `Appointment` | editing, dragging / resizing (moving), undo |
| DELETE | `/api/appointments/:id` + `If-Match: "<version>"` | – | 204 | **Delete** |
| GET | `/api/requests?status=pending` | – | `AppointmentRequest[]` | Requested Appointments list |
| POST | `/api/requests/:id/schedule` | `{ start, end }` | `Appointment` (201) | dropping a request on the calendar, or **Confirm** in the chat drawer |

### Concurrent edits
The dentist and the assistant can edit the same appointment at the same time. To stop one silently overwriting the other:
- `PATCH` and `DELETE` carry `If-Match: "<version>"` with the version the user was looking at.
- If it is not the current version, answer **409** and change nothing. The app then tells the user and reloads the latest data.
- Every successful change increments `version` and returns the new appointment.
- Unknown id: **404**.

### Validation the backend must also enforce
The app checks these before sending, but the backend is the source of truth:
- `end > start`, both on the same day, inside opening hours 08:00–20:00 clinic time → otherwise **422** `{ "error": "..." }`.
- Overlapping appointments are **allowed** (emergencies get squeezed in); the app warns the user before booking one.

### Request scheduling
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

## Keeping screens in sync
The app re-reads appointments and pending requests every 30 s, when the tab becomes visible again and when the device comes back online (`sync()` in `src/app/main.ts`). It skips a refresh while the user is dragging, saving or has a dialog open. A Supabase Realtime subscription can later call the same `sync()` for instant updates.

## Not covered yet
- Declining a request, and the real WhatsApp conversation in the chat drawer (it shows a sample conversation today).
- Undoing a request that was scheduled by mistake (would need `POST /api/appointments/:id/unschedule` that returns the request to `pending`).
