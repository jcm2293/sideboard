'use client';

interface ShelfCardProps {
  label: string;
  type: string;
  onRemove: () => void;
  children?: React.ReactNode;
}

export default function ShelfCard({ label, type, onRemove, children }: ShelfCardProps) {
  return (
    <div className="shelf-card card-parchment rounded p-3 mb-2 border-l-3 border-l-gold transition-transform duration-150">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted uppercase tracking-wider font-display">{type}</span>
        <button
          onClick={onRemove}
          className="text-muted hover:text-danger text-sm"
          title="Remove"
        >
          ✕
        </button>
      </div>
      <h4 className="text-sm text-foreground mb-1 font-display">{label}</h4>
      {children}
    </div>
  );
}
