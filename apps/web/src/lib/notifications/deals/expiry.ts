import { calendarDate } from '../../deals/date-window';

/** A deal can be delivered through its outbound UTC day, never afterwards. */
export function dealAlertExpiry(travelDate: unknown): Date {
  const day = calendarDate(travelDate);
  if (!day) throw new Error('Invalid deal departure date');
  day.setUTCDate(day.getUTCDate() + 1);
  return day;
}
