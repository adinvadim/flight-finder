import { NextRequest } from 'next/server';
import { countryAirports, flightCountries } from '@/lib/deals/airports';
import { apiSuccess, apiError } from '@/lib/api-response';

export function GET(request: NextRequest) {
  const country = request.nextUrl.searchParams.get('country');
  if (!flightCountries.some(item => item.code === country)) return apiError('Unknown country', 400);
  return apiSuccess(countryAirports.filter(airport => airport.country === country));
}
