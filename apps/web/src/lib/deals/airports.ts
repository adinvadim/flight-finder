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

// A bounded discovery shortlist, not an exhaustive worldwide airport search.
const discoveryCodes = ['KUL', 'SIN', 'BKK', 'SGN', 'NRT', 'SYD', 'DXB', 'AMS',
  'CGK', 'HKG', 'ICN', 'TPE', 'MNL', 'PER', 'DOH', 'IST', 'LHR', 'CDG', 'FRA', 'LAX'];
export const discoveryAirports = discoveryCodes.flatMap(code => {
  const airport = countryAirports.find(item => item.code === code);
  return airport ? [airport] : [];
});
