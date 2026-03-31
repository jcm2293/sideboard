'use client';

import { useState, useEffect, useCallback } from 'react';

type AsyncStore<T extends { id: string }> = {
  getAll(filter?: Partial<T>): Promise<T[]>;
  create(data: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T | undefined>;
  delete(id: string): Promise<boolean>;
};

export function useCampaignData<T extends { id: string; campaign_id: string }>(
  store: AsyncStore<T>,
  campaignId: string
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await store.getAll({ campaign_id: campaignId } as Partial<T>);
    setItems(data);
    setLoading(false);
  }, [store, campaignId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (data: Omit<T, 'id' | 'created_at' | 'updated_at'>) => {
      const item = await store.create(data);
      await refresh();
      return item;
    },
    [store, refresh]
  );

  const update = useCallback(
    async (id: string, data: Partial<T>) => {
      const item = await store.update(id, data);
      await refresh();
      return item;
    },
    [store, refresh]
  );

  const remove = useCallback(
    async (id: string) => {
      await store.delete(id);
      await refresh();
    },
    [store, refresh]
  );

  return { items, loading, create, update, remove, refresh };
}
