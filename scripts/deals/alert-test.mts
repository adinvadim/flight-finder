import assert from 'node:assert/strict';
import { prisma } from '../../apps/web/src/lib/prisma';
import { recordFlightAlert } from '../../apps/web/src/lib/notifications/flights';
import { assertPriceAuthority, decodePriceAuthority } from '../../apps/web/src/lib/notifications/rules/authority';

const database = new URL(process.env.DATABASE_URL ?? '');
assert.ok(['localhost', '127.0.0.1'].includes(database.hostname), 'Use a disposable local PostgreSQL database');
assert.equal(await prisma.notificationChannel.count({ where: { enabled: true } }), 0, 'Fixture database must have no enabled delivery channels');
const cycle = new Date(Date.now() - 1_000);
const outbound = new Date(Date.now() + 60 * 86_400_000);
const returnDate = new Date(outbound.getTime() + 7 * 86_400_000);
const query = await prisma.query.create({ data: { rawInput: 'Disposable deal outbox acceptance', origin: 'DPS', originName: 'Bali',
  destination: 'KUL', destinationName: 'Kuala Lumpur', dateFrom: outbound, outboundDateTo: outbound,
  returnDateFrom: returnDate, dateTo: returnDate, expiresAt: returnDate, originCountry: 'ID', currency: 'USD',
  maxStops: 1, maxDurationHours: 12, maxLayoverHours: 3, strictTravelDuration: true, dealMinDiscountPct: 30 } });

try {
  const observation = { queryId: query.id, travelDate: outbound, returnTravelDate: returnDate, currency: 'USD', airline: 'Fixture Air',
    stops: 1, duration: '8h', layovers: [{ duration: '2h', airport: 'SIN' }], bookingUrl: 'https://booking.example/deal' };
  await prisma.priceSnapshot.createMany({ data: Array.from({ length: 4 }, (_, index) => ({ ...observation, price: 100,
    scrapedAt: new Date(cycle.getTime() - (index + 1) * 86_400_000) })) });
  await prisma.priceSnapshot.create({ data: { ...observation, price: 70, scrapedAt: new Date() } });
  await recordFlightAlert(query.id, cycle);
  assert.equal(await prisma.travelAlertDelivery.count({ where: { queryId: query.id } }), 0, 'Four days must not authorize a deal');
  await prisma.priceSnapshot.create({ data: { ...observation, price: 100, scrapedAt: new Date(cycle.getTime() - 5 * 86_400_000) } });
  await recordFlightAlert(query.id, cycle);
  await recordFlightAlert(query.id, cycle);
  const events = await prisma.travelAlertDelivery.findMany({ where: { queryId: query.id } });
  assert.equal(events.length, 1, 'Repeated observations must deduplicate');
  const message = events[0]!.message;
  assert.ok(message && typeof message === 'object' && !Array.isArray(message));
  assert.equal(message.title, 'DPS → KUL: −30%');
  assert.ok(typeof message.body === 'string' && message.body.includes('5 дней наблюдений'));
  const authority = decodePriceAuthority(events[0]!.eventKey, message.priceAuthority);
  assert.equal(authority.kind, 'deal');
  await prisma.$transaction(tx => assertPriceAuthority(tx, query.id, authority));
  assert.equal(events[0]!.deliveredIds.length, 0, 'This acceptance check must not deliver externally');
  console.log('PASS: real PostgreSQL baseline warmup, 30% deal outbox, deduplication, delivery authority; no external notification sent.');
} finally {
  await prisma.query.delete({ where: { id: query.id } });
  await prisma.$disconnect();
}
