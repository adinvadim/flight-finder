import { datePairKey } from './date-window';

export const MIN_BASELINE_DAYS = 5;
export const BASELINE_WINDOW_DAYS = 30;

export interface DealObservation {
  travelDate: Date;
  returnTravelDate?: Date | null;
  scrapedAt: Date;
  price: number;
  currency: string;
  stops: number;
  vpnCountry?: string | null;
}

function comparisonKey(snapshot: DealObservation): string {
  return JSON.stringify([datePairKey(snapshot.travelDate.toISOString(), snapshot.returnTravelDate?.toISOString()),
    snapshot.currency, snapshot.stops, snapshot.vpnCountry ?? null]);
}

/** Each prior UTC day has equal weight, regardless of scrape frequency or airline count. */
export function dealBaselines(history: readonly DealObservation[], now: Date): Map<string, { normalPrice: number; sampleDays: number }> {
  const today = now.toISOString().slice(0, 10);
  const cutoff = new Date(`${today}T00:00:00Z`).getTime() - BASELINE_WINDOW_DAYS * 86_400_000;
  const daily = new Map<string, Map<string, number>>();
  for (const snapshot of history) {
    const day = snapshot.scrapedAt.toISOString().slice(0, 10);
    if (day >= today || snapshot.scrapedAt.getTime() < cutoff || !Number.isFinite(snapshot.price) || snapshot.price <= 0) continue;
    const key = comparisonKey(snapshot);
    const prices = daily.get(key) ?? new Map<string, number>();
    prices.set(day, Math.min(prices.get(day) ?? Infinity, snapshot.price));
    daily.set(key, prices);
  }
  return new Map([...daily].map(([key, prices]) => {
    const sorted = [...prices.values()].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    const normalPrice = sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
    return [key, { normalPrice, sampleDays: sorted.length }];
  }));
}

export function evaluateDeals<T extends DealObservation>(current: readonly T[], history: readonly DealObservation[], discountPct: number, now: Date) {
  const baselines = dealBaselines(history, now);
  return current.map(snapshot => {
    const baseline = baselines.get(comparisonKey(snapshot));
    const normalPrice = baseline?.normalPrice ?? null;
    const sampleDays = baseline?.sampleDays ?? 0;
    const discount = normalPrice ? (normalPrice - snapshot.price) / normalPrice * 100 : null;
    return { snapshot, normalPrice, sampleDays, discountPct: discount,
      qualifies: Number.isFinite(snapshot.price) && snapshot.price > 0 && sampleDays >= MIN_BASELINE_DAYS
        && normalPrice !== null && Math.round((normalPrice - snapshot.price) * 100) >= Math.ceil(normalPrice * discountPct) };
  }).sort((left, right) => (right.discountPct ?? -Infinity) - (left.discountPct ?? -Infinity));
}
