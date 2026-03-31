'use client';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="card-parchment rounded p-6 max-w-sm w-full mx-4 shadow-xl">
        <h3 className="font-display text-accent mb-2">{title}</h3>
        <p className="text-sm text-muted mb-4">{message}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="btn-ghost px-4 py-2 rounded text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="bg-danger hover:bg-danger/80 text-amber-50 px-4 py-2 rounded text-sm font-display tracking-wide transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
