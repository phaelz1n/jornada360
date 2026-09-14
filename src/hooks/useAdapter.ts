'use client';

import { useState, useEffect } from 'react';
import { getAdapter, type IDataAdapter } from '@/lib/db';

/**
 * Hook que retorna o adapter de persistência.
 * Faz lazy-init assíncrono e retorna null enquanto carrega.
 */
export function useAdapter(): IDataAdapter | null {
  const [adapter, setAdapter] = useState<IDataAdapter | null>(null);

  useEffect(() => {
    getAdapter().then(setAdapter);
  }, []);

  return adapter;
}
