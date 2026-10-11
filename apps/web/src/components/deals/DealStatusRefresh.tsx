'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './Deals.module.css';

export function DealStatusRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, 60_000);
    return () => clearInterval(timer);
  }, [router]);
  return <button className={styles.refresh} type="button" onClick={() => router.refresh()}>Обновить оценку скидки</button>;
}
