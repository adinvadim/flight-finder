import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TravelNav } from '@/components/hotels/TravelNav';
import { DealForm } from '@/components/deals/DealForm';
import { countryAirports, flightCountries } from '@/lib/deals/airports';
import { getCurrentProfile } from '@/lib/user-auth';
import { isMultiUserEnabled } from '@/lib/multi-user';
import styles from '@/components/deals/Deals.module.css';

export const dynamic = 'force-dynamic';

export default async function DealsPage() {
  if (await isMultiUserEnabled() && !await getCurrentProfile()) redirect('/login?next=/deals');
  return <main className={styles.root}>
    <TravelNav active="deals" />
    <h1>Ловим дешёвые билеты</h1>
    <p>Выберите страну вылета, аэропорты и окна дат. Уведомляем, когда подходящий билет заметно дешевле обычного по вашей истории наблюдений.</p>
    <p><Link href="/">Мои мониторинги</Link></p>
    <DealForm countries={flightCountries} indonesia={countryAirports.filter(airport => airport.country === 'ID')} />
  </main>;
}
