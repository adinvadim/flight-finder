'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useDeleteToken } from '@/lib/tracker-storage/use-delete-token';
import styles from './Deals.module.css';

export function DealSettings({ queryId, discountPct, maxLayoverHours, canEdit }: { queryId: string; discountPct: number; maxLayoverHours: number | null; canEdit: boolean }) {
  const router = useRouter();
  const [discount, setDiscount] = useState(String(discountPct));
  const [layover, setLayover] = useState(maxLayoverHours?.toString() ?? '');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const token = useDeleteToken(queryId);
  if (!canEdit && !token) return null;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage('');
    try {
      const response = await fetch(`/api/queries/${queryId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteToken: token, dealMinDiscountPct: Number(discount), maxLayoverHours: layover === '' ? null : Number(layover) }) });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? 'Не удалось сохранить.');
      setMessage('Сохранено для всех маршрутов группы. После изменения история сравнения накапливается заново.'); router.refresh();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Ошибка сохранения.'); }
    finally { setPending(false); }
  }
  return <form className={styles.form} onSubmit={save}><div className={styles.columns}>
    <label>Минимальная скидка, %<input required type="number" min="1" max="95" value={discount} onChange={event => setDiscount(event.target.value)} /></label>
    <label>Каждая пересадка туда, максимум часов<input type="number" min="1" max="24" value={layover} onChange={event => setLayover(event.target.value)} placeholder="Без ограничения" /></label>
  </div><button type="submit" disabled={pending}>{pending ? 'Сохраняю…' : 'Сохранить порог и пересадки'}</button>{message && <p role="status">{message}</p>}</form>;
}
