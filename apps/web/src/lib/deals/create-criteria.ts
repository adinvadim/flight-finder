import { calendarDate, dealDatePairs, MAX_DEAL_CHECKS, MAX_DEAL_DATE_PAIRS } from './date-window';
import { airportInCountry, flightCountries } from './airports';

export function dealCreationCriteria(body: Record<string, unknown>, routes: readonly { origin: string; date?: string; selectedFlights?: unknown[] }[], now = new Date()) {
  if (body.outboundDateTo == null && body.dealMinDiscountPct == null && body.originCountry == null && body.maxLayoverHours == null) {
    return { data: null, error: null };
  }
  if (!routes.length) return { data: null, error: 'Выберите хотя бы один маршрут.' };
  const dateFrom = calendarDate(body.dateFrom);
  const dateTo = calendarDate(body.dateTo);
  const outboundDateTo = calendarDate(body.outboundDateTo);
  const returnDateFrom = body.tripType === 'one_way' ? null : calendarDate(body.returnDateFrom);
  const discount = body.dealMinDiscountPct;
  const layover = body.maxLayoverHours;
  const country = body.originCountry;
  if (!dateFrom || !dateTo || !outboundDateTo || (body.tripType !== 'one_way' && !returnDateFrom)) {
    return { data: null, error: 'Укажите корректные границы вылета и возврата.' };
  }
  if (body.tripType !== 'one_way' && body.tripType !== 'round_trip') return { data: null, error: 'Некорректный тип поездки.' };
  if (typeof country !== 'string' || !flightCountries.some(item => item.code === country)
    || routes.some(route => !airportInCountry(route.origin, country))) return { data: null, error: 'Аэропорты вылета должны принадлежать выбранной стране.' };
  if (routes.some(route => route.date || route.selectedFlights?.length) || body.sourceUrl) return { data: null, error: 'Гибкий мониторинг не поддерживает закреплённые рейсы и ссылки.' };
  if (typeof discount !== 'number' || !Number.isFinite(discount) || discount < 1 || discount > 95) return { data: null, error: 'Скидка должна быть от 1 до 95%.' };
  if (layover != null && (typeof layover !== 'number' || !Number.isInteger(layover) || layover < 1 || layover > 24)) return { data: null, error: 'Пересадка: от 1 до 24 часов.' };
  const today = new Date(now.toISOString().slice(0, 10));
  if (dateFrom < today || outboundDateTo < dateFrom || dateTo < (returnDateFrom ?? outboundDateTo)
    || (body.tripType === 'one_way' && dateTo.getTime() !== outboundDateTo.getTime())) return { data: null, error: 'Проверьте порядок дат; прошедшие даты не поддерживаются.' };
  const pairs = dealDatePairs({ dateFrom, dateTo, outboundDateTo, returnDateFrom, tripType: body.tripType });
  if (!pairs.length || pairs.length > MAX_DEAL_DATE_PAIRS || pairs.length * routes.length > MAX_DEAL_CHECKS) {
    return { data: null, error: `Сузьте окно или список аэропортов: до ${MAX_DEAL_DATE_PAIRS} сочетаний дат на маршрут и ${MAX_DEAL_CHECKS} проверок всего; каждое окно — до 31 дня.` };
  }
  return { data: { originCountry: country, outboundDateTo, returnDateFrom, dealMinDiscountPct: discount,
    maxLayoverHours: layover ?? null, strictTravelDuration: true }, error: null };
}
