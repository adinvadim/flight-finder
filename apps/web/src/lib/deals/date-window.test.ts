import { describe, expect, it } from 'vitest';
import { calendarDate, dealDatePairs } from './date-window';
import { expandQueryDates } from '../scraper/scrape-dates';
import { flightIdentifiers } from '../scraper/identity/flight';
import { latestFlightObservations } from '../flight-pricing';
import { dealCreationCriteria } from './create-criteria';

const day = (date: string) => new Date(date);
const window = { dateFrom: day('2026-12-01'), outboundDateTo: day('2026-12-03'),
  returnDateFrom: day('2026-12-03'), dateTo: day('2026-12-05'), tripType: 'round_trip' };

describe('explicit flexible windows', () => {
  it('checks the entire round-trip grid and excludes return before/equal departure', () => {
    const pairs = expandQueryDates({ ...window, flexibility: 0 });
    expect(pairs).toHaveLength(8);
    expect(pairs.map(pair => [pair.outbound.toISOString().slice(0, 10), pair.return_.toISOString().slice(0, 10)]))
      .toContainEqual(['2026-12-02', '2026-12-04']);
    expect(pairs.every(pair => pair.return_ > pair.outbound)).toBe(true);
  });
  it('checks all one-way dates beyond the legacy seven-day sample', () => {
    expect(dealDatePairs({ ...window, tripType: 'one_way', outboundDateTo: day('2026-12-12') })).toHaveLength(12);
    expect(calendarDate('2026-02-31')).toBeNull();
  });
  it('retains same flight with different returns in identifiers and latest observations', () => {
    const fare = { airline: 'AirAsia', flightNumber: 'AK100', travelDate: '2026-12-01',
      currency: 'USD', price: 100, scrapedAt: '2026-10-11T08:00:00Z', status: 'available' };
    const observations = ['2026-12-05', '2026-12-06'].map(returnTravelDate => ({ ...fare, returnTravelDate }));
    expect(new Set(observations.map(item => flightIdentifiers('DPS', 'KUL', item).flightId)).size).toBe(2);
    expect(latestFlightObservations(observations, { origin: 'DPS', destination: 'KUL' })).toHaveLength(2);
  });
});

describe('deal creation boundary', () => {
  const input = { dateFrom: '2026-12-01', outboundDateTo: '2026-12-03', returnDateFrom: '2026-12-03',
    dateTo: '2026-12-05', tripType: 'round_trip', originCountry: 'ID', dealMinDiscountPct: 30, maxLayoverHours: 4 };
  const routes = [{ origin: 'DPS', selectedFlights: [] }];
  it('accepts Indonesia and persists independent windows and strict time filtering', () => {
    expect(dealCreationCriteria(input, routes, day('2026-10-11'))).toMatchObject({ error: null,
      data: { originCountry: 'ID', outboundDateTo: day('2026-12-03'), strictTravelDuration: true, dealMinDiscountPct: 30 } });
  });
  it.each([{ originCountry: 'TH' }, { dealMinDiscountPct: 0 }, { maxLayoverHours: 25 },
    { outboundDateTo: '2027-01-31' }, { dateFrom: '2026-01-01' }, { returnDateFrom: '2026-12-06' },
    { outboundDateTo: '2026-12-31', returnDateFrom: '2027-01-01', dateTo: '2027-01-31' },
  ])('rejects invalid or oversized requests: %j', override => {
    expect(dealCreationCriteria({ ...input, ...override }, routes, day('2026-10-11')).error).toBeTruthy();
  });
  it('preserves legacy input and rejects date pins in flexible mode', () => {
    expect(dealCreationCriteria({}, routes).data).toBeNull();
    expect(dealCreationCriteria(input, [{ origin: 'DPS', date: '2026-12-01' }], day('2026-10-11')).error).toBeTruthy();
  });
});
