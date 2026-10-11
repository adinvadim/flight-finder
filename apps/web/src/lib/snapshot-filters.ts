import { coerceLayovers, parseDurationToMinutes } from './scraper/duration';
import { matchesDepartureWindow } from './criteria/departure';

export interface TrackerSnapshotFilters {
  maxPrice: number | null | undefined;
  maxStops: number | null | undefined;
  maxDurationHours: number | null | undefined;
  maxLayoverHours?: number | null;
  strictTravelDuration?: boolean;
  preferredAirlines: readonly string[] | null | undefined;
  timePreference?: string | null;
  strictDepartureTime?: boolean;
}

interface FilterableSnapshot {
  price: number;
  stops: number;
  duration: string | null;
  airline: string;
  departureTime?: string | null;
  layovers?: unknown;
}

function airlineMatches(snapshotAirline: string, preferredAirline: string): boolean {
  const snapshot = snapshotAirline.trim().toLowerCase();
  const preferred = preferredAirline.trim().toLowerCase();
  if (!snapshot || !preferred) return false;
  // Snapshot airlines are provider display names, not normalized airline IDs,
  // so retroactive airline filtering is necessarily name-based.
  if (preferred.length < 4) {
    return (
      snapshot === preferred ||
      snapshot.startsWith(`${preferred} `) ||
      snapshot.endsWith(` ${preferred}`) ||
      snapshot.includes(` ${preferred} `)
    );
  }
  return snapshot.includes(preferred);
}

export function filterSnapshotsByTrackerFilters<T extends FilterableSnapshot>(
  snapshots: T[],
  filters: TrackerSnapshotFilters,
): T[] {
  const preferredAirlines = filters.preferredAirlines?.filter((airline) => airline.trim()) ?? [];

  return snapshots.filter((snapshot) => {
    if (filters.strictDepartureTime && !matchesDepartureWindow(snapshot.departureTime, filters.timePreference)) return false;
    if (filters.maxPrice !== null && filters.maxPrice !== undefined && snapshot.price > filters.maxPrice) {
      return false;
    }

    if (filters.maxStops !== null && filters.maxStops !== undefined && snapshot.stops > filters.maxStops) {
      return false;
    }

    if (filters.maxDurationHours !== null && filters.maxDurationHours !== undefined) {
      const minutes = parseDurationToMinutes(snapshot.duration);
      if (minutes === null && filters.strictTravelDuration) return false;
      if (minutes !== null && minutes > filters.maxDurationHours * 60) return false;
    }

    const maxLayoverHours = filters.maxLayoverHours;
    if (maxLayoverHours != null && snapshot.stops > 0) {
      const layovers = coerceLayovers(snapshot.layovers);
      if (!layovers || layovers.length !== snapshot.stops) return false;
      if (layovers.some(layover => (parseDurationToMinutes(layover.duration) ?? Infinity) > maxLayoverHours * 60)) return false;
    }

    if (preferredAirlines.length > 0 && !preferredAirlines.some((airline) => airlineMatches(snapshot.airline, airline))) {
      return false;
    }

    return true;
  });
}
