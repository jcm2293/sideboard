'use client';

import { useWizard } from './WizardContext';
import { findHomebrewClass } from '@/data/homebrew-classes';

const inputClass =
  'bg-surface-light border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent w-full';
const compactNumber =
  'bg-surface-light border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-accent font-data text-center';

export default function StepManual() {
  const { state, dispatch } = useWizard();
  const classDef = findHomebrewClass(state.classId);

  return (
    <div className="space-y-5">
      <h2 className="font-display text-lg text-accent">Manual Fields</h2>

      <section>
        <label className="block text-sm font-medium text-muted mb-1">Equipment</label>
        {classDef && (
          <details className="mb-2 text-xs text-muted">
            <summary className="cursor-pointer hover:text-accent">Suggested starting equipment ({classDef.name})</summary>
            <ul className="pt-2 pl-3 border-l-2 border-border space-y-1">
              {classDef.starting_equipment_options.map((opt, i) => (
                <li key={i}>{opt}</li>
              ))}
            </ul>
          </details>
        )}
        <textarea
          value={state.equipmentText}
          onChange={(e) =>
            dispatch({ type: 'set_field', field: 'equipmentText', value: e.target.value })
          }
          className={`${inputClass} resize-none`}
          rows={6}
          placeholder="One item per line..."
        />
      </section>

      <section>
        <label className="block text-sm font-medium text-muted mb-2">Currency</label>
        <div className="grid grid-cols-5 gap-2 max-w-md">
          {(['cp', 'sp', 'ep', 'gp', 'pp'] as const).map((coin) => (
            <div key={coin} className="text-center">
              <div className="text-xs text-muted uppercase mb-1">{coin}</div>
              <input
                type="number"
                min={0}
                value={state.currency[coin]}
                onChange={(e) =>
                  dispatch({ type: 'set_currency', coin, value: Number(e.target.value) })
                }
                className={`${compactNumber} w-full`}
              />
            </div>
          ))}
        </div>
      </section>

      <section>
        <label className="block text-sm font-medium text-muted mb-1">Personality (optional)</label>
        <textarea
          value={state.personality}
          onChange={(e) =>
            dispatch({ type: 'set_field', field: 'personality', value: e.target.value })
          }
          className={`${inputClass} resize-none`}
          rows={3}
          placeholder="Traits, ideals, bonds, flaws..."
        />
      </section>

      <section>
        <label className="block text-sm font-medium text-muted mb-1">Appearance (optional)</label>
        <textarea
          value={state.appearance}
          onChange={(e) =>
            dispatch({ type: 'set_field', field: 'appearance', value: e.target.value })
          }
          className={`${inputClass} resize-none`}
          rows={3}
          placeholder="Description of your character's appearance..."
        />
      </section>
    </div>
  );
}
