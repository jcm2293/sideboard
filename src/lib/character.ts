// Character math: single source of truth for derived numbers.
// These take a PlayerCharacter (or compatible partial) and compute values that
// must never live as raw columns — they're driven by ability scores + PB.

import type { PlayerCharacter } from '@/types';

type AbilityCode = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

const ABILITY_TO_FIELD: Record<AbilityCode, keyof Pick<PlayerCharacter,
  'str_score' | 'dex_score' | 'con_score' | 'int_score' | 'wis_score' | 'cha_score'>> = {
  STR: 'str_score',
  DEX: 'dex_score',
  CON: 'con_score',
  INT: 'int_score',
  WIS: 'wis_score',
  CHA: 'cha_score',
};

export function abilityModifier(score: number | null | undefined): number {
  if (score == null) return 0;
  return Math.floor((score - 10) / 2);
}

/** Look up the raw ability score given a 3-letter ability code. */
export function abilityScoreFor(
  c: Partial<PlayerCharacter>,
  ability: string | null | undefined,
): number {
  if (!ability) return 10;
  const code = ability.toUpperCase() as AbilityCode;
  const field = ABILITY_TO_FIELD[code];
  if (!field) return 10;
  return (c[field] as number | undefined) ?? 10;
}

/**
 * Spell save DC. Override wins when set; otherwise compute
 * 8 + proficiency_bonus + spellcasting ability modifier.
 */
export function spellSaveDc(c: Partial<PlayerCharacter>): number {
  if (c.spell_save_dc_override != null) return c.spell_save_dc_override;
  const pb = c.proficiency_bonus ?? 2;
  const mod = abilityModifier(abilityScoreFor(c, c.spellcasting_ability));
  return 8 + pb + mod;
}

/**
 * Spell attack bonus. Override wins when set; otherwise compute
 * proficiency_bonus + spellcasting ability modifier.
 */
export function spellAttackBonus(c: Partial<PlayerCharacter>): number {
  if (c.spell_attack_bonus_override != null) return c.spell_attack_bonus_override;
  const pb = c.proficiency_bonus ?? 2;
  const mod = abilityModifier(abilityScoreFor(c, c.spellcasting_ability));
  return pb + mod;
}

/** Format a modifier as "+X" or "-X". */
export function modString(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

// ──────────────────────────────────────────────────────────────────────────
// Canonical jsonb key shapes. The parser, homebrew wizard, edit view and PDF
// export all read these; older records and manual entry used other spellings.
// ──────────────────────────────────────────────────────────────────────────

/** Saves: lowercase 3-letter ability ('str'). Older records used 'STR'. */
export function normalizeSaveKeys(raw: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k.toLowerCase().slice(0, 3)] = v;
  }
  return out;
}

/** Skills: snake_case ('sleight_of_hand'). Older records used display labels. */
export function normalizeSkillKeys(raw: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k.toLowerCase().replace(/[ -]/g, '_')] = v;
  }
  return out;
}

/** Armor / weapon proficiency flags: lowercase ('light', 'martial'). */
export function normalizeFlagKeys(raw: Record<string, boolean> | null | undefined): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    const key = k.toLowerCase();
    out[key] = out[key] || Boolean(v);
  }
  return out;
}

const SPEED_ALIASES: Record<string, string> = {
  walk: 'walking',
  climb: 'climbing',
  swim: 'swimming',
  fly: 'flying',
  burrow: 'burrowing',
};

/** Speeds: D&D Beyond's movement names ('walking', 'flying', ...). */
export function normalizeSpeedKeys(raw: Record<string, string> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    const key = k.trim().toLowerCase();
    out[SPEED_ALIASES[key] ?? key] = v;
  }
  return out;
}
