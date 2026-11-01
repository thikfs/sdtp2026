import { test, expect, type Locator, type Page } from '@playwright/test';

// Runs against the in-browser mock backend (no VITE_API_BASE_URL), whose sample data is placed relative to "now".
// The clock is fixed to Wednesday 4 Nov 2026, 07:00, so every slot used below is in the future.
// Today's sample appointments: Luís Coroa 09:00–09:45 and Joaquina Dentadura 14:00–16:00.
test.use({ viewport: { width: 1400, height: 900 } });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 10, 4, 7, 0));
  await page.goto('/app/');
  await expect(page.locator('#req .rq').first()).toBeVisible();
});

const panel = (page: Page) => page.getByRole('complementary', { name: 'Requested appointments' });
const appt = (page: Page, name: string) => page.locator('#cal .fc-event:not(.is-pending)', { hasText: name });
const toast = (page: Page) => page.locator('#toast');
const editor = (page: Page) => page.getByRole('dialog', { name: /appointment/i });

/** Point of a time row inside today's column. */
async function todayAt(page: Page, time: string) {
  const col = (await page.locator('.fc-timegrid-col.fc-day-today').boundingBox())!;
  const row = (await page.locator(`td.fc-timegrid-slot-lane[data-time="${time}:00"]`).boundingBox())!;
  return { x: col.x + col.width / 2, y: row.y + 4 };
}

/** Slow, stepwise mouse drag so FullCalendar recognises it. */
async function drag(page: Page, from: Locator, to: { x: number; y: number }, grab = { dx: 20, dy: 8 }) {
  const b = (await from.boundingBox())!;
  const sx = b.x + grab.dx, sy = b.y + grab.dy;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(sx + ((to.x - sx) * i) / 12, sy + ((to.y - sy) * i) / 12);
  await page.mouse.up();
}

test('shows the calendar and the requested appointments', async ({ page }) => {
  await expect(page.locator('#cal .fc-timegrid')).toBeVisible();
  await expect(panel(page).getByRole('heading', { name: /Requested Appointments/ })).toContainText('6');
  await expect(panel(page).locator('.rq')).toHaveCount(6);
});

test('dragging a request onto the calendar schedules it', async ({ page }) => {
  const card = panel(page).locator('.rq').first();
  const name = (await card.locator('b').textContent())!;
  await drag(page, card, await todayAt(page, '11:00'));

  await expect(toast(page)).toContainText(`Scheduled ${name}`);
  await expect(panel(page).locator('.rq')).toHaveCount(5);
  await expect(page.locator('.fc-day-today .fc-event:not(.is-pending)', { hasText: name })).toContainText('11:00');
});

test('confirming from the WhatsApp drawer schedules the preferred slot', async ({ page }) => {
  await panel(page).locator('.rq').first().click();
  await expect(page.locator('#chat')).toHaveClass(/on/);
  await page.locator('#cok').click();
  await expect(toast(page)).toContainText('Scheduled');
  await expect(panel(page).locator('.rq')).toHaveCount(5);
});

test('dragging an appointment moves it, and Undo puts it back', async ({ page }) => {
  await drag(page, appt(page, 'Luís Coroa'), await todayAt(page, '11:00'));
  await expect(toast(page)).toContainText('Moved Luís Coroa to 04/11 11:00');
  await expect(appt(page, 'Luís Coroa')).toContainText('11:00 - 11:45');

  await toast(page).getByRole('button', { name: 'Undo' }).click();
  await expect(toast(page)).toContainText('Move undone');
  await expect(appt(page, 'Luís Coroa')).toContainText('09:00 - 09:45');
});

test('an appointment can be moved to another day and time from its details', async ({ page }) => {
  await appt(page, 'Luís Coroa').click();
  await expect(editor(page)).toBeVisible();
  await expect(page.locator('#f-p')).toHaveValue('Luís Coroa');
  await expect(page.locator('#f-wa')).toHaveAttribute('href', /^https:\/\/wa\.me\/\d+$/);

  await page.locator('#f-d').fill('2026-11-06');
  await page.locator('#f-h').fill('16:30');
  await page.locator('#f-m').fill('60');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(editor(page)).toBeHidden();
  await expect(toast(page)).toContainText('Saved Luís Coroa · 06/11 16:30');
  await expect(page.locator('.fc-day-today .fc-event', { hasText: 'Luís Coroa' })).toHaveCount(0);
  await expect(page.locator('td[data-date="2026-11-06"] .fc-event', { hasText: 'Luís Coroa' })).toContainText('16:30 - 17:30');
});

test('booking over another appointment asks first', async ({ page }) => {
  await appt(page, 'Luís Coroa').click();
  await page.locator('#f-h').fill('14:30');
  await page.getByRole('button', { name: 'Save' }).click();

  const ask = page.getByRole('dialog', { name: 'Double-check this time' });
  await expect(ask).toContainText('Joaquina Dentadura (14:00–16:00)');
  await ask.getByRole('button', { name: 'Cancel' }).click();
  await expect(editor(page)).toBeVisible(); // nothing saved, still editing

  await page.getByRole('button', { name: 'Save' }).click();
  await ask.getByRole('button', { name: 'Book anyway' }).click();
  await expect(toast(page)).toContainText('Saved Luís Coroa');
  await expect(appt(page, 'Luís Coroa')).toContainText('14:30');
});

test('times outside opening hours are rejected with a clear message', async ({ page }) => {
  await page.getByRole('button', { name: 'Create' }).click();
  await page.locator('#f-p').fill('Teste Paciente');
  await page.locator('#f-h').fill('19:30');
  await page.locator('#f-m').fill('60');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('#f-err')).toContainText('The clinic is open 08:00–20:00');
  await expect(editor(page)).toBeVisible();
});

test('selecting an empty time range books it', async ({ page }) => {
  const from = await todayAt(page, '11:00'), to = await todayAt(page, '12:00');
  await page.mouse.move(from.x, from.y + 2);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y + 20, { steps: 4 });
  await page.mouse.move(to.x, to.y - 6, { steps: 8 });
  await page.mouse.up();

  await expect(editor(page)).toBeVisible();
  await expect(page.locator('#f-h')).toHaveValue('11:00');
  await expect(page.locator('#f-m')).toHaveValue('60');
  await page.locator('#f-p').fill('Teste Paciente');
  await page.locator('#f-ph').fill('+351 900 000 999');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(appt(page, 'Teste Paciente')).toContainText('11:00 - 12:00');
});

test('deleting asks for confirmation and can be undone', async ({ page }) => {
  await appt(page, 'Luís Coroa').click();
  await page.locator('#c-del').click();
  await page.getByRole('dialog', { name: 'Delete appointment?' }).getByRole('button', { name: 'Delete' }).click();
  await expect(appt(page, 'Luís Coroa')).toHaveCount(0);

  await toast(page).getByRole('button', { name: 'Undo' }).click();
  await expect(appt(page, 'Luís Coroa')).toContainText('09:00 - 09:45');
});

test('keyboard shortcuts navigate and open a new appointment', async ({ page }) => {
  const title = page.locator('#title');
  const thisWeek = await title.textContent();
  await page.keyboard.press('ArrowRight');
  await expect(title).not.toHaveText(thisWeek!);
  await page.keyboard.press('t');
  await expect(title).toHaveText(thisWeek!);
  await page.keyboard.press('m');
  await expect(page.locator('#vsel')).toHaveValue('dayGridMonth');
  await page.keyboard.press('n');
  await expect(page.getByRole('dialog', { name: 'New appointment' })).toBeVisible();
});
