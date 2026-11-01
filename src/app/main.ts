// Staff scheduling app (dentist + assistant). All data goes through `api` (see src/app/api).
import { Calendar, type EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import { ApiError, createBackend, type Appointment, type AppointmentRequest, type AppointmentStatus, type Treatment } from './api';
import { signInGate } from './signin';
import {
  CLOSE_HOUR, OPEN_HOUR, SLOT_HOUR, SLOT_LABEL, TREATMENTS as TX,
  conflicts, endFor, fromYmd, pad2 as p2, preferredRange, requestMinutes, toYmd, validateSlot, waNumber,
} from './schedule';

const { api, auth } = await createBackend();
// Staff must be signed in before anything is loaded (no-op with mock data).
if (auth) {
  await signInGate(auth, api);
  auth.onSignedOut(() => location.reload()); // session ended: back to the sign-in screen
  const out = document.getElementById('signout')!;
  out.hidden = false;
  out.onclick = () => auth.signOut();
}
const SYNC_EVERY_MS = 30_000;

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const esc = (s: unknown) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const fmt = (d: Date) => p2(d.getDate()) + '/' + p2(d.getMonth() + 1);
const hhmm = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const wday = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long' });
const ini = (n: string) => n.split(' ').filter((w) => w.length > 2 || w[0] === w[0].toUpperCase()).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const mob = () => matchMedia('(max-width:760px)').matches;
const svg = (k: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${({
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-4 3-6 6.5-6s6 2 6.5 6M16 4.5a3.5 3.5 0 010 7M18 14c2 .6 3.3 2.6 3.5 6"/>',
    inbox: '<path d="M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  } as Record<string, string>)[k]}</svg>`;
const WA_ICON =
  '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 00-8.6 15L2 22l5.2-1.4A10 10 0 1012 2zm5.2 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 .9-2.3c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.8 2c.1.2.1.3 0 .5l-.4.6c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.1 1 2.1 1.3 2.4 1.4.3.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.8-.2 1.4z"/></svg>';

/* ---- state: a local cache of what the backend returned ---- */
interface Ev { id: string; p: string; tx: Treatment; start: Date; end: Date; a: Appointment }
const toEv = (a: Appointment): Ev => ({ id: a.id, p: a.patientName, tx: a.treatment, start: new Date(a.start), end: new Date(a.end), a });
const base = new Date();
base.setHours(0, 0, 0, 0);
let evs: Ev[] = [];
let reqs: AppointmentRequest[] = [];
const state = { view: 'calendar', q: '', sel: null as string | null, day: new Date(base), loaded: false };
const match = (e: { p: string; tx: Treatment }) => !state.q || (e.p + ' ' + TX[e.tx]).toLowerCase().includes(state.q.toLowerCase());
const reqDate = (r: AppointmentRequest) => preferredRange(r).start;
const evById = (id: string | null) => evs.find((e) => e.id === id);

let useCache = false; // true = redraw the calendar from `evs` without asking the backend
let mutations = 0; // bumped on every local change; background loads that started earlier are dropped
let saving = 0; // requests in flight that change data
let dragging = false;

/** Replace cached appointments that overlap [from, to) with fresh ones from the backend. */
async function load(from: Date, to: Date) {
  const seq = mutations;
  const fresh = await api.listAppointments(from, to);
  if (seq !== mutations) return; // a local change landed meanwhile; this answer may predate it
  evs = evs.filter((e) => !(e.end > from && e.start < to)).concat(fresh.map(toEv));
}
function upsert(a: Appointment) {
  mutations++;
  evs = evs.filter((e) => e.id !== a.id).concat(toEv(a));
}
function forget(id: string) {
  mutations++;
  evs = evs.filter((e) => e.id !== id);
}
async function busy<T>(p: Promise<T>): Promise<T> {
  saving++;
  try {
    return await p;
  } finally {
    saving--;
  }
}

/** Tell the user what went wrong in words they can act on. */
function fail(what: string, err: unknown) {
  console.error(what, err);
  const status = err instanceof ApiError ? err.status : -1;
  if (status === 401) {
    toast('Your session has ended. Please sign in again.');
    setTimeout(() => (auth ? auth.signOut() : location.reload()), 1500);
  } else if (status === 403) {
    toast(`${what} failed: your account is not allowed to do this.`);
  } else if (status === 422) {
    toast(err instanceof Error && err.message ? err.message : `${what} failed: the details are not valid.`);
  } else if (status === 409) {
    toast(`${what} failed: someone else changed this in the meantime. Showing the latest version.`);
    sync(true);
  } else if (status === 404) {
    toast(`${what} failed: it no longer exists. Showing the latest version.`);
    sync(true);
  } else if (!navigator.onLine || status === 0) {
    toast(`You seem to be offline. ${what} did not go through.`, { label: 'Retry', run: () => sync(true) });
  } else {
    toast(`${what} failed. Please try again.`);
  }
}

/* ---- calendar ---- */
const evInput = (e: Ev): EventInput => ({
  id: e.id, title: e.p, start: e.start, end: e.end,
  classNames: ['tx-' + e.tx, ...(e.a.status === 'confirmed' ? ['is-confirmed'] : []), ...(state.sel === e.id ? ['is-sel'] : [])],
  extendedProps: { tx: e.tx },
});
const reqInput = (r: AppointmentRequest): EventInput => {
  const { start, end } = preferredRange(r);
  return { id: r.id, title: r.patientName, start, end, editable: false, classNames: ['tx-' + r.treatment, 'is-pending'], extendedProps: { tx: r.treatment, req: 1 } };
};
const calEvents = () => evs.filter(match).map(evInput).concat(reqs.filter((r) => match({ p: r.patientName, tx: r.treatment })).map(reqInput));
const dcn = (a: { date: Date }) => (a.date.toDateString() === state.day.toDateString() ? ['sel-day'] : []);
const hm = (h: number) => `${p2(h)}:00:00`;

const cal = new Calendar($('#cal'), {
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
  initialView: mob() ? 'dayGridMonth' : 'timeGridWeek', headerToolbar: false, firstDay: 1, nowIndicator: true, allDaySlot: false, expandRows: true,
  slotMinTime: hm(OPEN_HOUR), slotMaxTime: hm(CLOSE_HOUR), slotDuration: '00:30:00', slotLabelInterval: '01:00', height: mob() ? 'auto' : '100%',
  slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false }, eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
  views: { dayGridMonth: { eventDisplay: 'list-item', dayMaxEvents: false } },
  editable: true, droppable: true, snapDuration: '00:15:00', longPressDelay: 400,
  // Select an empty time range to book it.
  selectable: true, selectMirror: true, selectAllow: (s) => !s.allDay,
  select: (i) => {
    cal.unselect();
    openEditor(null, { start: i.start, end: i.end });
  },
  events: (info, ok, bad) => {
    const cached = useCache;
    useCache = false;
    (cached ? Promise.resolve() : load(info.start, info.end))
      .then(() => {
        renderAgenda();
        renderPane();
        ok(calEvents());
      })
      .catch((err) => {
        fail('Loading appointments', err);
        bad(err);
      });
  },
  dayCellClassNames: dcn,
  dayHeaderContent: (a) =>
    a.view.type.startsWith('timeGrid')
      ? { html: `<div class="dh"><span>${a.date.toLocaleDateString('en-US', { weekday: 'short' })}</span><b>${a.date.getDate()}</b></div>` }
      : true, // true = FullCalendar's default content
  eventContent: (a) => {
    if (!a.view.type.startsWith('timeGrid')) return true;
    const x = a.event.extendedProps;
    return { html: `<div class="evi"><b>${esc(a.event.title)}</b><span>${TX[x.tx as Treatment]}</span>${x.req ? '<em>Request · WhatsApp</em>' : ''}<i>${a.timeText}</i></div>` };
  },
  eventClick: (i) => {
    if (i.event.extendedProps.req) return openChat(i.event.id);
    const e = evById(i.event.id);
    if (e) openEditor(e);
  },
  eventDragStart: () => (dragging = true),
  eventDragStop: () => (dragging = false),
  eventResizeStart: () => (dragging = true),
  eventResizeStop: () => (dragging = false),
  // Moving / resizing an existing appointment.
  eventDrop: (i) => move(i.event.id, i.event.start!, i.event.end!, i.revert),
  eventResize: (i) => move(i.event.id, i.event.start!, i.event.end!, i.revert),
  // A request card from the right-hand list was dropped on the calendar.
  eventReceive: (i) => {
    const r = reqs.find((x) => x.id === i.event.extendedProps.dropReq);
    const start = i.event.allDay && r ? fromYmd(toYmd(i.event.start!), SLOT_HOUR[r.preferredSlot]) : i.event.start!;
    i.event.remove(); // the real event comes back from the backend
    if (r) schedule(r, start);
  },
  dateClick: (i) => {
    if (cal.view.type !== 'dayGridMonth') return;
    state.day = i.date;
    cal.setOption('dayCellClassNames', dcn);
    renderAgenda();
    if (!mob()) cal.changeView('timeGridWeek', i.date);
  },
  datesSet: (i) => {
    $('#title').textContent = i.view.title;
    $<HTMLSelectElement>('#vsel').value = i.view.type;
    const s = i.view.currentStart, e = i.view.currentEnd;
    if (!(state.day >= s && state.day < e)) state.day = base >= s && base < e ? new Date(base) : new Date(s);
    cal.setOption('dayCellClassNames', dcn);
    renderAgenda();
  },
});
$('#prev').onclick = () => cal.prev();
$('#next').onclick = () => cal.next();
$('#today').onclick = () => cal.today();
$<HTMLSelectElement>('#vsel').onchange = (e) => cal.changeView((e.target as HTMLSelectElement).value);

// Request cards in the side list can be dragged onto the calendar.
new Draggable($('#req'), {
  itemSelector: '.rq[data-r]',
  eventData: (el) => {
    const r = reqs.find((x) => x.id === (el as HTMLElement).dataset.r);
    if (!r) return { create: false };
    return { title: r.patientName, duration: { minutes: requestMinutes(r) }, classNames: ['tx-' + r.treatment], extendedProps: { dropReq: r.id, tx: r.treatment }, create: true };
  },
});

/* ---- checks before booking ---- */
/** Soft warnings (overlap, in the past) the user may override, e.g. to squeeze in an emergency. */
async function confirmSlot(start: Date, end: Date, ignoreId?: string): Promise<boolean> {
  const warn: string[] = [];
  const c = conflicts(evs, start, end, ignoreId);
  if (c.length) warn.push(`It overlaps ${c.map((x) => `${x.p} (${hhmm(x.start)}–${hhmm(x.end)})`).join(', ')}.`);
  if (start < new Date()) warn.push('This time is in the past.');
  return !warn.length || ask('Double-check this time', warn.join(' '), 'Book anyway');
}
/** Hard rules first (shown as a toast), then soft warnings. */
async function checkSlot(start: Date, end: Date, ignoreId?: string): Promise<boolean> {
  const err = validateSlot(start, end);
  if (err) {
    toast(err);
    return false;
  }
  return confirmSlot(start, end, ignoreId);
}

/* ---- actions (each one: check, call the backend, update the cache, offer undo) ---- */
async function move(id: string, start: Date, end: Date, revert: () => void) {
  const e = evById(id);
  if (!e || !(await checkSlot(start, end, id))) return revert();
  const before = { start: e.a.start, end: e.a.end };
  try {
    const a = await busy(api.updateAppointment(id, { start: start.toISOString(), end: end.toISOString() }, e.a.version));
    upsert(a);
    refresh(false);
    toast(`Moved ${a.patientName} to ${fmt(start)} ${hhmm(start)}`, undo('Move', async () => {
      const cur = evById(id);
      if (cur) upsert(await api.updateAppointment(id, before, cur.a.version));
    }));
  } catch (err) {
    revert();
    fail('Moving the appointment', err);
  }
}

async function schedule(r: AppointmentRequest, start: Date) {
  const end = endFor(r, start);
  if (!(await checkSlot(start, end))) return refresh(false);
  try {
    const a = await busy(api.scheduleRequest(r.id, { start: start.toISOString(), end: end.toISOString() }));
    reqs = reqs.filter((x) => x.id !== r.id);
    upsert(a);
    toast(`Scheduled ${r.patientName} · ${fmt(start)} ${hhmm(start)}`);
    refresh(false);
  } catch (err) {
    fail('Scheduling the request', err);
    refresh(false);
  }
}

async function remove(e: Ev) {
  if (!(await ask('Delete appointment?', `${e.p} · ${TX[e.tx]} · ${fmt(e.start)} ${hhmm(e.start)}–${hhmm(e.end)}`, 'Delete', true))) return false;
  try {
    await busy(api.deleteAppointment(e.id, e.a.version));
    forget(e.id);
    if (state.sel === e.id) state.sel = null;
    refresh(false);
    const { patientName, patientPhone, treatment, start, end, notes, status } = e.a;
    toast(`Deleted ${e.p}’s appointment`, undo('Delete', async () => {
      upsert(await api.createAppointment({ patientName, patientPhone, treatment, start, end, notes, status }));
    }));
    return true;
  } catch (err) {
    fail('Deleting the appointment', err);
    return false;
  }
}

/** Toast action that runs `fn`, then redraws; errors are reported like any other action. */
function undo(what: string, fn: () => Promise<void>) {
  return {
    label: 'Undo',
    run: async () => {
      try {
        await busy(fn());
        refresh(false);
        toast(`${what} undone`);
      } catch (err) {
        fail(`Undoing the ${what.toLowerCase()}`, err);
      }
    },
  };
}

/* ---- renderers ---- */
const card = (e: Ev) =>
  `<button class="ac tx-${e.tx}${e.a.status === 'confirmed' ? ' is-confirmed' : ''}${state.sel === e.id ? ' is-sel' : ''}" data-id="${esc(e.id)}"><span class="ac-t">${hhmm(e.start)}–${hhmm(e.end)}</span><b>${esc(e.p)}</b><span class="chip">${TX[e.tx]}</span></button>`;
const rq = (r: AppointmentRequest) =>
  `<button class="rq tx-${r.treatment}" data-r="${esc(r.id)}"><b>${esc(r.patientName)}</b><span>${TX[r.treatment]} · ${requestMinutes(r)} min</span><small>Preferência: ${fmt(reqDate(r))}, ${SLOT_LABEL[r.preferredSlot]}</small><i class="wa">${WA_ICON}Open WhatsApp chat</i></button>`;
const dayItems = (d: Date) => evs.filter((e) => e.start.toDateString() === d.toDateString() && match(e)).sort((a, b) => +a.start - +b.start);

function renderAgenda() {
  const d = state.day, pend = reqs.filter((r) => reqDate(r).toDateString() === d.toDateString());
  $('#agenda').innerHTML =
    `<h3>${fmt(d)}, ${wday(d)}</h3>` +
    (dayItems(d).map(card).join('') +
      pend.map((r) => `<button class="ac pend tx-${r.treatment}" data-r="${esc(r.id)}"><span class="ac-t">Request · ${SLOT_LABEL[r.preferredSlot]}</span><b>${esc(r.patientName)}</b><span class="chip">${TX[r.treatment]}</span></button>`).join('') ||
      '<p class="empty">No appointments this day.</p>');
}

function renderReqs() {
  const list = [...reqs].sort((a, b) => +reqDate(a) - +reqDate(b));
  $('#req').innerHTML =
    `<h2>Requested Appointments <em>${reqs.length}</em></h2>` +
    (!state.loaded
      ? '<p class="loading">Loading requests…</p>'
      : reqs.length
        ? `<p class="hint">Drag a request onto the calendar to schedule it, or tap it to open the chat.</p>${list.map(rq).join('')}`
        : '<p class="empty">No pending requests.</p>');
  $('#nb').textContent = reqs.length ? String(reqs.length) : '';
}

function renderPane() {
  const v = state.view, p = $('#pane');
  if (v === 'list') {
    let h = '';
    for (let i = 0; i < 14; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      const it = dayItems(d);
      if (it.length) h += `<h3>${fmt(d)}, ${wday(d)}${i ? '' : ' · Today'}</h3><div class="grid">${it.map(card).join('')}</div>`;
    }
    p.innerHTML = h || '<p class="empty">Nothing matches.</p>';
  } else if (v === 'requests') {
    p.innerHTML = `<h3>All requests</h3><div class="grid">${reqs.map(rq).join('') || '<p class="empty">No pending requests.</p>'}</div>`;
  } else if (v === 'patients') {
    const m: Record<string, { p: string; tx: Treatment; start: Date; req?: 1 }[]> = {};
    [...evs.filter(match), ...reqs.map((r) => ({ p: r.patientName, tx: r.treatment, start: reqDate(r), req: 1 as const }))].forEach((e) => (m[e.p] ||= []).push(e));
    p.innerHTML =
      '<h3>Patients</h3>' +
      Object.entries(m)
        .sort()
        .map(([n, a]) => {
          a.sort((x, y) => +x.start - +y.start);
          const e = a.find((x) => x.start >= base) || a[0];
          return `<div class="row tx-${e.tx}"><div class="av">${esc(ini(n))}</div><div><b>${esc(n)}</b><small>${e.req ? 'Requested' : 'Next'}: ${fmt(e.start)}, ${hhmm(e.start)}</small></div><span class="chip">${TX[e.tx]}</span></div>`;
        })
        .join('');
  } else if (v === 'stats') {
    const ws = new Date(base);
    ws.setDate(ws.getDate() - ((ws.getDay() + 6) % 7));
    const we = new Date(ws);
    we.setDate(we.getDate() + 7);
    const wk = evs.filter((e) => e.start >= ws && e.start < we), hrs = wk.reduce((s, e) => s + (+e.end - +e.start) / 36e5, 0);
    const by = (Object.keys(TX) as Treatment[]).map((k) => [k, wk.filter((e) => e.tx === k).length] as const), mx = Math.max(1, ...by.map((b) => b[1]));
    p.innerHTML = `<h3>This week at a glance</h3><div class="tiles"><div class="tile"><b>${wk.length}</b><span>Appointments</span></div><div class="tile"><b>${Math.round(hrs * 10) / 10}</b><span>Chair hours booked</span></div><div class="tile"><b>${reqs.length}</b><span>Pending requests</span></div><div class="tile"><b>${new Set(wk.map((e) => e.p)).size}</b><span>Patients this week</span></div></div><div class="bars"><b>By treatment</b>${by.map(([k, n]) => `<div class="bar tx-${k}"><span>${TX[k]}</span><i style="width:${(n / mx) * 100}%"></i><span>${n}</span></div>`).join('')}</div>`;
  }
}

/** Re-render everything. `refetch` also asks the backend again for the visible range. */
function refresh(refetch = true) {
  if (state.sel && !evById(state.sel)) state.sel = null;
  useCache = !refetch;
  cal.refetchEvents();
  renderAgenda();
  renderReqs();
  renderPane();
  $<HTMLButtonElement>('#del').disabled = !state.sel;
}

/* ---- keeping two screens in step (dentist's phone + assistant's desktop) ---- */
const preloadWindow = () => {
  const from = new Date(base), to = new Date(base);
  from.setDate(from.getDate() - 7);
  to.setDate(to.getDate() + 30);
  return [from, to] as const;
};
/** Pull the latest appointments and requests. Skipped while the user is in the middle of something unless forced. */
async function sync(force = false) {
  if (dragging || saving) return;
  if (!force && (document.querySelector('dialog[open]') || document.visibilityState !== 'visible')) return;
  const seq = mutations, known = new Set(reqs.map((r) => r.id));
  try {
    const [fresh] = await Promise.all([api.listRequests(), load(...preloadWindow())]);
    if (seq === mutations) {
      const added = state.loaded ? fresh.filter((r) => !known.has(r.id)).length : 0;
      reqs = fresh;
      if (added) toast(added === 1 ? 'New appointment request' : `${added} new appointment requests`);
    }
    state.loaded = true;
    refresh(true);
  } catch (err) {
    if (force || !state.loaded) fail('Loading the schedule', err);
    else console.warn('Background sync failed', err);
  }
}
setInterval(sync, SYNC_EVERY_MS);
// Push updates (Supabase Realtime): refresh shortly after someone else changes something.
let pushTimer = 0;
api.subscribe?.(() => {
  clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => sync(), 400);
});
document.addEventListener('visibilitychange', () => sync());
addEventListener('online', () => sync(true));
addEventListener('beforeunload', (e) => {
  if (saving) e.preventDefault(); // a save is still on its way to the server
});

/* ---- navigation ---- */
const NAV = [['calendar', 'Calendar', 'cal'], ['list', 'List', 'list'], ['patients', 'Patients', 'users'], ['requests', 'Requests', 'inbox'], ['stats', 'Stats', 'chart']];
$('#nav').innerHTML = NAV.map(([k, l, i]) => `<button data-v="${k}">${svg(i)}<span>${l}</span>${k === 'requests' ? '<em id="nb"></em>' : ''}</button>`).join('');
function setView(v: string) {
  state.view = v;
  const c = v === 'calendar';
  $('#calwrap').hidden = !c;
  $('#agenda').hidden = !c;
  $('#pane').hidden = c;
  $('#ctrl').hidden = !c;
  $('#content').classList.toggle('noreq', !['calendar', 'list'].includes(v));
  document.querySelectorAll<HTMLElement>('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  renderPane();
  if (c) cal.updateSize();
  if (mob()) $('#app').classList.remove('open');
}
$('#nav').onclick = (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('button');
  if (b) setView(b.dataset.v!);
};
$('#menu').onclick = () => {
  $('#app').classList.toggle(mob() ? 'open' : 'collapsed');
  setTimeout(() => cal.updateSize(), 300);
};
if (innerWidth >= 1280) $('#app').classList.remove('collapsed');
document.querySelectorAll<HTMLInputElement>('.search').forEach(
  (i) =>
    (i.oninput = () => {
      state.q = i.value;
      document.querySelectorAll<HTMLInputElement>('.search').forEach((o) => (o.value = state.q));
      refresh(false);
    }),
);
addEventListener('resize', () => cal.setOption('height', mob() ? 'auto' : '100%'));
// Keep the grid sized to its card (the sidebar slides open/closed with a CSS transition).
new ResizeObserver(() => cal.updateSize()).observe($('#calwrap'));

/* ---- request cards, agenda cards, delete button ---- */
// A drag that started on a request card must not also count as a click, and must not be interrupted by a re-render.
let down: { x: number; y: number } | null = null;
document.addEventListener('pointerdown', (e) => {
  down = { x: e.clientX, y: e.clientY };
  if ((e.target as HTMLElement).closest('#req .rq')) dragging = true;
});
const endPointer = () => setTimeout(() => (dragging = false));
document.addEventListener('pointerup', endPointer);
document.addEventListener('pointercancel', endPointer);
document.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const r = t.closest<HTMLElement>('[data-r]');
  if (r) {
    const moved = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6;
    if (!moved) openChat(r.dataset.r!);
    return;
  }
  const a = t.closest<HTMLElement>('.ac[data-id]');
  const ev = a && evById(a.dataset.id!);
  if (ev) openEditor(ev);
});
$('#del').onclick = () => {
  const e = evById(state.sel);
  if (e) remove(e);
};

/* ---- toast with an optional action (Undo / Retry) ---- */
let toastTimer = 0;
function toast(text: string, action?: { label: string; run: () => unknown }) {
  const o = $('#toast'), b = o.querySelector('button')!;
  o.querySelector('span')!.textContent = text;
  b.hidden = !action;
  if (action) {
    b.textContent = action.label;
    b.onclick = () => {
      o.classList.remove('on');
      action.run();
    };
  }
  o.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => o.classList.remove('on'), action ? 7000 : 3200);
}

/* ---- confirm dialog (instead of window.confirm, so it matches the UI and works inside other dialogs) ---- */
function ask(title: string, message: string, yes = 'Continue', danger = false): Promise<boolean> {
  const d = $<HTMLDialogElement>('#ask'), y = $<HTMLButtonElement>('#ask-yes');
  $('#ask-t').textContent = title;
  $('#ask-m').textContent = message;
  y.textContent = yes;
  y.className = danger ? 'btn danger' : 'btn solid';
  return new Promise((done) => {
    const finish = (v: boolean) => {
      d.onclose = null;
      d.close();
      done(v);
    };
    y.onclick = () => finish(true);
    $('#ask-no').onclick = () => finish(false);
    d.onclose = () => done(false); // Escape key
    d.showModal();
    y.focus();
  });
}

/* ---- WhatsApp conversation drawer (sample conversation until the bot API is wired) ---- */
function openChat(id: string) {
  const r = reqs.find((x) => x.id === id);
  if (!r) return;
  const f = r.patientName.split(' ')[0], d = reqDate(r), slot = SLOT_LABEL[r.preferredSlot];
  const m = [
    ['in', `Boa tarde! Gostava de marcar uma consulta de ${TX[r.treatment].toLowerCase()}.`, '14:02'],
    ['out', `Olá, ${esc(f)}! Sou o assistente virtual da Clínica Sorriso 🦷 Tem preferência de dia e hora?`, '14:02'],
    ['in', `Pode ser dia ${fmt(d)}, ${slot.toLowerCase()}.`, '14:04'],
    ['out', 'Perfeito! Vou enviar o seu pedido à receção e confirmamos em breve ✅', '14:04'],
  ];
  $('#cav').textContent = ini(r.patientName);
  $('#cname').textContent = r.patientName;
  $('#msgs').innerHTML =
    '<div class="day">Today</div>' +
    m.map(([dir, t, h]) => `<div class="m ${dir}">${dir === 'out' ? '<span class="tag">Bot</span>' : ''}<div>${t}</div><small>${h}${dir === 'out' ? ' ✓✓' : ''}</small></div>`).join('');
  const ok = $<HTMLButtonElement>('#cok');
  ok.textContent = `Confirm ${fmt(d)}, ${slot}`;
  ok.onclick = () => {
    closeChat();
    schedule(r, d);
  };
  $('#chat').classList.add('on');
  $('#scrim').classList.add('on');
  $('#msgs').scrollTop = 1e5;
}
function closeChat() {
  $('#chat').classList.remove('on');
  $('#scrim').classList.remove('on');
}
$('#scrim').onclick = closeChat;
$('#cback').onclick = closeChat;

/* ---- appointment editor: create, view, edit, move, delete ---- */
const dlg = $<HTMLDialogElement>('#dlg');
const field = <T extends HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement = HTMLInputElement>(id: string) => $<T>('#f-' + id);
let editing: Ev | null = null;
$('#f-t').innerHTML = Object.entries(TX).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

function showError(msg: string | null) {
  const p = $('#f-err');
  p.hidden = !msg;
  p.textContent = msg ?? '';
}
function updateWa() {
  const n = waNumber(field('ph').value), a = $<HTMLAnchorElement>('#f-wa');
  a.hidden = !n;
  if (n) a.href = `https://wa.me/${n}`;
}
field('ph').addEventListener('input', updateWa);

function openEditor(e: Ev | null, preset?: { start: Date; end: Date }) {
  editing = e;
  if (e) {
    state.sel = e.id;
    refresh(false);
  }
  const start = e?.start ?? preset?.start ?? fromYmd(toYmd(state.day), 9);
  const end = e?.end ?? preset?.end ?? new Date(+start + 60 * 6e4);
  $('#dlg-title').textContent = e ? 'Appointment' : 'New appointment';
  field('p').value = e?.a.patientName ?? '';
  field('ph').value = e?.a.patientPhone ?? '';
  field('t').value = e?.a.treatment ?? 'cons';
  field('d').value = toYmd(start);
  field('h').value = `${p2(start.getHours())}:${p2(start.getMinutes())}`;
  field('m').value = String(Math.round((+end - +start) / 6e4));
  field('s').value = e?.a.status ?? 'booked';
  field<HTMLTextAreaElement>('n').value = e?.a.notes ?? '';
  $('#c-del').hidden = !e;
  $<HTMLButtonElement>('#c-save').disabled = false;
  showError(null);
  updateWa();
  dlg.showModal();
  (e ? $('#c-save') : field('p')).focus();
}

$('#c-cancel').onclick = () => dlg.close();
$('#c-del').onclick = async () => {
  if (editing && (await remove(editing))) dlg.close();
};
$<HTMLFormElement>('#dlg-form').onsubmit = async (ev) => {
  ev.preventDefault();
  const save = $<HTMLButtonElement>('#c-save');
  if (save.disabled) return; // already saving
  const patientName = field('p').value.trim(), d = field('d').value, h = field('h').value, mins = Number(field('m').value);
  if (!patientName) return showError('Enter the patient’s name.'), field('p').focus();
  if (!d || !h) return showError('Pick a date and a time.');
  if (!(mins >= 15)) return showError('The appointment must last at least 15 minutes.'), field('m').focus();
  const [hh, mm] = h.split(':').map(Number), start = fromYmd(d, hh + mm / 60), end = new Date(+start + mins * 6e4);
  const invalid = validateSlot(start, end);
  if (invalid) return showError(invalid);
  showError(null);
  if (!(await confirmSlot(start, end, editing?.id))) return;

  const data = {
    patientName, patientPhone: field('ph').value.trim() || undefined, treatment: field('t').value as Treatment,
    start: start.toISOString(), end: end.toISOString(), notes: field<HTMLTextAreaElement>('n').value.trim() || undefined,
    status: field('s').value as AppointmentStatus,
  };
  const was = editing;
  save.disabled = true;
  try {
    if (was) {
      const before = was.a;
      const a = await busy(api.updateAppointment(was.id, data, was.a.version));
      upsert(a);
      toast(`Saved ${a.patientName} · ${fmt(start)} ${hhmm(start)}`, undo('Change', async () => {
        const cur = evById(a.id);
        const { patientName, patientPhone, treatment, start, end, notes, status } = before;
        if (cur) upsert(await api.updateAppointment(a.id, { patientName, patientPhone, treatment, start, end, notes, status }, cur.a.version));
      }));
    } else {
      const a = await busy(api.createAppointment(data));
      upsert(a);
      state.sel = a.id;
      toast(`Added ${a.patientName} · ${fmt(start)} ${hhmm(start)}`, undo('Booking', async () => {
        const cur = evById(a.id);
        if (cur) {
          await api.deleteAppointment(a.id, cur.a.version);
          forget(a.id);
        }
      }));
    }
    dlg.close();
    state.day = start;
    cal.gotoDate(start);
    refresh(false);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 409 || err.status === 404)) dlg.close();
    else showError('Could not save. Check your connection and try again.');
    fail('Saving the appointment', err);
  } finally {
    save.disabled = false;
  }
};

