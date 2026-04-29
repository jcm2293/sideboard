'use client';

import { useWizard } from './WizardContext';
import { findHomebrewClass } from '@/data/homebrew-classes';
import { ABILITY_KEYS } from '@/lib/homebrew/wizard-reducer';
import type { AbilityKey } from '@/types/homebrew-class';
import type { ASIChoice } from '@/lib/homebrew/wizard-reducer';

const inputClass =
  'bg-surface-light border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-accent';

export default function StepLevels() {
  const { state, dispatch } = useWizard();
  const classDef = findHomebrewClass(state.classId);
  if (!classDef) return null;

  const subclass = state.subclassId
    ? classDef.subclasses.find((s) => s.id === state.subclassId)
    : null;

  const levels = classDef.level_progression
    .filter((e) => e.level <= state.level)
    .filter((e) => e.level >= 2); // Level 1 is fully covered by Steps 1+2

  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg text-accent">Level-by-Level</h2>
      <p className="text-xs text-muted">
        Step through levels 2–{state.level}. Display-only feature lists are pulled from the class definition;
        ASI levels prompt for a choice (ability boost or feat).
      </p>

      {levels.length === 0 && (
        <p className="text-sm text-muted italic">
          Nothing to decide here at level {state.level}. Continue to the next step.
        </p>
      )}

      <div className="space-y-3">
        {levels.map((entry) => {
          const featureNames = entry.features
            .filter((f) => {
              const def = classDef.features[f];
              return def && !def.hide_on_sheet;
            })
            .map((f) => classDef.features[f].name);

          const isASI = entry.features.includes('ability_score_improvement');
          const subclassFeatures: string[] = [];
          if (subclass && entry.level >= classDef.subclass_choice_level) {
            const subFeats = subclass.features_by_level[entry.level] ?? [];
            for (const id of subFeats) {
              const def = subclass.features[id];
              if (def && !def.hide_on_sheet) subclassFeatures.push(def.name);
            }
          }

          return (
            <div key={entry.level} className="border border-border rounded p-3 bg-surface-light/40">
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="font-display text-base text-accent">Level {entry.level}</h3>
                <span className="text-xs text-muted">PB +{entry.proficiency_bonus}</span>
              </div>

              {/* Class features gained */}
              {featureNames.length > 0 && (
                <div className="text-sm mb-1">
                  <span className="text-muted">Class:</span>{' '}
                  {featureNames.join(', ')}
                </div>
              )}
              {subclassFeatures.length > 0 && (
                <div className="text-sm mb-1">
                  <span className="text-muted">Subclass:</span>{' '}
                  {subclassFeatures.join(', ')}
                </div>
              )}
              {entry.cantrips_known != null && entry.cantrips_known > 0 && (
                <div className="text-xs text-muted">Cantrips known at this level: {entry.cantrips_known}</div>
              )}
              {entry.spells_known != null && entry.spells_known > 0 && (
                <div className="text-xs text-muted">Spells known at this level: {entry.spells_known}</div>
              )}

              {/* ASI prompt */}
              {isASI && <ASIPrompt level={entry.level} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ASIPrompt({ level }: { level: number }) {
  const { state, dispatch } = useWizard();
  const choice: ASIChoice = state.asiChoices[level] ?? { type: 'unset' };

  function setType(type: ASIChoice['type']) {
    if (type === 'ability_2') dispatch({ type: 'set_asi', level, choice: { type: 'ability_2', ability: 'INT' } });
    else if (type === 'ability_1_1') dispatch({ type: 'set_asi', level, choice: { type: 'ability_1_1', abilityA: 'STR', abilityB: 'DEX' } });
    else if (type === 'feat') dispatch({ type: 'set_asi', level, choice: { type: 'feat', feat: { name: '', description: '' } } });
  }

  return (
    <div className="mt-3 pt-3 border-t border-border/60">
      <div className="text-xs uppercase text-muted mb-2 tracking-wider">Ability Score Improvement</div>
      <div className="flex flex-wrap gap-2 mb-2 text-xs">
        {(['ability_2', 'ability_1_1', 'feat'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`px-2 py-1 rounded border ${
              choice.type === t
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border bg-surface-light text-muted'
            }`}
          >
            {t === 'ability_2' ? '+2 to one ability' : t === 'ability_1_1' ? '+1 to two abilities' : 'Take a feat'}
          </button>
        ))}
      </div>

      {choice.type === 'ability_2' && (
        <div className="flex items-center gap-2 text-xs">
          <span>+2 to</span>
          <select
            value={choice.ability}
            onChange={(e) =>
              dispatch({
                type: 'set_asi',
                level,
                choice: { type: 'ability_2', ability: e.target.value as AbilityKey },
              })
            }
            className={`${inputClass} w-24`}
          >
            {ABILITY_KEYS.map((ab) => <option key={ab} value={ab}>{ab}</option>)}
          </select>
        </div>
      )}

      {choice.type === 'ability_1_1' && (
        <div className="flex items-center gap-2 text-xs">
          <span>+1 to</span>
          <select
            value={choice.abilityA}
            onChange={(e) =>
              dispatch({
                type: 'set_asi',
                level,
                choice: { ...choice, abilityA: e.target.value as AbilityKey },
              })
            }
            className={`${inputClass} w-20`}
          >
            {ABILITY_KEYS.map((ab) => <option key={ab} value={ab}>{ab}</option>)}
          </select>
          <span>and +1 to</span>
          <select
            value={choice.abilityB}
            onChange={(e) =>
              dispatch({
                type: 'set_asi',
                level,
                choice: { ...choice, abilityB: e.target.value as AbilityKey },
              })
            }
            className={`${inputClass} w-20`}
          >
            {ABILITY_KEYS.map((ab) => <option key={ab} value={ab}>{ab}</option>)}
          </select>
        </div>
      )}

      {choice.type === 'feat' && (
        <div className="space-y-2">
          <input
            value={choice.feat.name}
            onChange={(e) =>
              dispatch({
                type: 'set_asi',
                level,
                choice: { type: 'feat', feat: { ...choice.feat, name: e.target.value } },
              })
            }
            className={`${inputClass} w-full`}
            placeholder="Feat Name (e.g. Lucky)"
          />
          <textarea
            value={choice.feat.description}
            onChange={(e) =>
              dispatch({
                type: 'set_asi',
                level,
                choice: { type: 'feat', feat: { ...choice.feat, description: e.target.value } },
              })
            }
            className={`${inputClass} w-full resize-none`}
            rows={2}
            placeholder="Full feat description..."
          />
        </div>
      )}
    </div>
  );
}
