'use client';

import { use, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { findHomebrewClass } from '@/data/homebrew-classes';
import { assembleCharacterFromClass } from '@/lib/homebrew/assemble-character';
import { getProgressionByCasterType } from '@/data/spell-progression';
import { CANTRIP_FNS } from '@/data/homebrew-classes';
import type { AbilityKey } from '@/types/homebrew-class';

const inputClass =
  'bg-surface-light border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent w-full';
const compactNumber =
  'bg-surface-light border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-accent font-data text-center';

type Step = 'basics' | 'choices' | 'manual';

export default function NewHomebrewCharacterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: campaignId } = use(params);
  const router = useRouter();
  const search = useSearchParams();
  const classId = search.get('class') ?? '';
  const classDef = useMemo(() => findHomebrewClass(classId), [classId]);

  // Hooks must be unconditional — declare all state first, then handle the missing-class case.
  const [step, setStep] = useState<Step>('basics');

  // Basics
  const [name, setName] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [level, setLevel] = useState(1);
  const [subclassId, setSubclassId] = useState<string | null>(null);

  // Class choices
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [fightingStyleText, setFightingStyleText] = useState('');
  const [selectedCantrips, setSelectedCantrips] = useState<string[]>([]);
  const [spellsKnownByLevel, setSpellsKnownByLevel] = useState<Record<string, string[]>>({});

  // Manual
  const [race, setRace] = useState('');
  const [background, setBackground] = useState('');
  const [abilities, setAbilities] = useState<Record<AbilityKey, number>>({
    STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10,
  });
  const [equipmentText, setEquipmentText] = useState('');
  const [currency, setCurrency] = useState({ cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 });

  if (!classDef) {
    return (
      <div className="max-w-3xl">
        <p className="text-sm text-muted">
          Unknown homebrew class: <code>{classId || '(none)'}</code>.{' '}
          <button
            onClick={() => router.push(`/campaign/${campaignId}/players`)}
            className="text-accent hover:underline"
          >
            Back to Players
          </button>
        </p>
      </div>
    );
  }

  // Derived from current level
  const progression = getProgressionByCasterType(
    classDef.caster_type,
    level,
    CANTRIP_FNS[classDef.id],
  );
  const levelEntry = classDef.level_progression.find((e) => e.level === level);
  const cantripsKnown = levelEntry?.cantrips_known ?? progression.cantripsKnown;
  const spellsKnownTotal = levelEntry?.spells_known ?? 0;
  const subclassRequired = level >= classDef.subclass_choice_level;
  const availableSpellLevels = Object.entries(progression.spellSlots ?? {})
    .filter(([, count]) => count > 0)
    .map(([lvl]) => lvl);

  function toggleArrayValue(arr: string[], val: string, max?: number): string[] {
    if (arr.includes(val)) return arr.filter((x) => x !== val);
    if (max != null && arr.length >= max) return arr;
    return [...arr, val];
  }

  function setSpellAtLevel(spellLvl: string, name: string) {
    setSpellsKnownByLevel((prev) => {
      const cur = prev[spellLvl] ?? [];
      return { ...prev, [spellLvl]: toggleArrayValue(cur, name) };
    });
  }

  function totalSpellsPicked() {
    return Object.values(spellsKnownByLevel).reduce((sum, arr) => sum + arr.length, 0);
  }

  function handleSubmit() {
    if (!classDef) return;
    const assembled = assembleCharacterFromClass({
      classDef,
      level,
      name,
      playerName,
      subclassId,
      selectedSkills,
      fightingStyleText,
      selectedCantrips,
      spellsKnown: spellsKnownByLevel,
      race,
      background,
      abilities,
      equipmentText,
      currency,
    });

    sessionStorage.setItem('parsedCharacter', JSON.stringify(assembled));
    router.push(`/campaign/${campaignId}/players/new?parsed=true`);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Step navigation
  // ──────────────────────────────────────────────────────────────────────

  const canAdvanceFromBasics = name.trim() !== '' && (!subclassRequired || subclassId !== null);
  const skillCount = classDef.skill_choices.count;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <p className="text-xs text-muted uppercase tracking-wider">{classDef.source}</p>
        <h1 className="font-display text-2xl text-accent">Create a {classDef.name}</h1>
      </div>

      {/* Step indicator */}
      <div className="flex gap-2 mb-6 text-xs">
        {(['basics', 'choices', 'manual'] as const).map((s, idx) => (
          <button
            key={s}
            onClick={() => setStep(s)}
            className={`px-3 py-1.5 rounded ${
              step === s ? 'bg-accent text-amber-50' : 'bg-surface-light text-muted hover:text-foreground'
            }`}
          >
            {idx + 1}. {s === 'basics' ? 'Basics' : s === 'choices' ? 'Class Choices' : 'Manual Fields'}
          </button>
        ))}
      </div>

      <div className="card-parchment rounded-lg p-6 mb-6">
        {/* ── STEP 1: BASICS ── */}
        {step === 'basics' && (
          <section className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Character Name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Player Name</label>
                <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Level</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={level}
                  onChange={(e) => setLevel(Math.max(1, Math.min(20, Number(e.target.value))))}
                  className={`${inputClass} w-32`}
                />
              </div>
            </div>

            {subclassRequired && (
              <div>
                <label className="block text-sm font-medium text-muted mb-2">{classDef.subclass_label} *</label>
                <div className="space-y-2">
                  {classDef.subclasses.map((sc) => {
                    const selected = subclassId === sc.id;
                    return (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => setSubclassId(sc.id)}
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
              </div>
            )}
          </section>
        )}

        {/* ── STEP 2: CLASS CHOICES ── */}
        {step === 'choices' && (
          <section className="space-y-6">
            {/* Skills */}
            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                Skill Proficiencies (choose {skillCount}) — selected {selectedSkills.length}
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {classDef.skill_choices.options.map((skill) => {
                  const selected = selectedSkills.includes(skill);
                  return (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => setSelectedSkills(toggleArrayValue(selectedSkills, skill, skillCount))}
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
            </div>

            {/* Fighting Style */}
            {classDef.fighting_styles && (
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Fighting Style</label>
                <input
                  value={fightingStyleText}
                  onChange={(e) => setFightingStyleText(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Defensive Fighting"
                />
                <details className="mt-2 text-xs text-muted">
                  <summary className="cursor-pointer hover:text-accent">Show available styles</summary>
                  <div className="pt-2 space-y-1.5 pl-3 border-l-2 border-border">
                    {classDef.fighting_styles.map((fs) => (
                      <div key={fs.id}>
                        <span className="font-display text-accent">{fs.name}.</span>{' '}
                        <span>{fs.description}</span>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}

            {/* Cantrips */}
            {cantripsKnown > 0 && (classDef.spell_list['0']?.length ?? 0) > 0 && (
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  Cantrips (choose {cantripsKnown}) — selected {selectedCantrips.length}
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                  {classDef.spell_list['0'].map((spell) => {
                    const selected = selectedCantrips.includes(spell);
                    return (
                      <button
                        key={spell}
                        type="button"
                        onClick={() => setSelectedCantrips(toggleArrayValue(selectedCantrips, spell, cantripsKnown))}
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
              </div>
            )}

            {/* Spells Known */}
            {spellsKnownTotal > 0 && availableSpellLevels.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  Spells Known (choose {spellsKnownTotal} total — picked {totalSpellsPicked()})
                </label>
                <p className="text-xs text-muted mb-2">
                  You can pick any combination across the spell levels for which you have slots.
                </p>
                {availableSpellLevels.map((spellLvl) => {
                  const list = classDef.spell_list[spellLvl] ?? [];
                  if (list.length === 0) return null;
                  const picked = spellsKnownByLevel[spellLvl] ?? [];
                  return (
                    <details key={spellLvl} className="mb-2" open>
                      <summary className="cursor-pointer text-sm text-accent">
                        {spellLvl === '0' ? 'Cantrips' : `Level ${spellLvl}`} ({picked.length})
                      </summary>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 pl-3">
                        {list.map((spell) => {
                          const selected = picked.includes(spell);
                          return (
                            <button
                              key={spell}
                              type="button"
                              onClick={() => setSpellAtLevel(spellLvl, spell)}
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
              </div>
            )}
          </section>
        )}

        {/* ── STEP 3: MANUAL FIELDS ── */}
        {step === 'manual' && (
          <section className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Race / Species</label>
                <input value={race} onChange={(e) => setRace(e.target.value)} className={inputClass} placeholder="e.g. Half-Elf" />
                <p className="text-xs text-muted mt-1">Fill in racial traits in the edit view after creation.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Background</label>
                <input value={background} onChange={(e) => setBackground(e.target.value)} className={inputClass} placeholder="e.g. Sage" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted mb-2">Ability Scores</label>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as AbilityKey[]).map((ab) => (
                  <div key={ab} className="text-center">
                    <div className="text-xs text-muted mb-1">{ab}</div>
                    <input
                      type="number"
                      min={3}
                      max={20}
                      value={abilities[ab]}
                      onChange={(e) =>
                        setAbilities((prev) => ({ ...prev, [ab]: Number(e.target.value) }))
                      }
                      className={`${compactNumber} w-full`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted mb-1">Equipment</label>
              <textarea
                value={equipmentText}
                onChange={(e) => setEquipmentText(e.target.value)}
                className={`${inputClass} resize-none`}
                rows={5}
                placeholder="One item per line. e.g.&#10;Longsword&#10;Shield&#10;Scale Mail&#10;Explorer's Pack"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted mb-2">Currency</label>
              <div className="grid grid-cols-5 gap-2 max-w-md">
                {(['cp', 'sp', 'ep', 'gp', 'pp'] as const).map((coin) => (
                  <div key={coin} className="text-center">
                    <div className="text-xs text-muted uppercase mb-1">{coin}</div>
                    <input
                      type="number"
                      min={0}
                      value={currency[coin]}
                      onChange={(e) => setCurrency({ ...currency, [coin]: Number(e.target.value) })}
                      className={`${compactNumber} w-full`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>

      <div className="flex gap-2 justify-between">
        <button
          onClick={() => router.push(`/campaign/${campaignId}/players`)}
          className="btn-ghost px-4 py-2 rounded text-sm"
        >
          Cancel
        </button>
        <div className="flex gap-2">
          {step !== 'basics' && (
            <button
              onClick={() => setStep(step === 'manual' ? 'choices' : 'basics')}
              className="btn-ghost px-4 py-2 rounded text-sm"
            >
              ← Back
            </button>
          )}
          {step === 'manual' ? (
            <button
              onClick={handleSubmit}
              disabled={!name.trim()}
              className="btn-primary px-4 py-2 rounded text-sm disabled:opacity-50"
            >
              Create Character →
            </button>
          ) : (
            <button
              onClick={() => setStep(step === 'basics' ? 'choices' : 'manual')}
              disabled={step === 'basics' && !canAdvanceFromBasics}
              className="btn-primary px-4 py-2 rounded text-sm disabled:opacity-50"
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
