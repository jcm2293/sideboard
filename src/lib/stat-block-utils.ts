export interface StatBlockEntry {
  name: string;
  description: string;
}

/**
 * Parse a textarea string into {name, description} entries.
 * Each entry is separated by a blank line. The name is everything
 * before the first period in the first line of each block.
 */
export function parseEntries(text: string): StatBlockEntry[] {
  if (!text || !text.trim()) return [];

  return text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const dotIndex = block.indexOf('.');
      if (dotIndex === -1) {
        return { name: block, description: '' };
      }
      return {
        name: block.substring(0, dotIndex).trim(),
        description: block.substring(dotIndex + 1).trim(),
      };
    });
}

/**
 * Serialize {name, description} entries back to textarea format.
 */
export function serializeEntries(entries: StatBlockEntry[]): string {
  return entries
    .map((e) => (e.description ? `${e.name}. ${e.description}` : e.name))
    .join('\n\n');
}

/**
 * Standard CR → XP lookup table (5e SRD).
 */
const CR_XP_TABLE: Record<string, number> = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100,
  '1': 200, '2': 450, '3': 700, '4': 1100,
  '5': 1800, '6': 2300, '7': 2900, '8': 3900,
  '9': 5000, '10': 5900, '11': 7200, '12': 8400,
  '13': 10000, '14': 11500, '15': 13000, '16': 15000,
  '17': 18000, '18': 20000, '19': 22000, '20': 25000,
  '21': 33000, '22': 41000, '23': 50000, '24': 62000,
  '25': 75000, '26': 90000, '27': 105000, '28': 120000,
  '29': 135000, '30': 155000,
};

export function crToXP(cr: string): number | null {
  return CR_XP_TABLE[cr.trim()] ?? null;
}

export function formatXP(xp: number): string {
  return xp.toLocaleString();
}

export function abilityMod(score: number): string {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}
