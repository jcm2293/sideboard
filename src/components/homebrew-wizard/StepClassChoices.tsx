'use client';

import { useWizard } from './WizardContext';
import { findHomebrewClass } from '@/data/homebrew-classes';
import { FIGHTING_STYLES, getFightingStylesById } from '@/data/fighting-styles';
import { getProgressionByCasterType } from '@/data/spell-progression';
import { CANTRIP_FNS } from '@/data/homebrew-classes';

const inputClass =
  'bg-surface-light border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent w-full';

export default function StepClassChoices() {
  const { state, dispatch } = useWizard();
  const classDef = findHomebrewClass(state.classId);
  if (!classDef) return null;

  const skillCount = classDef.skill_choices.count;
  const levelEntry = classDef.level_progression.find((e) => e.level === state.level);
  const cantripsKnown = levelEntry?.cantrips_known ?? 0;
  const spellsKnownTotal = levelEntry?.spells_known ?? 0;

  const progression = getProgressionByCasterType(
    classDef.caster_type,
    state.level,
    CANTRIP_FNS[classDef.id],
  );
  const availableSpellLevels = Object.entries(progression.spellSlots ?? {})
    .filter(([, count]) => count > 0)
    .map(([lvl]) => lvl);

  const allowedFs = classDef.allowed_fighting_style_ids ?? [];
  const fsOptions = getFightingStylesById(allowedFs);
  const selectedFs = state.fightingStyleId ? FIGHTING_STYLES[state.fightingStyleId] : null;

  const totalSpellsPicked = Object.values(state.spellsKnownByLevel).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );

  return (
    <div className="space-y-6">
      <h2 className="font-display text-lg text-accent">Class Choices</h2>

      {/* Skill proficiencies */}
      <section>
        <label className="block text-sm font-medium text-muted mb-2">
          Skill Proficiencies — choose {skillCount} (selected {state.classSkillProficiencies.length})
        </label>
        <p className="text-xs text-muted mb-2">
          Magi choose {skillCount} skill proficiencies from their class list.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {classDef.skill_choices.options.map((skill) => {
            const selected = state.classSkillProficiencies.includes(skill);
            return (
              <button
                key={skill}
                type="button"
                onClick={() =>
                  dispatch({ type: 'toggle_class_skill', skill, max: skillCount })
                }
                className={`px-3 py-1.5 rounded text-xs border ${
                  selected
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border bg-surface-light text-muted hover:border-accent/50'
                }`}
              >
                {skill}
              </button>
            );
          })}
        </div>
      </section>

      {/* Fighting Style */}
      {fsOptions.length > 0 && (
        <section>
          <label className="block text-sm font-medium text-muted mb-1">Fighting Style</label>
          <p className="text-xs text-muted mb-2">
            All Magi gain one Fighting Style at level 1.
          </p>
          <select
            value={state.fightingStyleId ?? ''}
            onChange={(e) =>
              dispatch({ type: 'set_field', field: 'fightingStyleId', value: e.target.value || null })
            }
            className={inputClass}
          >
            <option value="">— choose a fighting style —</option>
            {fsOptions.map((fs) => (
              <option key={fs.id} value={fs.id}>
                {fs.name}{fs.prerequisite ? ` (req: ${fs.prerequisite})` : ''}
              </option>
            ))}
          </select>
          {selectedFs && (
            <div className="mt-2 p-3 border border-border rounded bg-surface-light/40 text-xs">
              {selectedFs.prerequisite && (
                <p className="italic text-muted mb-1">Prerequisite: {selectedFs.prerequisite}</p>
              )}
              <p>{selectedFs.description}</p>
            </div>
          )}
        </section>
      )}

      {/* Cantrips */}
      {cantripsKnown > 0 && (classDef.spell_list['0']?.length ?? 0) > 0 && (
        <section>
          <label className="block text-sm font-medium text-muted mb-2">
            Cantrips — choose {cantripsKnown} (selected {state.cantripsKnown.length})
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
            {classDef.spell_list['0'].map((spell) => {
              const selected = state.cantripsKnown.includes(spell);
              return (
                <button
                  key={spell}
                  type="button"
                  onClick={() =>
                    dispatch({ type: 'toggle_cantrip', spell, max: cantripsKnown })
                  }
                  className={`px-2 py-1 rounded text-xs border text-left ${
                    selected
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border bg-surface-light text-muted hover:border-accent/50'
                  }`}
                >
                  {spell}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Spells Known */}
      {spellsKnownTotal > 0 && availableSpellLevels.length > 0 && (
        <section>
          <label className="block text-sm font-medium text-muted mb-2">
            Spells Known — choose {spellsKnownTotal} total (picked {totalSpellsPicked})
          </label>
          <p className="text-xs text-muted mb-2">
            Pick any combination across the spell levels for which you have slots.
          </p>
          {availableSpellLevels.map((spellLvl) => {
            const list = classDef.spell_list[spellLvl] ?? [];
            if (list.length === 0) return null;
            const picked = state.spellsKnownByLevel[spellLvl] ?? [];
            return (
              <details key={spellLvl} className="mb-2" open>
                <summary className="cursor-pointer text-sm text-accent">
                  Level {spellLvl} ({picked.length})
                </summary>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 pl-3">
                  {list.map((spell) => {
                    const selected = picked.includes(spell);
                    return (
                      <button
                        key={spell}
                        type="button"
                        onClick={() =>
                          dispatch({ type: 'toggle_spell_known', spellLevel: spellLvl, spell })
                        }
                        className={`px-2 py-1 rounded text-xs border text-left ${
                          selected
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-border bg-surface-light text-muted hover:border-accent/50'
                        }`}
                      >
                        {spell}
                      </button>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </section>
      )}
    </div>
  );
}