/* ---- keyboard shortcuts (ignored while typing or when a dialog is open) ---- */
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeChat();
    $('#app').classList.remove('open');
    return;
  }
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
  if ((e.target as HTMLElement).closest('input,textarea,select,[contenteditable]') || document.querySelector('dialog[open]')) return;
  const views: Record<string, string> = { d: 'timeGridDay', w: 'timeGridWeek', m: 'dayGridMonth' };
  const k = e.key.toLowerCase();
  if (k === 'n') openEditor(null);
  else if (k === 'delete' || k === 'backspace') {
    const sel = evById(state.sel);
    if (sel) remove(sel);
  } else if (state.view !== 'calendar') return;
  else if (k === 't') cal.today();
  else if (e.key === 'ArrowLeft') cal.prev();
  else if (e.key === 'ArrowRight') cal.next();
  else if (views[k]) cal.changeView(views[k]);
  else return;
  e.preventDefault();
});

/* ---- create button ---- */
$('#create').onclick = () => openEditor(null);

/* ---- boot ---- */
cal.render();
renderReqs();
setView('calendar');
api.me().then((u) => {
  const me = $('#me');
  me.querySelector('.av')!.textContent = ini(u.name);
  me.querySelector('b')!.textContent = u.name;
  me.querySelector('small')!.textContent = u.role === 'dentist' ? 'Dentist' : 'Assistant';
}).catch((err) => fail('Loading your profile', err));
sync(true);
