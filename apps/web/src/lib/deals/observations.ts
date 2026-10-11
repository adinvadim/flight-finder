import type { Prisma, Query } from '@/generated/prisma/client';
import { ACTUAL_FLIGHT_FARE_WHERE } from '../flight-pricing';
import { filterSnapshotsByTrackerFilters } from '../snapshot-filters';
import { BASELINE_WINDOW_DAYS, evaluateDeals } from './baseline';

/** Criteria edits and currency changes cannot contribute to a new baseline. */
export async function observedDeals(database: Pick<Prisma.TransactionClient, 'priceSnapshot'>, query: Query, cycleStartedAt: Date, baselineFrom?: Date | null) {
  const cutoff = new Date(cycleStartedAt.getTime() - (BASELINE_WINDOW_DAYS + 1) * 86_400_000);
  const from = baselineFrom && baselineFrom > cutoff ? baselineFrom : cutoff;
  const observations = await database.priceSnapshot.findMany({ where: { queryId: query.id, status: 'available',
    scrapedAt: { gte: from }, ...(query.currency ? { currency: query.currency } : {}), ...ACTUAL_FLIGHT_FARE_WHERE }, orderBy: { scrapedAt: 'desc' } });
  const eligible = filterSnapshotsByTrackerFilters(observations, query);
  const current = eligible.filter(snapshot => snapshot.scrapedAt >= cycleStartedAt);
  return evaluateDeals(current, eligible, query.dealMinDiscountPct ?? 30, cycleStartedAt);
}
