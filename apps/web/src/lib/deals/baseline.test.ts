import { describe, expect, it } from 'vitest';
import { evaluateDeals, type DealObservation } from './baseline';

const now = new Date('2026-10-11T12:00:00Z');
function fare(price: number, day = '2026-10-11', extra: Partial<DealObservation> = {}): DealObservation {
  return { price, scrapedAt: new Date(`${day}T08:00:00Z`), travelDate: new Date('2026-12-01'),
    returnTravelDate: new Date('2026-12-08'), currency: 'USD', stops: 1, ...extra };
}
const history = [100, 105, 110, 115, 120].map((price, index) => fare(price, `2026-10-0${index + 5}`));

describe('usual fare baseline', () => {
  it('uses one minimum per prior day and the median instead of weighting frequent scrapes', () => {
    const busyDay = Array.from({ length: 40 }, () => fare(500, '2026-10-05'));
    const result = evaluateDeals([fare(77)], [...history, ...busyDay, fare(1)], 30, now)[0]!;
    expect(result).toMatchObject({ normalPrice: 110, sampleDays: 5, qualifies: true });
    expect(evaluateDeals([fare(77.01)], history, 30, now)[0]!.qualifies).toBe(false);
  });
  it('stays silent until five prior days, ignoring old, zero and nonfinite fares', () => {
    const result = evaluateDeals([fare(1)], [...history.slice(0, 4), fare(1, '2026-08-01'), fare(0, '2026-10-09'), fare(Infinity, '2026-10-09')], 30, now)[0]!;
    expect(result).toMatchObject({ sampleDays: 4, qualifies: false });
  });
  it.each([
    { currency: 'IDR' }, { stops: 0 }, { vpnCountry: 'DE' },
    { travelDate: new Date('2026-12-02') }, { returnTravelDate: new Date('2026-12-09') }, { returnTravelDate: null },
  ])('does not mix incomparable fares: %j', extra => {
    expect(evaluateDeals([fare(1, undefined, extra)], history, 30, now)[0]).toMatchObject({ sampleDays: 0, qualifies: false });
  });
});
