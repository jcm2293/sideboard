// Per-step validators: list "decisions remaining" so the wizard can disable Next
// and surface what the user still needs to handle.

import { findHomebrewClass } from '@/data/homebrew-classes';
import { findRace, raceGrantsFeat, raceLanguageChoiceCount, raceSkillChoiceCount } from '@/data/races';
import { POINT_BUY_BUDGET, totalPointsSpent } from './point-buy';
import type { WizardState, WizardStep } from './wizard-reducer';

export interface StepValidation {
  ok: boolean;
  remaining: string[];
}

export function validateStep(state: WizardState, step: WizardStep): StepValidation {
  const classDef = findHomebrewClass(state.classId);
  const race = findRace(state.raceId);
  const remaining: string[] = [];

  if (step === 'identity') {
    if (!state.characterName.trim()) remaining.push('Character name');
    if (!state.raceId) remaining.push('Race');
    if (!state.background.name.trim()) remaining.push('Background name');
    if (state.background.skillProficiencies.length === 0) {
      remaining.push('Background skill proficiencies');
    }
    if (classDef && state.level >= classDef.subclass_choice_level && !state.subclassId) {
      remaining.push(`${classDef.subclass_label}`);
    }
    if (race) {
      const skillCount = raceSkillChoiceCount(race);
      if (skillCount > 0 && state.raceChoices.skillProficiencies.length < skillCount) {
        remaining.push(`Race skills (${state.raceChoices.skillProficiencies.length}/${skillCount})`);
      }
      const langCount = raceLanguageChoiceCount(race);
      const filledLangs = state.raceChoices.languages.filter(Boolean).length;
      if (langCount > 0 && filledLangs < langCount) {
        remaining.push(`Race languages (${filledLangs}/${langCount})`);
      }
      if (race.size?.choose_at_creation && (race.size.options?.length ?? 0) > 1 && !state.raceChoices.size) {
        remaining.push('Size');
      }
      if (raceGrantsFeat(race) && !state.raceChoices.startingFeat.name.trim()) {
        remaining.push('Starting feat');
      }
    }
  }

  if (step === 'class' && classDef) {
    const skillCount = classDef.skill_choices.count;
    if (state.classSkillProficiencies.length < skillCount) {
      remaining.push(`Class skills (${state.classSkillProficiencies.length}/${skillCount})`);
    }
    if ((classDef.allowed_fighting_style_ids?.length ?? 0) > 0 && !state.fightingStyleId) {
      remaining.push('Fighting style');
    }
    const levelEntry = classDef.level_progression.find((e) => e.level === state.level);
    const cantripsKnown = levelEntry?.cantrips_known ?? 0;
    if (cantripsKnown > 0 && state.cantripsKnown.length < cantripsKnown) {
      remaining.push(`Cantrips (${state.cantripsKnown.length}/${cantripsKnown})`);
    }
    const spellsKnownTotal = levelEntry?.spells_known ?? 0;
    const totalPicked = Object.values(state.spellsKnownByLevel).reduce((s, a) => s + a.length, 0);
    if (spellsKnownTotal > 0 && totalPicked < spellsKnownTotal) {
      remaining.push(`Spells known (${totalPicked}/${spellsKnownTotal})`);
    }
  }

  if (step === 'abilities') {
    if (!state.useStandardArray) {
      const spent = totalPointsSpent(state.baseAbilities);
      if (spent !== POINT_BUY_BUDGET) {
        remaining.push(`Point buy: ${spent}/${POINT_BUY_BUDGET}`);
      }
    }
  }

  if (step === 'levels' && classDef) {
    for (const entry of classDef.level_progression) {
      if (entry.level > state.level) break;
      if (entry.features.includes('ability_score_improvement')) {
        const choice = state.asiChoices[entry.level];
        if (!choice || choice.type === 'unset') {
          remaining.push(`L${entry.level} ASI choice`);
        } else if (choice.type === 'feat' && !choice.feat.name.trim()) {
          remaining.push(`L${entry.level} feat name`);
        }
      }
    }
  }

  return { ok: remaining.length === 0, remaining };
}
