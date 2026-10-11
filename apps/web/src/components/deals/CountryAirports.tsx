'use client';

import { useState } from 'react';
import type { AirportResult } from '@/app/api/airports/route';
import styles from './Deals.module.css';

interface Props {
  label: string;
  countries: { code: string; name: string }[];
  country: string;
  airports: AirportResult[];
  selected: string[];
  onCountry: (country: string) => void;
  onSelected: (codes: string[]) => void;
  loading: boolean;
}

export function CountryAirports({ label, countries, country, airports, selected, onCountry, onSelected, loading }: Props) {
  const [search, setSearch] = useState('');
  const visible = airports.filter(airport => `${airport.code} ${airport.city} ${airport.name}`.toLowerCase().includes(search.toLowerCase()));
  return <fieldset className={styles.airports}>
    <legend>{label}</legend>
    <label>Страна<select aria-label="Страна" value={country} onChange={event => { setSearch(''); onCountry(event.target.value); }}>
      <option value="">Выберите страну</option>
      {countries.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
    </select></label>
    <label>Найти аэропорт<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Город или IATA: DPS, CGK…" /></label>
    <div className={styles.actions}>
      <button type="button" disabled={loading || !visible.length} onClick={() => onSelected([...new Set([...selected, ...visible.map(item => item.code)])])}>Выбрать найденные</button>
      <button type="button" disabled={!selected.length} onClick={() => onSelected([])}>Снять все</button>
      <span aria-live="polite">Выбрано: {selected.length}</span>
    </div>
    <div className={styles.airportList} aria-busy={loading}>
      {loading ? <p>Загрузка аэропортов…</p> : visible.map(airport => <label key={airport.code} className={styles.airport}>
        <input type="checkbox" checked={selected.includes(airport.code)} onChange={event => onSelected(event.target.checked ? [...selected, airport.code] : selected.filter(code => code !== airport.code))} />
        <span><strong>{airport.code}</strong> {airport.city}<small>{airport.name}</small></span>
      </label>)}
      {!loading && !visible.length && <p>Аэропорты не найдены.</p>}
    </div>
    <small>Каталог включает небольшие аэропорты; наличие регулярных рейсов проверяется при поиске.</small>
  </fieldset>;
}
