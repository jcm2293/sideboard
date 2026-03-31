'use client';

import { create } from 'zustand';

interface ShelfItem {
  id: string;
  type: string;
  label: string;
  data: Record<string, unknown>;
}

interface ShelfState {
  isOpen: boolean;
  items: ShelfItem[];
  toggle: () => void;
  open: () => void;
  close: () => void;
  addItem: (item: ShelfItem) => void;
  removeItem: (id: string) => void;
  clear: () => void;
}

export const useShelfStore = create<ShelfState>((set) => ({
  isOpen: false,
  items: [],
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  addItem: (item) =>
    set((s) => ({
      items: s.items.some((i) => i.id === item.id)
        ? s.items
        : [...s.items, item],
    })),
  removeItem: (id) =>
    set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  clear: () => set({ items: [] }),
}));
