import { describe, expect, it } from 'vitest';
import { dealAlertExpiry } from './expiry';

describe('deal outbound delivery lifetime', () => {
  it('includes the whole outbound UTC day and excludes the next day', () => {
    const expiry = dealAlertExpiry('2026-10-11');
    expect(expiry > new Date('2026-10-11T23:59:59.999Z')).toBe(true);
    expect(expiry <= new Date('2026-10-12T00:00:00.000Z')).toBe(true);
  });
  it.each(['2026-02-31', '2026-10-11T00:00:00Z', null])('rejects malformed outbound metadata: %s', value => {
    expect(() => dealAlertExpiry(value)).toThrow('Invalid deal departure date');
  });
});
