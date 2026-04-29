// Wraps the bundled races.json so consumers get a typed RaceDefinition[].

import racesJson from './races.json';
import type { RaceDefinition } from '@/types/race';

interface RawRaceFile {
  metadata: unknown;
  races: Record<string, Omit<RaceDefinition, 'id'>>;
}

const raw = racesJson as unknown as RawRaceFile;

export const ALL_RACES: RaceDefinition[] = Object.entries(raw.races)
  .map(([id, data]) => ({ ...(data as Omit<RaceDefinition, 'id'>), id }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function findRace(id: string | null | undefined): RaceDefinition | null {
  if (!id) return null;
  return ALL_RACES.find((r) => r.id === id) ?? null;
}

/** Returns true if the race grants a starting feat (e.g. variant rules). */
export function raceGrantsFeat(race: RaceDefinition): boolean {
  if (race.starting_feat) return true;
  // Heuristic for legacy data: a trait whose name/description mentions a feat.
  return race.traits.some(
    (t) => /\bfeat\b/i.test(t.description) && /grant|gain|choose/i.test(t.description),
  );
}

/** Returns the count of language slots the race lets the user choose, or 0. */
export function raceLanguageChoiceCount(race: RaceDefinition): number {
  return race.languages?.choices?.count ?? 0;
}

/** Returns the count of skill slots the race grants (for legacy races like Half-Elf 2014). */
export function raceSkillChoiceCount(race: RaceDefinition): number {
  return race.skill_proficiencies?.count ?? 0;
}
