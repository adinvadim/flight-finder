import catalog from '../../data/airports.json';

export const countryAirports = Object.entries(catalog).map(([code, values]) => ({
  code, city: values[0] ?? '', name: values[1] ?? '', country: values[2] ?? '',
})).sort((left, right) => left.city.localeCompare(right.city));

const names = new Intl.DisplayNames(['ru'], { type: 'region' });
export const flightCountries = [...new Set(countryAirports.map(airport => airport.country))]
  .filter(code => /^[A-Z]{2}$/.test(code))
  .map(code => ({ code, name: names.of(code) ?? code }))
  .sort((left, right) => left.name.localeCompare(right.name, 'ru'));

export function airportInCountry(code: string, country: string): boolean {
  return countryAirports.some(airport => airport.code === code && airport.country === country);
}
