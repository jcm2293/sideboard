'use client';

import { useWizard } from './WizardContext';
import { ALL_RACES, findRace, raceGrantsFeat, raceLanguageChoiceCount, raceSkillChoiceCount } from '@/data/races';
import { findHomebrewClass } from '@/data/homebrew-classes';
import { ALL_SKILLS, ABILITY_KEYS } from '@/lib/homebrew/wizard-reducer';
import type { AbilityKey } from '@/types/homebrew-class';

const inputClass =
  'bg-surface-light border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent w-full';
const compactInput =
  'bg-surface-light border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-accent';

export default function StepIdentity() {
  const { state, dispatch } = useWizard();
  const classDef = findHomebrewClass(state.classId);
  const race = findRace(state.raceId);

  if (!classDef) return <p className="text-sm text-muted">Unknown class.</p>;

  const subclassRequired = state.level >= classDef.subclass_choice_level;
  const skillCount = race ? raceSkillChoiceCount(race) : 0;
  const langCount = race ? raceLanguageChoiceCount(race) : 0;
  const grantsFeat = race ? raceGrantsFeat(race) : false;
  const sizeOptions = race?.size?.choose_at_creation ? race.size.options : null;

  return (
    <div className="space-y-6">
      {/* Identity basics */}
      <section className="space-y-4">
        <h2 className="font-display text-lg text-accent">Basics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Character Name *</label>
            <input
              value={state.characterName}
              onChange={(e) => dispatch({ type: 'set_field', field: 'characterName', value: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Player Name</label>
            <input
              value={state.playerName}
              onChange={(e) => dispatch({ type: 'set_field', field: 'playerName', value: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Level</label>
            <input
              type="number"
              min={1}
              max={20}
              value={state.level}
              onChange={(e) =>
                dispatch({
                  type: 'set_field',
                  field: 'level',
                  value: Math.max(1, Math.min(20, Number(e.target.value))),
                })
              }
              className={`${inputClass} w-32`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Class</label>
            <p className="text-sm">{classDef.name} <span className="text-muted">({classDef.source})</span></p>
          </div>
        </div>
      </section>

      {/* Subclass */}
      {subclassRequired && (
        <section>
          <h2 className="font-display text-lg text-accent mb-2">{classDef.subclass_label} *</h2>
          <div className="space-y-2">
            {classDef.subclasses.map((sc) => {
              const selected = state.subclassId === sc.id;
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() =>
                    dispatch({ type: 'set_field', field: 'subclassId', value: sc.id })
                  }
                  className={`block w-full text-left border rounded p-3 transition-colors ${
                    selected
                      ? 'border-accent bg-accent/5'
                      : 'border-border hover:border-accent/50'
                  }`}
                >
                  <div className="font-display text-sm text-accent">{sc.name}</div>
                  <div className="text-xs text-muted mt-0.5">{sc.description}</div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Race */}
      <section>
        <h2 className="font-display text-lg text-accent mb-2">Race / Species *</h2>
        <select
          value={state.raceId ?? ''}
          onChange={(e) =>
            dispatch({ type: 'set_field', field: 'raceId', value: e.target.value || null })
          }
          className={inputClass}
        >
          <option value="">— choose a race —</option>
          {ALL_RACES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} {r.ruleset === '2014' ? '(2014)' : ''}
            </option>
          ))}
        </select>

        {race && (
          <div className="mt-4 border border-border rounded p-3 bg-surface-light/40 space-y-3">
            <div>
              <p className="text-xs text-muted italic">{race.description}</p>
            </div>

            {/* Traits summary */}
            <details>
              <summary className="cursor-pointer text-sm text-accent">
                Traits ({race.traits.length})
              </summary>
              <div className="pt-2 space-y-2 pl-3 border-l-2 border-border text-xs">
                {race.traits.map((t) => (
                  <div key={t.name}>
                    <span className="font-display text-accent">{t.name}.</span>{' '}
                    <span>{t.description}</span>
                  </div>
                ))}
              </div>
            </details>

            {/* Size choice */}
            {sizeOptions && sizeOptions.length > 1 && (
              <div>
                <label className="block text-xs text-muted mb-1">Size</label>
                <select
                  value={state.raceChoices.size ?? ''}
                  onChange={(e) => dispatch({ type: 'set_race_size', value: e.target.value })}
                  className={`${compactInput} w-32`}
                >
                  <option value="">—</option>
                  {sizeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            {/* Race skill choice (legacy races) */}
            {skillCount > 0 && (
              <div>
                <label className="block text-xs text-muted mb-1">
                  Race-granted skills (choose {skillCount}) — selected {state.raceChoices.skillProficiencies.length}
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                  {ALL_SKILLS.map((s) => {
                    const selected = state.raceChoices.skillProficiencies.includes(s.label);
                    return (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() =>
                          dispatch({ type: 'toggle_race_skill', skill: s.label, max: skillCount })
                        }
                        className={`px-2 py-1 rounded text-xs border ${
                          selected
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-border bg-surface-light text-muted'
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Language choices */}
            {langCount > 0 && (
              <div>
                <label className="block text-xs text-muted mb-1">
                  Languages (choose {langCount}; any standard language)
                </label>
                <div className="space-y-1">
                  {Array.from({ length: langCount }).map((_, i) => (
                    <input
                      key={i}
                      value={state.raceChoices.languages[i] ?? ''}
                      onChange={(e) =>
                        dispatch({ type: 'set_race_language', index: i, value: e.target.value })
                      }
                      className={`${compactInput} w-full`}
                      placeholder="e.g. Draconic"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Race-granted ability score increases (legacy 2014 races only) */}
            {race.ability_score_increases && race.ability_score_increases.length > 0 && (
              <div>
                <label className="block text-xs text-muted mb-1">Race ability increases (legacy 2014)</label>
                <div className="space-y-1">
                  {race.ability_score_increases.map((asi, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {asi.choice ? (
                        <select
                          value={state.raceChoices.abilityIncreases[i]?.ability ?? ''}
                          onChange={(e) =>
                            dispatch({
                              type: 'set_race_ability_increase',
                              index: i,
                              ability: e.target.value as AbilityKey,
                              amount: asi.amount,
                            })
                          }
                          className={`${compactInput} w-32`}
                        >
                          <option value="">—</option>
                          {ABILITY_KEYS.map((ab) => <option key={ab} value={ab}>{ab}</option>)}
                        </select>
                      ) : (
                        <span className="font-data">{asi.ability}</span>
                      )}
                      <span>+{asi.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Starting feat */}
            {grantsFeat && (
              <div className="pt-2 border-t border-border/60">
                <label className="block text-sm font-medium text-muted mb-1">Starting Feat</label>
                <p className="text-xs text-muted mb-2">
                  This race grants a starting feat. Enter the feat name and full description from your source.
                </p>
                <input
                  value={state.raceChoices.startingFeat.name}
                  onChange={(e) =>
                    dispatch({
                      type: 'set_race_starting_feat',
                      field: 'name',
                      value: e.target.value,
                    })
                  }
                  className={`${inputClass} mb-2`}
                  placeholder="Feat Name"
                />
                <textarea
                  value={state.raceChoices.startingFeat.description}
                  onChange={(e) =>
                    dispatch({
                      type: 'set_race_starting_feat',
                      field: 'description',
                      value: e.target.value,
                    })
                  }
                  className={`${inputClass} resize-none`}
                  rows={3}
                  placeholder="Full feat description..."
                />
              </div>
            )}
          </div>
        )}
      </section>

      {/* Background — free text + skill picks */}
      <section>
        <h2 className="font-display text-lg text-accent mb-1">Background</h2>
        <p className="text-xs text-muted mb-3">
          Look up your chosen background in D&amp;D Beyond or your source material. Enter the proficiencies, languages, and feature it grants.
        </p>
        <div className="border border-border rounded p-3 bg-surface-light/40 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Background Name</label>
              <input
                value={state.background.name}
                onChange={(e) =>
                  dispatch({ type: 'set_background_field', field: 'name', value: e.target.value })
                }
                className={inputClass}
                placeholder="e.g. Sage"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Tool Proficiencies</label>
              <input
                value={state.background.toolProficiencies}
                onChange={(e) =>
                  dispatch({ type: 'set_background_field', field: 'toolProficiencies', value: e.target.value })
                }
                className={inputClass}
                placeholder="e.g. Calligrapher's tools"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">
              Skill Proficiencies (most backgrounds grant 2) — selected {state.background.skillProficiencies.length}
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
              {ALL_SKILLS.map((s) => {
                const selected = state.background.skillProficiencies.includes(s.label);
                return (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() =>
                      dispatch({ type: 'toggle_background_skill', skill: s.label, max: 4 })
                    }
                    className={`px-2 py-1 rounded text-xs border ${
                      selected
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border bg-surface-light text-muted'
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Languages from Background</label>
            <input
              value={state.background.languages}
              onChange={(e) =>
                dispatch({ type: 'set_background_field', field: 'languages', value: e.target.value })
              }
              className={inputClass}
              placeholder="e.g. Elvish, Draconic"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Background Feature</label>
            <input
              value={state.background.feature.name}
              onChange={(e) =>
                dispatch({ type: 'set_background_feature', field: 'name', value: e.target.value })
              }
              className={`${inputClass} mb-2`}
              placeholder="Feature Name (e.g. Researcher)"
            />
            <textarea
              value={state.background.feature.description}
              onChange={(e) =>
                dispatch({ type: 'set_background_feature', field: 'description', value: e.target.value })
              }
              className={`${inputClass} resize-none`}
              rows={2}
              placeholder="Full feature description..."
            />
          </div>
        </div>
      </section>
    </div>
  );
}
