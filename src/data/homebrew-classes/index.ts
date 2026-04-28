// Registry of homebrew classes. To add a new class, drop a file in this directory
// and append its export to ALL_HOMEBREW_CLASSES below.

import type { ClassDefinition } from '@/types/homebrew-class';
import { MAGUS, magusCantripsKnown } from './magus';

export const ALL_HOMEBREW_CLASSES: ClassDefinition[] = [MAGUS];

/** Cantrip-known function lookup by class id (only spellcasters that get cantrips need one). */
export const CANTRIP_FNS: Record<string, (level: number) => number> = {
  magus: magusCantripsKnown,
};

export function findHomebrewClass(id: string): ClassDefinition | null {
  return ALL_HOMEBREW_CLASSES.find((c) => c.id === id) ?? null;
}
