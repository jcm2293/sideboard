// Standard 5e point-buy rules.

import type { BaseAbilityScores } from './wizard-reducer';

export const POINT_BUY_BUDGET = 27;
export const POINT_BUY_MIN = 8;
export const POINT_BUY_MAX = 15;

const COST: Record<number, number> = {
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9,
};

export function pointCost(score: number): number {
  return COST[score] ?? 99;
}

export function totalPointsSpent(abilities: BaseAbilityScores): number {
  return Object.values(abilities).reduce((sum, s) => sum + pointCost(s), 0);
}

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;

export function defaultStandardArrayAssignment(): BaseAbilityScores {
  // Default mapping if user clicks "Use Standard Array" without manual reassignment.
  // INT prioritized for Magus; users adjust in the wizard.
  return { STR: 13, DEX: 14, CON: 12, INT: 15, WIS: 10, CHA: 8 };
}
