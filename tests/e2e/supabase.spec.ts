import { test, expect, type Page, type Browser } from '@playwright/test';

// The real app against a local Supabase (supabase start + supabase db reset, seed data).
// Run with:  E2E_SUPABASE=1 VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=<anon key> npx playwright test supabase
// Skipped otherwise, so the normal CI run (mock data) is unaffected.
test.skip(!process.env.E2E_SUPABASE, 'needs a local Supabase (E2E_SUPABASE=1)');
test.describe.configure({ mode: 'serial' }); // the tests share one database

// The browser runs in the clinic's time zone, with "today" moved to tomorrow 07:00 so every
// slot used below is in the future whatever time CI runs. Tomorrow's seed: Marta Branca 10:00–11:00.
test.use({ viewport: { width: 1400, height: 900 }, timezoneId: 'Europe/Lisbon' });
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const day = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

async function open(page: Page, email = 'assistant@clinica.test', password = 'assistant-local-pw') {
  await page.clock.setFixedTime(new Date(`${day}T07:00:00`));
  await page.goto('/app/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('#signin')).toBeHidden();
  await expect(page.locator('#req .rq').first()).toBeVisible();
}
const appt = (page: Page, name: string) => page.locator('#cal .fc-event:not(.is-pending)', { hasText: name });
const newPage = async (browser: Browser) => (await browser.newContext({ viewport: { width: 1400, height: 900 }, timezoneId: 'Europe/Lisbon' })).newPage();

test('nothing is visible before signing in, and wrong passwords are refused', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Clínica Sorriso' })).toBeVisible();
  await expect(page.locator('#cal .fc-event')).toHaveCount(0);
  await page.getByLabel('Email').fill('assistant@clinica.test');
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('#si-err')).toHaveText('Wrong email or password.');
});

test('staff sign in and see the shared calendar and requests', async ({ page }) => {
  await open(page);
  await expect(page.locator('#me')).toContainText('Rita Assistente');
  await expect(page.locator('#req .rq')).toHaveCount(6);
  await expect(appt(page, 'Marta Branca')).toContainText('10:00 - 11:00');
});

test('a dragged request is saved in the database', async ({ page }) => {
  await open(page);
  const card = page.locator('#req .rq').first(), name = (await card.locator('b').textContent())!;
  const col = (await page.locator('.fc-timegrid-col.fc-day-today').boundingBox())!;
  const row = (await page.locator('td.fc-timegrid-slot-lane[data-time="12:00:00"]').boundingBox())!;
  const b = (await card.boundingBox())!;
  await page.mouse.move(b.x + 20, b.y + 8);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(b.x + 20 + ((col.x + col.width / 2 - b.x - 20) * i) / 12, b.y + 8 + ((row.y + 4 - b.y - 8) * i) / 12);
  await page.mouse.up();
  await expect(page.locator('#toast')).toContainText(`Scheduled ${name}`);

  await page.reload();
  await page.clock.setFixedTime(new Date(`${day}T07:00:00`));
  await expect(appt(page, name)).toContainText('12:00');
  await expect(page.locator('#req .rq')).toHaveCount(5);
});

test('two staff members: changes appear live, and a stale edit is refused instead of overwriting', async ({ browser }) => {
  const dentist = await newPage(browser), assistant = await newPage(browser);
  await open(dentist, 'dentist@clinica.test', 'dentist-local-pw');
  await open(assistant);

  // Both open Marta's appointment.
  await appt(dentist, 'Marta Branca').click();
  await appt(assistant, 'Marta Branca').click();

  // The assistant moves it first.
  await assistant.locator('#f-h').fill('15:00');
  await assistant.getByRole('button', { name: 'Save' }).click();
  await expect(assistant.locator('#toast')).toContainText('Saved Marta Branca');

  // The dentist, still looking at the old version, tries to change it: refused, then shown the latest.
  await dentist.locator('#f-n').fill('dentist note');
  await dentist.getByRole('button', { name: 'Save' }).click();
  await expect(dentist.locator('#toast')).toContainText('someone else changed this');
  await expect(appt(dentist, 'Marta Branca')).toContainText('15:00 - 16:00');

  // Live update: the assistant books someone; the dentist sees it without reloading.
  await assistant.getByRole('button', { name: 'Create' }).click();
  await assistant.locator('#f-p').fill('Paciente Ao Vivo');
  await assistant.locator('#f-h').fill('17:00');
  await assistant.getByRole('button', { name: 'Save' }).click();
  await expect(appt(dentist, 'Paciente Ao Vivo')).toBeVisible({ timeout: 10_000 });
});
