import type { Query } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { observedDeals } from '@/lib/deals/observations';
import { MIN_BASELINE_DAYS } from '@/lib/deals/baseline';
import { notificationBaselineFrom } from '@/lib/notifications/authority/flight';
import { formatCurrency } from '@/lib/currency';
import { safeHttpUrl } from '@/lib/safe-url';
import { DealSettings } from './DealSettings';
import { DealStatusRefresh } from './DealStatusRefresh';
import styles from './Deals.module.css';

export async function DealStatus({ query, cycleStartedAt, canEdit }: { query: Query; cycleStartedAt: Date; canEdit: boolean }) {
  const baselineFrom = await notificationBaselineFrom(prisma, query);
  const deals = await observedDeals(prisma, query, cycleStartedAt, baselineFrom);
  const seen = new Set<string>();
  const visible = deals.filter(deal => {
    const key = JSON.stringify([deal.snapshot.travelDate, deal.snapshot.returnTravelDate, deal.snapshot.stops, deal.snapshot.currency, deal.snapshot.vpnCountry]);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, 6);
  return <section className={styles.details} aria-label="Оценка скидки">
    <h3>Уведомляем при скидке от {query.dealMinDiscountPct}%</h3>
    <p>Вылет: {query.dateFrom.toISOString().slice(0, 10)} — {query.outboundDateTo?.toISOString().slice(0, 10)}.
      {query.returnDateFrom && <> Возврат: {query.returnDateFrom.toISOString().slice(0, 10)} — {query.dateTo.toISOString().slice(0, 10)}.</>}</p>
    <p>Обычная цена — медиана дневных минимумов за 30 дней для тех же дат, валюты и количества пересадок. Требуется {MIN_BASELINE_DAYS} дней истории; до этого уведомления о скидке не отправляются.</p>
    <p>Временные ограничения относятся к маршруту туда. Даты возврата входят в цену и сравнение; обратные пересадки и длительность нужно проверить у продавца.</p>
    {!visible.length && <p>Подходящих наблюдений последнего цикла пока нет. Смотрите статус проверки ниже; источники и каналы настраиваются в Settings и Notifications.</p>}
    <ul className={styles.dealList}>{visible.map(deal => <li key={deal.snapshot.id}>
      <strong>{formatCurrency(deal.snapshot.price, deal.snapshot.currency)}</strong> · {deal.snapshot.travelDate.toISOString().slice(0, 10)}
      {deal.snapshot.returnTravelDate && ` → ${deal.snapshot.returnTravelDate.toISOString().slice(0, 10)}`} · пересадок: {deal.snapshot.stops}
      <p>{deal.sampleDays < MIN_BASELINE_DAYS ? `Накапливаем историю: ${deal.sampleDays}/${MIN_BASELINE_DAYS} дней.`
        : `Обычная цена ${formatCurrency(deal.normalPrice ?? 0, deal.snapshot.currency)}; ${deal.qualifies ? 'выгодный билет' : 'порог скидки не достигнут'}, скидка ${Math.max(0, deal.discountPct ?? 0).toFixed(1)}%.`}</p>
      <small>Наблюдалось: {deal.snapshot.scrapedAt.toISOString()}. </small>
      {safeHttpUrl(deal.snapshot.bookingUrl) && <a href={safeHttpUrl(deal.snapshot.bookingUrl)} target="_blank" rel="noopener noreferrer">Проверить у продавца</a>}
    </li>)}</ul>
    <DealSettings queryId={query.id} discountPct={query.dealMinDiscountPct ?? 30} maxLayoverHours={query.maxLayoverHours} canEdit={canEdit} />
    <DealStatusRefresh />
  </section>;
}
