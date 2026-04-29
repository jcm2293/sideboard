'use client';

import { useWizard } from './WizardContext';
import { findHomebrewClass } from '@/data/homebrew-classes';
import { findRace } from '@/data/races';
import { FIGHTING_STYLES } from '@/data/fighting-styles';
import { ABILITY_KEYS } from '@/lib/homebrew/wizard-reducer';
import type { AbilityKey } from '@/types/homebrew-class';

function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

function modStr(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

function bonusFor(ability: AbilityKey, allBonuses: { ability: AbilityKey; amount: number }[]): number {
  return allBonuses.filter((b) => b.ability === ability).reduce((sum, b) => sum + b.amount, 0);
}

export default function StepReview() {
  const { state } = useWizard();
  const classDef = findHomebrewClass(state.classId);
  const race = findRace(state.raceId);
  if (!classDef) return null;

  const subclass = state.subclassId ? classDef.subclasses.find((s) => s.id === state.subclassId) : null;
  const fightingStyle = state.fightingStyleId ? FIGHTING_STYLES[state.fightingStyleId] : null;

  const allBonuses = [...state.raceChoices.abilityIncreases, ...state.background.abilityIncreases];

  // Apply +2 / +1+1 ASI choices made in StepLevels
  const asiBonuses: { ability: AbilityKey; amount: number }[] = [];
  for (const choice of Object.values(state.asiChoices)) {
    if (choice.type === 'ability_2') {
      asiBonuses.push({ ability: choice.ability, amount: 2 });
    } else if (choice.type === 'ability_1_1') {
      asiBonuses.push({ ability: choice.abilityA, amount: 1 });
      asiBonuses.push({ ability: choice.abilityB, amount: 1 });
    }
  }
  const allMods = [...allBonuses, ...asiBonuses];

  const finalAbilities = Object.fromEntries(
    ABILITY_KEYS.map((ab) => [ab, state.baseAbilities[ab] + bonusFor(ab, allMods)]),
  ) as Record<AbilityKey, number>;

  const allSkills = Array.from(new Set([
    ...state.raceChoices.skillProficiencies,
    ...state.background.skillProficiencies,
    ...state.classSkillProficiencies,
  ]));

  const feats: { name: string; description: string }[] = [];
  if (state.raceChoices.startingFeat.name) {
    feats.push(state.raceChoices.startingFeat);
  }
  for (const choice of Object.values(state.asiChoices)) {
    if (choice.type === 'feat') feats.push(choice.feat);
  }

  return (
    <div className="space-y-5">
      <h2 className="font-display text-lg text-accent">Review</h2>

      <section className="card-parchment rounded-lg p-4 space-y-2">
        <div>
          <div className="font-display text-xl text-accent">{state.characterName || '(no name)'}</div>
          <div className="text-xs text-muted">
            Level {state.level} {race?.name ?? '(no race)'} {classDef.name}
            {subclass && ` — ${subclass.name}`}
          </div>
          {state.playerName && (
            <div className="text-xs text-muted italic">Played by {state.playerName}</div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-display text-sm text-accent mb-2">Final Ability Scores</h3>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            {ABILITY_KEYS.map((ab) => (
              <div key={ab}>
                <div className="text-xs text-muted">{ab}</div>
                <div className="font-data text-lg">{finalAbilities[ab]}</div>
                <div className="text-xs">{modStr(abilityMod(finalAbilities[ab]))}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-display text-sm text-accent mb-2">Proficiencies</h3>
          <div className="text-xs space-y-1">
            <div><strong>Saves:</strong> {classDef.saving_throws.join(', ')}</div>
            <div><strong>Skills:</strong> {allSkills.join(', ') || '—'}</div>
            <div><strong>Armor:</strong> {Object.entries(classDef.armor_proficiencies).filter(([,v]) => v).map(([k]) => k).join(', ') || '—'}</div>
            <div><strong>Weapons:</strong> {Object.entries(classDef.weapon_proficiencies).filter(([k,v]) => k !== 'specific' && v).map(([k]) => k).join(', ') || '—'}</div>
            {state.background.toolProficiencies && (
              <div><strong>Tools (background):</strong> {state.background.toolProficiencies}</div>
            )}
            <div><strong>Languages:</strong> {[
              ...(state.raceChoices.languages.filter(Boolean)),
              state.background.languages,
            ].filter(Boolean).join(', ') || '—'}</div>
          </div>
        </div>
      </section>

      <section className="card-parchment rounded-lg p-4">
        <h3 className="font-display text-sm text-accent mb-2">Class &amp; Subclass Features</h3>
        <ul className="text-xs space-y-1 list-disc pl-4">
          {classDef.level_progression
            .filter((e) => e.level <= state.level)
            .flatMap((e) => e.features.filter((f) => {
              const def = classDef.features[f];
              return def && !def.hide_on_sheet;
            }).map((f) => `${classDef.features[f].name} (L${e.level})`))
            .map((s, i) => <li key={i}>{s}</li>)}
          {subclass && Object.entries(subclass.features_by_level)
            .filter(([lvl]) => parseInt(lvl) <= state.level)
            .flatMap(([lvl, ids]) => ids.map((id) => {
              const def = subclass.features[id];
              return def && !def.hide_on_sheet ? `${def.name} (subclass L${lvl})` : null;
            }).filter(Boolean))
            .map((s, i) => <li key={`s${i}`}>{s}</li>)}
        </ul>
      </section>

      {race && (
        <section className="card-parchment rounded-lg p-4">
          <h3 className="font-display text-sm text-accent mb-2">Racial Traits ({race.name})</h3>
          <ul className="text-xs space-y-1 list-disc pl-4">
            {race.traits.map((t) => <li key={t.name}>{t.name}</li>)}
          </ul>
        </section>
      )}

      {feats.length > 0 && (
        <section className="card-parchment rounded-lg p-4">
          <h3 className="font-display text-sm text-accent mb-2">Feats</h3>
          <ul className="text-xs space-y-1 list-disc pl-4">
            {feats.map((f, i) => <li key={i}>{f.name}</li>)}
          </ul>
        </section>
      )}

      {fightingStyle && (
        <section className="card-parchment rounded-lg p-4">
          <h3 className="font-display text-sm text-accent mb-1">Fighting Style</h3>
          <p className="text-xs"><strong>{fightingStyle.name}.</strong> {fightingStyle.description}</p>
        </section>
      )}

      <section className="card-parchment rounded-lg p-4">
        <h3 className="font-display text-sm text-accent mb-2">Spells</h3>
        <div className="text-xs space-y-1">
          {state.cantripsKnown.length > 0 && (
            <div><strong>Cantrips:</strong> {state.cantripsKnown.join(', ')}</div>
          )}
          {Object.entries(state.spellsKnownByLevel)
            .filter(([, arr]) => arr.length > 0)
            .map(([lvl, arr]) => (
              <div key={lvl}><strong>Level {lvl}:</strong> {arr.join(', ')}</div>
            ))}
          {state.cantripsKnown.length === 0 && Object.values(state.spellsKnownByLevel).every((a) => a.length === 0) && (
            <span className="text-muted">No spells selected yet.</span>
          )}
        </div>
      </section>

      {(state.equipmentText || state.currency.gp > 0) && (
        <section className="card-parchment rounded-lg p-4">
          <h3 className="font-display text-sm text-accent mb-2">Equipment &amp; Currency</h3>
          <div className="text-xs whitespace-pre-wrap mb-2">{state.equipmentText || '—'}</div>
          <div className="text-xs text-muted">
            {(['cp', 'sp', 'ep', 'gp', 'pp'] as const).map((c) => `${state.currency[c]} ${c}`).join(' · ')}
          </div>
        </section>
      )}
    </div>
  );
}
