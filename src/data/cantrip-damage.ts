// Damage for common attack cantrips that the bundled SRD 5.2 library doesn't
// carry, so the sheet's attacks table can show them without a custom spell.
// Dice are the level 1–4 values; the renderer scales them at 5, 11, and 17.
// A campaign custom spell with the same name wins over this table.

export interface CantripDamage {
  dice: string;
  type: string;
  note?: string;
}

export const CANTRIP_DAMAGE: Record<string, CantripDamage> = {
  'toll the dead': { dice: '1d8', type: 'necrotic', note: 'd12s instead if the target is already hurt' },
  'mind sliver': { dice: '1d6', type: 'psychic', note: 'target subtracts 1d4 from its next save' },
  'thunderclap': { dice: '1d6', type: 'thunder' },
  'word of radiance': { dice: '1d6', type: 'radiant' },
  'frostbite': { dice: '1d6', type: 'cold' },
  'infestation': { dice: '1d6', type: 'poison' },
  'create bonfire': { dice: '1d8', type: 'fire' },
  'primal savagery': { dice: '1d10', type: 'acid' },
  'sapping sting': { dice: '1d4', type: 'necrotic' },
  'lightning lure': { dice: '1d8', type: 'lightning' },
  'sword burst': { dice: '1d6', type: 'force' },
  'thorn whip': { dice: '1d6', type: 'piercing' },
};
