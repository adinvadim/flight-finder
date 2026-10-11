'use client';

import { useSyncExternalStore } from 'react';
import { getDeleteToken } from '../tracker-storage';

function subscribe(listener: () => void): () => void {
  window.addEventListener('storage', listener);
  window.addEventListener('ft-trackers-changed', listener);
  return () => {
    window.removeEventListener('storage', listener);
    window.removeEventListener('ft-trackers-changed', listener);
  };
}

/** Match server markup before exposing capabilities stored only in this browser. */
export function useDeleteToken(queryId: string): string | null {
  return useSyncExternalStore(subscribe, () => getDeleteToken(queryId), () => null);
}
