export const MAX_DEAL_DATE_PAIRS = 64;
export const MAX_DEAL_CHECKS = 256;
const DAY_MS = 86_400_000;

export interface DealDateWindow {
  dateFrom: Date;
  dateTo: Date;
  outboundDateTo?: Date | null;
  returnDateFrom?: Date | null;
  tripType: string;
}

export function calendarDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? parsed : null;
}

function days(from: Date, to: Date): Date[] {
  const count = Math.floor((to.getTime() - from.getTime()) / DAY_MS) + 1;
  if (count < 1 || count > 31) return [];
  return Array.from({ length: count }, (_, index) => new Date(from.getTime() + index * DAY_MS));
}

/** Full grid, with a hard bound instead of silently sampling flexible dates. */
export function dealDatePairs(window: DealDateWindow): { outbound: Date; return_: Date }[] {
  const outboundDays = days(window.dateFrom, window.outboundDateTo ?? window.dateTo);
  if (window.tripType === 'one_way') return outboundDays.map(outbound => ({ outbound, return_: outbound }));
  const returnDays = days(window.returnDateFrom ?? window.dateTo, window.dateTo);
  return outboundDays.flatMap(outbound => returnDays.filter(return_ => return_ > outbound).map(return_ => ({ outbound, return_ })));
}

export function datePairKey(outbound: string, returnDate?: string | null): string {
  return JSON.stringify([outbound.slice(0, 10), returnDate?.slice(0, 10) ?? null]);
}
