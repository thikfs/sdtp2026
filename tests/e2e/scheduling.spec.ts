import { test, expect } from '@playwright/test';

// Runs against the in-browser mock backend (no VITE_API_BASE_URL).
test.use({ viewport: { width: 1400, height: 900 } });

test('the scheduling app shows the calendar and the requested appointments', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.locator('#cal .fc-timegrid')).toBeVisible();
  const panel = page.getByRole('complementary', { name: 'Requested appointments' });
  await expect(panel.getByRole('heading', { name: /Requested Appointments/ })).toContainText('6');
  await expect(panel.locator('.rq')).toHaveCount(6);
});

test('dragging a request onto the calendar schedules it', async ({ page }) => {
  await page.goto('/app/');
  const panel = page.getByRole('complementary', { name: 'Requested appointments' });
  const card = panel.locator('.rq').first();
  await expect(card).toBeVisible();
  const name = (await card.locator('b').textContent())!;

  // Target: the 11:00 row in today's column.
  const col = page.locator('.fc-timegrid-col.fc-day-today');
  const row = page.locator('td.fc-timegrid-slot-lane[data-time="11:00:00"]');
  const [c, r, from] = [await col.boundingBox(), await row.boundingBox(), await card.boundingBox()];
  await page.mouse.move(from!.x + 20, from!.y + 20);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(from!.x + 20 + ((c!.x + c!.width / 2 - from!.x - 20) * i) / 10, from!.y + 20 + ((r!.y + 4 - from!.y - 20) * i) / 10);
  }
  await page.mouse.up();

  await expect(page.locator('#toast')).toContainText(`Scheduled ${name}`);
  await expect(panel.locator('.rq')).toHaveCount(5);
  const ev = page.locator('.fc-day-today .fc-event:not(.is-pending)', { hasText: name });
  await expect(ev).toBeVisible();
  await expect(ev).toContainText('11:00');
});

test('confirming from the WhatsApp drawer schedules the preferred slot', async ({ page }) => {
  await page.goto('/app/');
  const panel = page.getByRole('complementary', { name: 'Requested appointments' });
  await panel.locator('.rq').first().click();
  await expect(page.locator('#chat')).toHaveClass(/on/);
  await page.locator('#cok').click();
  await expect(page.locator('#toast')).toContainText('Scheduled');
  await expect(panel.locator('.rq')).toHaveCount(5);
});
