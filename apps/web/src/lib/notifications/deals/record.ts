import { createHash } from 'node:crypto';
import type { Prisma, Query } from '@/generated/prisma/client';
import { observedDeals } from '../../deals/observations';
import { criteriaVersion } from '../authority/flight';
import { ruleCollection } from '../rules/store';
import type { NotificationRouting } from '../subscriptions/authority';
import { safeHttpUrl } from '../../safe-url';
import { formatCurrency } from '../../currency';
import { dealAlertExpiry } from './expiry';

export async function recordDealAlert(tx: Prisma.TransactionClient, query: Query, cycleStartedAt: Date,
  baselineFrom: Date | null, routing: NotificationRouting, baseUrl: string | null): Promise<void> {
  const deals = await observedDeals(tx, query, cycleStartedAt, baselineFrom);
  const collection = await ruleCollection(tx, query.id);
  const queryVersion = criteriaVersion(query);
  // One strongest deal per query and cycle; stable identity deduplicates repeated observations.
  const deal = deals.find(candidate => candidate.qualifies);
  if (!deal || deal.normalPrice === null || deal.discountPct === null) return;
  const snapshot = deal.snapshot;
  const travelDate = snapshot.travelDate.toISOString().slice(0, 10);
  if (dealAlertExpiry(travelDate) <= new Date()) return;
  const returnDate = snapshot.returnTravelDate?.toISOString().slice(0, 10) ?? null;
  const key = createHash('sha256').update(JSON.stringify([query.id, query.userId, queryVersion, routing.revision,
    collection.revision, travelDate, returnDate, snapshot.stops, snapshot.currency, snapshot.price, snapshot.vpnCountry])).digest('hex');
  const chartUrl = baseUrl ? `${baseUrl.replace(/\/+$/, '')}/q/${query.id}` : '';
  const title = `${query.origin} → ${query.destination}: −${Math.floor(deal.discountPct)}%`;
  const body = [
    `${formatCurrency(snapshot.price, snapshot.currency)} вместо обычных ${formatCurrency(deal.normalPrice, snapshot.currency)}`,
    `${travelDate}${returnDate ? ` → ${returnDate}` : ''} · ${snapshot.airline}`,
    `Пересадок: ${snapshot.stops}; маршрут туда: ${snapshot.duration ?? 'длительность неизвестна'}.`,
    `Обычная цена: медиана дневных минимумов за ${deal.sampleDays} дней наблюдений.`,
    `Проверено ${snapshot.scrapedAt.toISOString()}. Проверьте итоговую цену, багаж и обратный маршрут у продавца.`,
  ].join('\n');
  await tx.travelAlertDelivery.upsert({ where: { eventKey: `flight:${key}` }, update: {}, create: { queryId: query.id,
    eventKey: `flight:${key}`, message: { title, body, url: chartUrl || safeHttpUrl(snapshot.bookingUrl),
      priceAuthority: { kind: 'deal', collectionRevision: collection.revision },
      notificationRouting: JSON.parse(JSON.stringify(routing)), data: { kind: 'deal', queryId: query.id, userId: query.userId,
        queryVersion, currentMin: snapshot.price, baseline: deal.normalPrice, drop: deal.normalPrice - snapshot.price,
        currency: snapshot.currency, origin: query.origin, destination: query.destination, airline: snapshot.airline,
        travelDate, returnDate, bookingUrl: snapshot.bookingUrl, chartUrl, sampleDays: deal.sampleDays } } } });
}
