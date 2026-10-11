import { describe, expect, it } from 'vitest';
import type { Query } from '@/generated/prisma/client';
import { criteriaVersion } from './flight';

const date = new Date('2027-01-01T00:00:00Z');
const legacyQuery: Query = {
  id: 'legacy-query', sourceUrl: null, rawInput: 'DPS to KUL', origin: 'DPS', originName: 'Bali',
  destination: 'KUL', destinationName: 'Kuala Lumpur', dateFrom: date, dateTo: date, flexibility: 0,
  originCountry: null, outboundDateTo: null, returnDateFrom: null, dealMinDiscountPct: null,
  maxLayoverHours: null, strictTravelDuration: false, maxPrice: null, maxStops: 1, maxDurationHours: null,
  preferredAirlines: [], preferredAggregators: [], timePreference: 'any', strictDepartureTime: false,
  cabinClass: 'economy', tripType: 'one_way', currency: 'USD', groupId: null, deleteToken: 'fixture-capability',
  active: true, isSeed: false, lookAheadDays: 14, expiresAt: new Date('2027-01-02T00:00:00Z'),
  firstViewedAt: null, vpnCountries: [], label: null, scrapeInterval: null, lastNotifiedLowPrice: null,
  lastNotifiedAt: null, userId: null, createdAt: new Date('2026-10-01T00:00:00Z'), updatedAt: date,
};

describe('flight notification criteria authority across additive upgrades', () => {
  it('preserves the pre-upgrade hash when new criteria are inactive', () => {
    // Captured with the pinned upstream criteriaVersion and its original Query fields.
    expect(criteriaVersion(legacyQuery)).toBe('75a43aae490befdc214e5049a30d96b5b018ab5b6584964bf6096da15f098f77');
  });

  it.each<Partial<Query>>([
    { originCountry: 'ID' }, { outboundDateTo: new Date('2027-01-03T00:00:00Z') },
    { returnDateFrom: new Date('2027-01-04T00:00:00Z') }, { dealMinDiscountPct: 30 },
    { maxLayoverHours: 3 }, { strictTravelDuration: true },
  ])('invalidates old authority when a new criterion is enabled: %o', criteria => {
    expect(criteriaVersion({ ...legacyQuery, ...criteria })).not.toBe(criteriaVersion(legacyQuery));
  });
});
