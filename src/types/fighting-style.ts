// Fighting Style definitions, loaded from src/data/fighting-styles.ts.
// Used by classes that grant fighting styles (Magus, Fighter, Paladin, Ranger, etc.).
// Each ClassDefinition declares which IDs are available.

export interface FightingStyleDefinition {
  id: string;
  name: string;
  /** Human-readable prerequisite, or undefined if none. */
  prerequisite?: string;
  /** Full mechanical description. */
  description: string;
}
