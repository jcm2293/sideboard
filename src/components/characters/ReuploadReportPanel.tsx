'use client';

import { spellLevelLabel, type PdfOnlyGroup, type ReuploadReport } from '@/lib/character-merge';

interface ReuploadReportPanelProps {
  report: ReuploadReport;
  onAdd: (group: PdfOnlyGroup, indexes: number[]) => void;
  onDismiss: () => void;
}

function itemLabel(group: PdfOnlyGroup, index: number): string {
  if (group.section === 'spells') {
    const spell = group.items[index];
    return `${spell.name} (${spellLevelLabel(spell.level)})`;
  }
  return group.items[index].name;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-xs uppercase tracking-wider text-muted mb-1.5">{title}</h3>
      {children}
    </div>
  );
}

export default function ReuploadReportPanel({ report, onAdd, onDismiss }: ReuploadReportPanelProps) {
  const { warnings, updated, kept, pdfOnly, notInPdf } = report;
  const unchanged =
    warnings.length === 0 && updated.length === 0 && kept.length === 0 && pdfOnly.length === 0 && notInPdf.length === 0;

  return (
    <section className="card-parchment rounded-lg p-5 mb-6 border-2 border-gold/50">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg text-accent">Re-uploaded from PDF</h2>
        <button type="button" onClick={onDismiss} className="text-sm text-muted hover:text-foreground">
          Hide
        </button>
      </div>
      <p className="text-xs text-muted mt-1">
        Nothing is saved until you click Save. Numbers that move on a level-up came from the PDF; names, descriptions,
        and your edits stayed.
      </p>

      {warnings.length > 0 && (
        <div className="mt-4 p-3 border border-danger/40 bg-danger/5 rounded text-sm space-y-1">
          {warnings.map((w) => (
            <p key={w}>
              <strong className="text-danger">Check first:</strong> {w}
            </p>
          ))}
          <p className="text-xs text-muted">If this export is out of date, leave without saving and nothing changes.</p>
        </div>
      )}

      {unchanged && <p className="text-sm mt-4">The PDF matches this sheet — nothing to update.</p>}

      {updated.length > 0 && (
        <Group title={`Updated from the PDF (${updated.length})`}>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0.5 text-sm">
            {updated.map((c, i) => (
              <li key={i}>
                <span className="text-muted">{c.label}:</span> {c.from} → <strong>{c.to}</strong>
              </li>
            ))}
          </ul>
        </Group>
      )}

      {kept.length > 0 && (
        <Group title="Kept from your sheet (the PDF differs)">
          <ul className="space-y-0.5 text-sm">
            {kept.map((c, i) => (
              <li key={i}>
                <span className="text-muted">{c.label}:</span> {c.from}{' '}
                <span className="text-muted">(PDF: {c.to})</span>
              </li>
            ))}
          </ul>
        </Group>
      )}

      {pdfOnly.length > 0 && (
        <Group title="In the PDF but not on your sheet — add what's new">
          <div className="space-y-2">
            {pdfOnly.map((group) => (
              <div key={group.section}>
                <div className="flex items-baseline gap-3 text-sm">
                  <span>{group.label}</span>
                  {group.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onAdd(group, group.items.map((_, i) => i))}
                      className="text-xs text-accent hover:underline"
                    >
                      Add all
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {group.items.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onAdd(group, [i])}
                      className="text-xs px-2 py-0.5 rounded border border-border bg-surface-light hover:border-accent hover:text-accent transition-colors"
                      title="Add to sheet"
                    >
                      + {itemLabel(group, i)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Group>
      )}

      {notInPdf.length > 0 && (
        <Group title="On your sheet but not in the PDF — kept; remove any that are obsolete">
          <ul className="space-y-0.5 text-sm">
            {notInPdf.map((d) => (
              <li key={d.section}>
                <span className="text-muted">{d.section}:</span> {d.names.join(', ')}
              </li>
            ))}
          </ul>
        </Group>
      )}
    </section>
  );
}
