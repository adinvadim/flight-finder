import { expect, it } from 'vitest';
import { filterSnapshotsByTrackerFilters } from '../snapshot-filters';

const filters = { maxPrice: null, maxStops: 1, maxDurationHours: 8, maxLayoverHours: 2, strictTravelDuration: true, preferredAirlines: [] };
const fare = { price: 100, stops: 1, duration: '8h', airline: 'AirAsia', layovers: [{ duration: '2h', airport: 'KUL' }] };
it('requires evidence for time caps and enforces inclusive boundaries', () => {
  const fares = [fare, { ...fare, stops: 2 }, { ...fare, duration: null }, { ...fare, duration: '8h 1m' },
    { ...fare, layovers: null }, { ...fare, layovers: [{ duration: '2h 1m', airport: 'KUL' }] },
    { ...fare, stops: 0, layovers: null }];
  expect(filterSnapshotsByTrackerFilters(fares, filters)).toEqual([fare, fares[6]]);
});
it('keeps legacy unknown durations unless strict filtering or a layover cap is enabled', () => {
  expect(filterSnapshotsByTrackerFilters([{ ...fare, duration: null }], { ...filters, strictTravelDuration: false, maxLayoverHours: null })).toHaveLength(1);
});
