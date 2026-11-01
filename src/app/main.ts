// Staff scheduling app (dentist + assistant). All data goes through `api` (see src/app/api).
import { Calendar, type EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import { createApi, type Appointment, type AppointmentRequest, type Treatment } from './api';
import { SLOT_HOUR, SLOT_LABEL, TREATMENTS as TX, endFor, fromYmd, pad2 as p2, preferredRange, requestMinutes, toYmd } from './schedule';

const api = createApi();

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
interface Ev { id: string; p: string; tx: Treatment; start: Date; end: Date }
const toEv = (a: Appointment): Ev => ({ id: a.id, p: a.patientName, tx: a.treatment, start: new Date(a.start), end: new Date(a.end) });
const base = new Date();
base.setHours(0, 0, 0, 0);
let evs: Ev[] = [];
let reqs: AppointmentRequest[] = [];
const state = { view: 'calendar', q: '', sel: null as string | null, day: new Date(base), loaded: false };
const match = (e: { p: string; tx: Treatment }) => !state.q || (e.p + ' ' + TX[e.tx]).toLowerCase().includes(state.q.toLowerCase());
const reqDate = (r: AppointmentRequest) => preferredRange(r).start;
let useCache = false; // true = redraw the calendar from `evs` without asking the backend

/** Replace cached appointments that overlap [from, to) with fresh ones from the backend. */
function mergeRange(from: Date, to: Date, fresh: Appointment[]) {
  evs = evs.filter((e) => !(e.end > from && e.start < to)).concat(fresh.map(toEv));
}
async function load(from: Date, to: Date) {
  mergeRange(from, to, await api.listAppointments(from, to));
}

function fail(what: string, err: unknown) {
  console.error(what, err);
  toast(`${what} failed. Please try again.`);
}

/* ---- calendar ---- */
const evInput = (e: Ev): EventInput => ({
  id: e.id, title: e.p, start: e.start, end: e.end,
  classNames: ['tx-' + e.tx].concat(state.sel === e.id ? ['is-sel'] : []), extendedProps: { tx: e.tx },
});
const reqInput = (r: AppointmentRequest): EventInput => {
  const { start, end } = preferredRange(r);
  return { id: r.id, title: r.patientName, start, end, editable: false, classNames: ['tx-' + r.treatment, 'is-pending'], extendedProps: { tx: r.treatment, req: 1 } };
};
const dcn = (a: { date: Date }) => (a.date.toDateString() === state.day.toDateString() ? ['sel-day'] : []);

const cal = new Calendar($('#cal'), {
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
  initialView: mob() ? 'dayGridMonth' : 'timeGridWeek', headerToolbar: false, firstDay: 1, nowIndicator: true, allDaySlot: false, expandRows: true,
  slotMinTime: '08:00:00', slotMaxTime: '20:00:00', slotDuration: '00:30:00', slotLabelInterval: '01:00', height: mob() ? 'auto' : '100%',
  slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false }, eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
  views: { dayGridMonth: { eventDisplay: 'list-item', dayMaxEvents: false } },
  editable: true, droppable: true, snapDuration: '00:15:00', eventDurationEditable: true,
  events: (info, ok, bad) => {
    const cached = useCache;
    useCache = false;
    (cached ? Promise.resolve() : load(info.start, info.end))
      .then(() => {
        renderAgenda();
        renderPane();
        ok(evs.filter(match).map(evInput).concat(reqs.filter((r) => match({ p: r.patientName, tx: r.treatment })).map(reqInput)));
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
    const id = i.event.id;
    if (i.event.extendedProps.req) return openChat(id);
    state.sel = state.sel === id ? null : id;
    refresh(false);
  },
  // Moving / resizing an existing appointment.
  eventDrop: (i) => saveMove(i.event.id, i.event.start!, i.event.end!, i.revert),
  eventResize: (i) => saveMove(i.event.id, i.event.start!, i.event.end!, i.revert),
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
    const m = requestMinutes(r);
    return { title: r.patientName, duration: { minutes: m }, classNames: ['tx-' + r.treatment], extendedProps: { dropReq: r.id, tx: r.treatment }, create: true };
  },
});

async function saveMove(id: string, start: Date, end: Date, revert: () => void) {
  try {
    const a = await api.updateAppointment(id, { start: start.toISOString(), end: end.toISOString() });
    evs = evs.map((e) => (e.id === id ? toEv(a) : e));
    toast(`Moved ${a.patientName} · ${fmt(start)} ${hhmm(start)}`);
    refresh(false);
  } catch (err) {
    revert();
    fail('Moving the appointment', err);
  }
}

async function schedule(r: AppointmentRequest, start: Date) {
  try {
    const a = await api.scheduleRequest(r.id, { start: start.toISOString(), end: endFor(r, start).toISOString() });
    reqs = reqs.filter((x) => x.id !== r.id);
    evs.push(toEv(a));
    toast(`Scheduled ${r.patientName} · ${fmt(start)} ${hhmm(start)}`);
    refresh(false);
  } catch (err) {
    fail('Scheduling the request', err);
    refresh();
  }
}

/* ---- renderers ---- */
const card = (e: Ev) =>
  `<button class="ac tx-${e.tx}${state.sel === e.id ? ' is-sel' : ''}" data-id="${esc(e.id)}"><span class="ac-t">${hhmm(e.start)}–${hhmm(e.end)}</span><b>${esc(e.p)}</b><span class="chip">${TX[e.tx]}</span></button>`;
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
  useCache = !refetch;
  cal.refetchEvents();
  renderAgenda();
  renderReqs();
  renderPane();
  $<HTMLButtonElement>('#del').disabled = !state.sel;
}

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

