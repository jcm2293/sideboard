import { v4 as uuid } from 'uuid';

// Generic localStorage-backed CRUD store
// When Supabase is connected, swap these implementations

function getStore<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}

function setStore<T>(key: string, data: T[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
}

export function createDataStore<T extends { id: string }>(storageKey: string) {
  return {
    getAll(filter?: Partial<T>): T[] {
      let items = getStore<T>(storageKey);
      if (filter) {
        items = items.filter((item) =>
          Object.entries(filter).every(
            ([key, value]) => item[key as keyof T] === value
          )
        );
      }
      return items;
    },

    getById(id: string): T | undefined {
      return getStore<T>(storageKey).find((item) => item.id === id);
    },

    create(data: Omit<T, 'id' | 'created_at' | 'updated_at'>): T {
      const now = new Date().toISOString();
      const item = {
        id: uuid(),
        created_at: now,
        updated_at: now,
        ...data,
      } as unknown as T;
      const items = getStore<T>(storageKey);
      items.push(item);
      setStore(storageKey, items);
      return item;
    },

    update(id: string, data: Partial<T>): T | undefined {
      const items = getStore<T>(storageKey);
      const index = items.findIndex((item) => item.id === id);
      if (index === -1) return undefined;
      items[index] = {
        ...items[index],
        ...data,
        updated_at: new Date().toISOString(),
      };
      setStore(storageKey, items);
      return items[index];
    },

    delete(id: string): boolean {
      const items = getStore<T>(storageKey);
      const filtered = items.filter((item) => item.id !== id);
      if (filtered.length === items.length) return false;
      setStore(storageKey, filtered);
      return true;
    },
  };
}
