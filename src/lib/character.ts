// Character math: single source of truth for derived numbers.
// These take a PlayerCharacter (or compatible partial) and compute values that
// must never live as raw columns — they're driven by ability scores + PB.

import type { ClassLevel, FeatureDc, PlayerCharacter } from '@/types';

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

/** 8 + PB + Str mod — or Dex mod for a Martial Arts user whose Dex is higher. */
export function grappleShoveDc(c: Partial<PlayerCharacter>): number {
  const pb = c.proficiency_bonus ?? 2;
  const str = abilityModifier(c.str_score);
  const dex = abilityModifier(c.dex_score);
  const martialArts =
    (c.class_features ?? []).some((f) => /^martial arts$/i.test(f.name)) || /\bmonk\b/i.test(c.class_name ?? '');
  return 8 + pb + (martialArts && dex > str ? dex : str);
}

/**
 * The vitals strip's feature DC. The label comes from the import (spell, Focus,
 * Maneuver, Grapple/Shove); the value is recomputed from current scores so DM
 * edits and reskinned casting abilities stay correct.
 */
export function featureDc(c: Partial<PlayerCharacter>): FeatureDc {
  const label = c.feature_dc?.label ?? (c.is_spellcaster && c.spellcasting_ability ? 'Spell DC' : 'Grapple/Shove DC');
  const pb = c.proficiency_bonus ?? 2;
  switch (label) {
    case 'Spell DC':
      return { label, value: spellSaveDc(c) };
    case 'Focus DC':
      return { label, value: 8 + pb + abilityModifier(c.wis_score) };
    case 'Maneuver DC':
      return { label, value: 8 + pb + Math.max(abilityModifier(c.str_score), abilityModifier(c.dex_score)) };
    case 'Grapple/Shove DC':
      return { label, value: grappleShoveDc(c) };
    default:
      return { label, value: c.feature_dc?.value ?? grappleShoveDc(c) };
  }
}

/**
 * Per-class entries from the editable class line: "Wizard 5 / Rogue 3" with
 * subclass "Evoker / Thief"; a single-class line ("Barbarian") takes `level`.
 */
export function deriveClasses(className: string, level: number, subclass: string): ClassLevel[] {
  const parts = className.split('/').map((p) => p.trim()).filter(Boolean);
  const subclasses = subclass.split('/').map((s) => s.trim());
  if (parts.length <= 1) {
    const name = (parts[0] ?? '').replace(/\s+\d+$/, '').trim();
    return name ? [{ class_name: name, level, subclass: subclass.trim() }] : [];
  }
  return parts.map((part, i) => {
    const m = part.match(/^(.+?)\s+(\d+)$/);
    return { class_name: m ? m[1].trim() : part, level: m ? parseInt(m[2], 10) : 1, subclass: subclasses[i] ?? '' };
  });
}

/** Spell-name key that ignores case, punctuation, and bracket markers ("Ceremony [R]" ≡ "ceremony"). */
export function spellKey(name: string): string {
  return name.toLowerCase().replace(/\[[^\]]*\]/g, '').replace(/[^a-z0-9]+/g, '');
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
