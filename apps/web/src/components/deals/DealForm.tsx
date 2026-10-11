'use client';

import { useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import type { AirportResult } from '@/app/api/airports/route';
import { addSavedTracker } from '@/lib/tracker-storage';
import { calendarDate, dealDatePairs, MAX_DEAL_CHECKS, MAX_DEAL_DATE_PAIRS } from '@/lib/deals/date-window';
import { CountryAirports } from './CountryAirports';
import styles from './Deals.module.css';

interface CountryState { country: string; airports: AirportResult[]; selected: string[]; loading: boolean }
interface CreatedTracker { id: string; origin: string; destination: string; originName: string; destinationName: string; deleteToken: string }

function airportResults(value: unknown): AirportResult[] {
  if (!Array.isArray(value)) throw new Error('Некорректный ответ каталога.');
  return value.map(item => {
    if (!item || typeof item !== 'object' || typeof item.code !== 'string' || typeof item.city !== 'string'
      || typeof item.name !== 'string' || typeof item.country !== 'string') throw new Error('Некорректный ответ каталога.');
    return { code: item.code, city: item.city, name: item.name, country: item.country };
  });
}

export function DealForm({ countries, indonesia, discovery, initialDates }: {
  countries: { code: string; name: string }[]; indonesia: AirportResult[]; discovery: AirportResult[];
  initialDates: { from: string; to: string };
}) {
  const [origin, setOrigin] = useState<CountryState>({ country: 'ID', airports: indonesia, selected: ['DPS'], loading: false });
  const [destination, setDestination] = useState<CountryState>({ country: 'any', airports: discovery, selected: discovery.slice(0, 8).map(airport => airport.code), loading: false });
  const [tripType, setTripType] = useState('one_way');
  const [departureFrom, setDepartureFrom] = useState(initialDates.from);
  const [departureTo, setDepartureTo] = useState(initialDates.to);
  const [returnFrom, setReturnFrom] = useState('');
  const [returnTo, setReturnTo] = useState('');
  const [discount, setDiscount] = useState('30');
  const [stops, setStops] = useState('1');
  const [duration, setDuration] = useState('');
  const [layover, setLayover] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreatedTracker[]>([]);
  const requests = useRef({ origin: 0, destination: 0 });
  const today = new Date().toISOString().slice(0, 10);
  const dateFrom = calendarDate(departureFrom);
  const dateTo = calendarDate(tripType === 'one_way' ? departureTo : returnTo);
  const outboundDateTo = calendarDate(departureTo);
  const returnDateFrom = calendarDate(returnFrom);
  const pairs = dateFrom && dateTo && outboundDateTo ? dealDatePairs({ dateFrom, dateTo, outboundDateTo, returnDateFrom, tripType }) : [];
  const routes = origin.selected.flatMap(from => destination.selected.filter(to => to !== from).map(to => ({ origin: from, destination: to,
    originName: origin.airports.find(airport => airport.code === from)?.city ?? from,
    destinationName: destination.airports.find(airport => airport.code === to)?.city ?? to, selectedFlights: [] })));
  const checks = routes.length * pairs.length;
  const tooWide = routes.length > 20 || pairs.length > MAX_DEAL_DATE_PAIRS || checks > MAX_DEAL_CHECKS;

  async function changeCountry(side: 'origin' | 'destination', country: string) {
    const setSide = side === 'origin' ? setOrigin : setDestination;
    const sequence = ++requests.current[side];
    if (side === 'destination' && country === 'any') {
      setDestination({ country, airports: discovery, selected: discovery.slice(0, 8).map(airport => airport.code), loading: false });
      return;
    }
    setSide({ country, airports: [], selected: [], loading: !!country });
    if (!country) return;
    try {
      const response = await fetch(`/api/deals/airports?country=${encodeURIComponent(country)}`);
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? 'Каталог недоступен.');
      const airports = airportResults(payload.data);
      if (requests.current[side] === sequence) setSide({ country, airports, selected: [], loading: false });
    } catch (cause) {
      if (requests.current[side] === sequence) {
        setSide({ country, airports: [], selected: [], loading: false });
        setError(cause instanceof Error ? cause.message : 'Ошибка загрузки.');
      }
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!checks || tooWide) { setError('Выберите аэропорты и корректные окна дат в пределах лимита.'); return; }
    setSaving(true);
    try {
      const response = await fetch('/api/queries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        rawInput: `Дешёвые билеты из ${origin.country}${destination.country === 'any' ? ' — любые направления из выбранного набора' : ''}`, originCountry: origin.country, routes,
        dateFrom: departureFrom, outboundDateTo: departureTo, returnDateFrom: tripType === 'one_way' ? null : returnFrom,
        dateTo: tripType === 'one_way' ? departureTo : returnTo, tripType, flexibility: 0,
        dealMinDiscountPct: Number(discount), maxStops: stops === '' ? null : Number(stops),
        maxDurationHours: duration === '' ? null : Number(duration), maxLayoverHours: layover === '' ? null : Number(layover),
        currency, preferredAirlines: [], timePreference: 'any', cabinClass: 'economy',
      }) });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? 'Мониторинг не создан.');
      const trackers: CreatedTracker[] = payload.data.queries;
      for (const tracker of trackers) addSavedTracker({ ...tracker, dateFrom: departureFrom,
        dateTo: tripType === 'one_way' ? departureTo : returnTo, createdAt: new Date().toISOString() });
      setCreated(trackers);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось создать мониторинг.'); }
    finally { setSaving(false); }
  }

  return <form className={styles.form} onSubmit={submit}>
    <div className={styles.columns}>
      <CountryAirports label="Откуда" countries={countries} {...origin} onCountry={country => void changeCountry('origin', country)} onSelected={selected => setOrigin({ ...origin, selected })} />
      <CountryAirports label="Куда" countries={[{ code: 'any', name: 'Любые направления — стартовый набор' }, ...countries]} {...destination}
        description={destination.country === 'any' ? 'Выбираем среди 20 популярных аэропортов в разных странах. Отмеченные аэропорты — полное покрытие этого мониторинга; все аэропорты мира не сканируются. Можно менять набор или выбрать страну.' : undefined}
        onCountry={country => void changeCountry('destination', country)} onSelected={selected => setDestination({ ...destination, selected })} />
    </div>
    <fieldset><legend>Гибкие даты</legend>
      <label>Билет<select aria-label="Билет" value={tripType} onChange={event => setTripType(event.target.value)}><option value="round_trip">Туда и обратно</option><option value="one_way">В одну сторону</option></select></label>
      <div className={styles.columns}>
        <label>Вылет с<input required type="date" min={today} value={departureFrom} onChange={event => setDepartureFrom(event.target.value)} /></label>
        <label>Вылет по<input required type="date" min={departureFrom || today} value={departureTo} onChange={event => setDepartureTo(event.target.value)} /></label>
        {tripType === 'round_trip' && <><label>Возврат с<input required type="date" min={departureFrom || today} value={returnFrom} onChange={event => setReturnFrom(event.target.value)} /></label>
          <label>Возврат по<input required type="date" min={returnFrom || departureFrom || today} value={returnTo} onChange={event => setReturnTo(event.target.value)} /></label></>}
      </div>
      <p>Проверяем каждый день и все допустимые сочетания вылета и возврата. Возврат — позже вылета.</p>
    </fieldset>
    <fieldset><legend>Что считать выгодным</legend><div className={styles.columns}>
      <label>Скидка от обычной цены, %<input required type="number" min="1" max="95" step="1" value={discount} onChange={event => setDiscount(event.target.value)} /></label>
      <label>Валюта<select aria-label="Валюта" value={currency} onChange={event => setCurrency(event.target.value)}><option>USD</option><option>IDR</option><option>EUR</option><option>RUB</option></select></label>
      <label>Максимум пересадок<select aria-label="Максимум пересадок" value={stops} onChange={event => setStops(event.target.value)}><option value="">Без ограничения</option><option value="0">Только прямые</option><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></label>
      <label>Маршрут туда, максимум часов<input type="number" min="1" max="48" placeholder="Без ограничения" value={duration} onChange={event => setDuration(event.target.value)} /></label>
      <label>Каждая пересадка туда, максимум часов<input type="number" min="1" max="24" placeholder="Без ограничения" value={layover} onChange={event => setLayover(event.target.value)} /></label>
    </div><p>Обычная цена — медиана дневных минимумов за последние 30 дней для тех же дат, валюты и числа пересадок. Нужно минимум 5 дней истории. Цены — за одного взрослого в экономклассе.</p>
      <p>Ограничения времени и пересадок проверяются для показанного маршрута туда. Обратный маршрут и багаж проверяйте у продавца. Если время неизвестно, предложение не проходит соответствующий лимит.</p>
    </fieldset>
    <div className={styles.summary} aria-live="polite"><strong>{routes.length} маршрутов × {pairs.length} сочетаний дат = {checks} проверок за цикл</strong>
      <p>До 20 маршрутов, {MAX_DEAL_DATE_PAIRS} сочетаний дат на маршрут и {MAX_DEAL_CHECKS} проверок всего; каждое окно — до 31 дня. Поиск через браузер и AI может занять время и расходовать API-бюджет.</p>
      <p>Проверяем один текущий рынок. Дополнительные VPN-проверки из Settings здесь не применяются.</p>
      {tooWide && <p role="alert">Сузьте даты или выберите меньше аэропортов.</p>}
    </div>
    <p>После создания откройте мониторинг и подключите Telegram или другой канал в Notifications. Проверки идут по расписанию из Settings; интервал можно менять в мониторинге.</p>
    <div className={styles.actions}><button className={styles.primary} type="submit" disabled={saving || !checks || tooWide || origin.loading || destination.loading}>{saving ? 'Создаю…' : 'Начать мониторинг'}</button><Link href="/settings">Настройки источников и уведомлений</Link></div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {created.length > 0 && <div role="status"><h2>Мониторинг создан</h2><p>Первая проверка поставлена в очередь. Пока накапливается история, скидка не подтверждена.</p>
      {created.map(tracker => <p key={tracker.id}><Link href={`/q/${tracker.id}`}>{tracker.origin} → {tracker.destination}</Link></p>)}
    </div>}
  </form>;
}
