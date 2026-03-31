'use client';

import { useState } from 'react';

interface PickerItem {
  id: string;
  label: string;
}

interface EntityPickerProps {
  items: PickerItem[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}

export default function EntityPicker({
  items,
  selected,
  onChange,
  placeholder = 'Search...',
}: EntityPickerProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = items.filter(
    (item) =>
      item.label.toLowerCase().includes(search.toLowerCase()) &&
      !selected.includes(item.id)
  );

  const selectedItems = items.filter((item) => selected.includes(item.id));

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1 mb-1">
        {selectedItems.map((item) => (
          <span
            key={item.id}
            className="bg-gold/20 text-gold text-xs px-2 py-1 rounded flex items-center gap-1 border border-gold/30"
          >
            {item.label}
            <button
              onClick={() => onChange(selected.filter((id) => id !== item.id))}
              className="hover:text-danger"
            >
              ✕
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        placeholder={placeholder}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full bg-surface-light border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-surface border border-border rounded shadow-lg max-h-40 overflow-y-auto">
          {filtered.map((item) => (
            <button
              key={item.id}
              onMouseDown={() => {
                onChange([...selected, item.id]);
                setSearch('');
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-surface-light"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
