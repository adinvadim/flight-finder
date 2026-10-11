import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import pg from 'pg';
import { addBrowserSession } from '../access-browser-test.mjs';

const origin = process.argv[2] ?? 'https://flight-finder.localhost:1355';
const database = new URL(process.env.DATABASE_URL ?? '');
assert.ok(['localhost', '127.0.0.1'].includes(database.hostname), 'Use a disposable local PostgreSQL database');
assert.ok(new URL(origin).hostname.endsWith('.localhost') || ['localhost', '127.0.0.1'].includes(new URL(origin).hostname), 'Use a local preview');
assert.ok(process.env.DEAL_TEST_SESSION_FILE, 'Provide an initialized disposable browser session file');
const token = (await readFile(process.env.DEAL_TEST_SESSION_FILE, 'utf8')).trim();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const queryId = randomUUID();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ignoreHTTPSErrors: true, serviceWorkers: 'block', viewport: { width: 1280, height: 1000 } });
await addBrowserSession(context, origin, token);
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', entry => { if (entry.type() === 'error') errors.push(entry.text()); });
const output = process.env.DEAL_TEST_OUTPUT ?? '/tmp/flight-finder-browser';
await mkdir(output, { recursive: true });
const tomorrow = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
const date = offset => new Date(new Date(tomorrow).getTime() + offset * 86_400_000).toISOString().slice(0, 10);

try {
  await pool.query('INSERT INTO "Query" (id,"rawInput",origin,"originName",destination,"destinationName","dateFrom","outboundDateTo","returnDateFrom","dateTo","expiresAt","updatedAt","originCountry","dealMinDiscountPct","strictTravelDuration",active,"maxStops","maxDurationHours","maxLayoverHours",currency) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,now(),$11,30,true,false,1,12,3,$12)',
    [queryId, 'Disposable deal browser fixture', 'DPS', 'Bali', 'KUL', 'Kuala Lumpur', date(0), date(2), date(10), date(12), 'ID', 'USD']);
  for (let day = 5; day >= 0; day--) {
    const scrapedAt = new Date(Date.now() - day * 86_400_000);
    await pool.query('INSERT INTO "PriceSnapshot" (id,"queryId","travelDate","returnTravelDate",price,currency,airline,stops,duration,layovers,"scrapedAt","bookingUrl","flightId") VALUES ($1,$2,$3,$4,$5,$6,$7,1,$8,$9,$10,$11,$12)',
      [randomUUID(), queryId, date(0), date(10), day === 0 ? 70 : 100, 'USD', 'Fixture Air', '8h', JSON.stringify([{duration:'2h',airport:'SIN'}]), scrapedAt, 'https://booking.example/deal', `FixtureAir-0800-DPS-KUL-${date(0)}-${date(10)}`]);
  }
  await pool.query('INSERT INTO "FetchRun" (id,"queryId",status,"startedAt","snapshotsCount") VALUES ($1,$2,$3,$4,1)', [randomUUID(), queryId, 'success', new Date(Date.now() - 60_000)]);
  await page.goto(`${origin}/deals`, { waitUntil: 'networkidle' });
  console.log('Loaded deals', await page.title());
  await page.screenshot({path: `${output}/initial.png`, fullPage: true});
  await page.getByRole('heading', { name: 'Ловим дешёвые билеты' }).waitFor();
  const from = page.getByRole('group', { name: 'Откуда', exact: true });
  const to = page.getByRole('group', { name: 'Куда', exact: true });
  console.log('Checking country selection');
  assert.equal(await from.getByLabel('Страна', { exact: true }).inputValue(), 'ID');
  assert.ok(await from.getByRole('checkbox', { name: /^DPS / }).isChecked());
  assert.equal(await from.getByRole('checkbox', { name: /^CGK / }).isChecked(), false);
  assert.equal(await to.getByLabel('Страна', { exact: true }).inputValue(), 'any');
  assert.equal(await page.getByLabel('Билет', { exact: true }).inputValue(), 'one_way');
  assert.ok(await page.getByText('8 маршрутов × 30 сочетаний дат = 240 проверок за цикл').isVisible());
  let submitted;
  await page.route('**/api/queries', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    submitted = route.request().postDataJSON();
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { queries: [
      { id: queryId, origin: 'DPS', destination: 'KUL', originName: 'Bali', destinationName: 'Kuala Lumpur', deleteToken: 'disposable-fixture' },
    ] } }) });
  });
  await page.screenshot({ path: `${output}/anywhere.png`, fullPage: true });
  await page.getByRole('button', { name: 'Начать мониторинг', exact: true }).click();
  await page.getByRole('heading', { name: 'Мониторинг создан' }).waitFor();
  assert.equal(submitted.tripType, 'one_way');
  assert.equal(submitted.routes.length, 8);
  assert.ok(submitted.routes.every(route => route.origin === 'DPS'));
  assert.deepEqual(submitted.routes.map(route => route.destination), ['KUL', 'SIN', 'BKK', 'SGN', 'NRT', 'SYD', 'DXB', 'AMS']);
  console.log('Selecting destination');
  await to.getByLabel('Страна', { exact: true }).selectOption('MY');
  await to.getByRole('checkbox', { name: /^KUL / }).check();
  await page.getByLabel('Билет', { exact: true }).selectOption('round_trip');
  console.log('Filling date windows');
  await page.getByLabel('Вылет с', { exact: true }).fill(date(0));
  await page.getByLabel('Вылет по', { exact: true }).fill(date(2));
  await page.getByLabel('Возврат с', { exact: true }).fill(date(10));
  await page.getByLabel('Возврат по', { exact: true }).fill(date(12));
  await page.getByLabel('Маршрут туда, максимум часов', { exact: true }).fill('12');
  await page.getByLabel('Каждая пересадка туда, максимум часов', { exact: true }).fill('3');
  assert.ok(await page.getByText('1 маршрутов × 9 сочетаний дат = 9 проверок за цикл').isVisible());
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true });
  await page.getByRole('button', { name: 'Начать мониторинг', exact: true }).click();
  await page.getByRole('heading', { name: 'Мониторинг создан' }).waitFor();
  assert.equal(submitted.originCountry, 'ID');
  assert.equal(submitted.outboundDateTo, date(2));
  assert.equal(submitted.returnDateFrom, date(10));
  assert.equal(submitted.dealMinDiscountPct, 30);
  assert.equal(submitted.maxLayoverHours, 3);
  assert.equal(submitted.maxDurationHours, 12);
  assert.equal(submitted.routes.length, 1);

  const oversized = await context.request.post(`${origin}/api/queries`, { data: { ...submitted,
    dateFrom: date(0), outboundDateTo: date(30), returnDateFrom: date(31), dateTo: date(61) }, headers: { Origin: origin } });
  assert.equal(oversized.status(), 400, await oversized.text());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/mobile.png`, fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Mobile form overflow');
  await page.goto(`${origin}/q/${queryId}`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Уведомляем при скидке от 30%' }).waitFor();
  assert.ok(await page.getByText(/выгодный билет.*скидка 30.0%/).isVisible());
  assert.ok(await page.getByText(/Обычная цена.*100/).isVisible());
  assert.deepEqual(errors, []);
  await page.screenshot({ path: `${output}/tracker.png`, fullPage: true });
  console.log(`PASS: Bali anywhere shortlist, 240 bounded checks, country selection, 9 return date combinations, payload, workload rejection, 30% historical deal, mobile layout. Screenshots: ${output}`);
} finally {
  await browser.close();
  await pool.query('DELETE FROM "Query" WHERE id=$1', [queryId]);
  await pool.end();
}
