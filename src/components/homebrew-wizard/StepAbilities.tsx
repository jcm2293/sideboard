'use client';

import { useWizard } from './WizardContext';
import { ABILITY_KEYS } from '@/lib/homebrew/wizard-reducer';
import {
  POINT_BUY_BUDGET,
  POINT_BUY_MIN,
  POINT_BUY_MAX,
  pointCost,
  totalPointsSpent,
  defaultStandardArrayAssignment,
  STANDARD_ARRAY,
} from '@/lib/homebrew/point-buy';
import type { AbilityKey } from '@/types/homebrew-class';

const compactNumber =
  'bg-surface-light border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-accent font-data text-center';

function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

function modStr(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

/** Sum racial + background ability increases that apply to a given ability. */
function bonusFor(ability: AbilityKey, allBonuses: { ability: AbilityKey; amount: number }[]): number {
  return allBonuses
    .filter((b) => b.ability === ability)
    .reduce((sum, b) => sum + b.amount, 0);
}

export default function StepAbilities() {
  const { state, dispatch } = useWizard();

  const totalSpent = totalPointsSpent(state.baseAbilities);
  const overBudget = totalSpent > POINT_BUY_BUDGET;
  const exact = totalSpent === POINT_BUY_BUDGET;

  // Aggregate racial + background bonuses applied at character creation
  const allBonuses = [...state.raceChoices.abilityIncreases, ...state.background.abilityIncreases];

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg text-accent">Ability Scores</h2>
        <button
          type="button"
          onClick={() => {
            dispatch({ type: 'set_field', field: 'useStandardArray', value: !state.useStandardArray });
            if (!state.useStandardArray) {
              dispatch({ type: 'apply_standard_array', assignments: defaultStandardArrayAssignment() });
            } else {
              dispatch({ type: 'reset_abilities' });
            }
          }}
          className="text-xs text-accent hover:underline"
        >
          {state.useStandardArray ? 'Switch to Point Buy' : 'Use Standard Array'}
        </button>
      </div>

      {state.useStandardArray ? (
        <p className="text-xs text-muted">
          Standard Array: {STANDARD_ARRAY.join(', ')}. Adjust each ability below to assign these values.
          The default assignment puts INT highest for Magus.
        </p>
      ) : (
        <div className="text-sm">
          <span
            className={`font-data ${overBudget ? 'text-danger' : exact ? 'text-accent' : 'text-foreground'}`}
          >
            Points used: {totalSpent} / {POINT_BUY_BUDGET}
          </span>
          {overBudget && <span className="text-xs text-danger ml-2">over budget</span>}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {ABILITY_KEYS.map((ab) => {
          const base = state.baseAbilities[ab];
          const racial = bonusFor(ab, allBonuses);
          const total = base + racial;
          const mod = abilityMod(total);
          const cost = pointCost(base);

          return (
            <div key={ab} className="border border-border rounded p-3 bg-surface-light/40 flex items-center gap-3">
              <div className="font-display text-base text-accent w-12 shrink-0">{ab}</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: 'set_base_ability',
                      ability: ab,
                      value: Math.max(POINT_BUY_MIN, base - 1),
                    })
                  }
                  className="btn-ghost px-2 rounded text-sm"
                  disabled={base <= POINT_BUY_MIN}
                >
                  −
                </button>
                <input
                  type="number"
                  min={POINT_BUY_MIN}
                  max={POINT_BUY_MAX}
                  value={base}
                  onChange={(e) =>
                    dispatch({
                      type: 'set_base_ability',
                      ability: ab,
                      value: Math.max(POINT_BUY_MIN, Math.min(POINT_BUY_MAX, Number(e.target.value))),
                    })
                  }
                  className={`${compactNumber} w-14`}
                />
                <button
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: 'set_base_ability',
                      ability: ab,
                      value: Math.min(POINT_BUY_MAX, base + 1),
                    })
                  }
                  className="btn-ghost px-2 rounded text-sm"
                  disabled={base >= POINT_BUY_MAX}
                >
                  +
                </button>
              </div>
              <div className="flex-1 min-w-0 text-xs text-muted">
                <div>Base {base} {!state.useStandardArray && <>· cost {cost}</>}</div>
                {racial > 0 && <div>+{racial} from race/bg</div>}
              </div>
              <div className="text-right shrink-0">
                <div className="font-data text-lg">{modStr(mod)}</div>
                <div className="text-xs text-muted">total {total}</div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted">
        Point buy budget is 27. Cost: 8→0, 9→1, 10→2, 11→3, 12→4, 13→5, 14→7, 15→9. Racial and background bonuses
        apply on top of your base score (max 20 total at character creation per standard 5e rules).
      </p>
    </div>
  );
}