/* ---- request cards, agenda, delete ---- */
// A drag that started on a request card must not also count as a click.
let down: { x: number; y: number } | null = null;
document.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
document.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const r = t.closest<HTMLElement>('[data-r]');
  if (r) {
    const moved = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6;
    if (!moved) openChat(r.dataset.r!);
    return;
  }
  const a = t.closest<HTMLElement>('.ac[data-id]');
  if (a) {
    state.sel = state.sel === a.dataset.id ? null : a.dataset.id!;
    refresh(false);
  }
});
$('#del').onclick = async () => {
  const e = evs.find((x) => x.id === state.sel);
  if (!e || !confirm(`Delete ${e.p}’s appointment on ${fmt(e.start)} at ${hhmm(e.start)}?`)) return;
  try {
    await api.deleteAppointment(e.id);
    evs = evs.filter((x) => x !== e);
    state.sel = null;
    refresh(false);
    toast(`Deleted ${e.p}’s appointment`);
  } catch (err) {
    fail('Deleting the appointment', err);
  }
};
function toast(t: string) {
  const o = $('#toast');
  o.textContent = t;
  o.classList.add('on');
  clearTimeout((toast as unknown as { t: number }).t);
  (toast as unknown as { t: number }).t = window.setTimeout(() => o.classList.remove('on'), 2600);
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
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeChat();
    $('#app').classList.remove('open');
  }
});

/* ---- create dialog ---- */
const dlg = $<HTMLDialogElement>('#dlg');
const val = (s: string) => $<HTMLInputElement>(s).value;
$('#f-t').innerHTML = Object.entries(TX).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
$('#create').onclick = () => {
  $<HTMLInputElement>('#f-p').value = '';
  $<HTMLInputElement>('#f-d').value = toYmd(state.day);
  dlg.showModal();
  $('#f-p').focus();
};
$('#c-cancel').onclick = () => dlg.close();
$('#c-save').onclick = async () => {
  const p = val('#f-p').trim(), d = val('#f-d'), h = val('#f-h');
  if (!p || !d || !h) return $('#f-p').focus();
  const [hh, mm] = h.split(':').map(Number), s = fromYmd(d, hh + mm / 60);
  try {
    const a = await api.createAppointment({
      patientName: p, treatment: val('#f-t') as Treatment, start: s.toISOString(), end: new Date(+s + Number(val('#f-m')) * 6e4).toISOString(),
    });
    evs.push(toEv(a));
    dlg.close();
    state.day = s;
    cal.gotoDate(s);
    refresh(false);
    toast(`Added ${p} · ${fmt(s)} ${hhmm(s)}`);
  } catch (err) {
    fail('Saving the appointment', err);
  }
};

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
// Preload a window around today so the List and Stats views have data before the calendar is browsed.
const winFrom = new Date(base), winTo = new Date(base);
winFrom.setDate(winFrom.getDate() - 7);
winTo.setDate(winTo.getDate() + 30);
Promise.all([api.listRequests(), load(winFrom, winTo)]).then(([r]) => {
  reqs = r;
  state.loaded = true;
  refresh(false);
}).catch((err) => fail('Loading requests', err));
