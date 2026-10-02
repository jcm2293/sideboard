// Checks the parsed fixtures (PCsheets/fixtures/out/*.json) against the
// parser-level acceptance list in docs/character-sheet-spec-v3.md §8.
// Rendering items are listed but checked by eye on export-fixtures' PDFs.
//
//   npx tsx scripts/parse-fixtures.ts && npx tsx scripts/check-fixtures.ts

import { readFileSync } from 'fs';
import type { PlayerCharacter } from '@/types';

const load = (f: string): PlayerCharacter =>
  JSON.parse(readFileSync(`PCsheets/fixtures/out/${f}.json`, 'utf8')).character;
const all = (c: PlayerCharacter) => [...c.class_features, ...(c.racial_traits ?? []), ...(c.feats ?? [])];
const feat = (c: PlayerCharacter, n: string) => all(c).find((f) => f.name.replace(/’/g, "'") === n);
const res = (c: PlayerCharacter, n: string) => (c.class_resources ?? []).find((r) => r.name === n);
const spell = (c: PlayerCharacter, n: string) => c.spell_details?.[n];
const spells = (c: PlayerCharacter) => Object.values(c.spell_details ?? {});
const act = (c: PlayerCharacter, f: string, label: string, action: string) =>
  (feat(c, f)?.activations ?? []).some((a) => a.label === label && a.action === action);
let pass = 0;
let fail = 0;
const check = (label: string, ok: unknown, detail = '') => {
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail ? `  → ${detail}` : ''}`);
};
const later = (label: string) => console.log(`  ----  ${label}  (renderer)`);


let c = load('warlock-dash-fiend-5');
console.log('warlock-dash-fiend-5');
for (const n of ['Thirsting Blade', 'Pact of the Blade', 'Mask of Many Faces', 'Pact of the Tome']) check(`${n} is its own feature`, !!feat(c, n));
check('pact slots 2 × 3rd, short rest', c.pact_slot_count === 2 && c.pact_slot_level === 3 && res(c, 'Pact slots (3rd level)')?.recovery === 'Short Rest');
check('Magical Cunning 1', res(c, 'Magical Cunning')?.uses === 1);
check('Vampiric Bite 3', res(c, 'Vampiric Bite')?.uses === 3);
check('Charm Person free 1', res(c, 'Charm Person (free cast)')?.uses === 1);
check('Misty Step free 1', res(c, 'Misty Step (free cast)')?.uses === 1);
const cpd = spell(c, 'Charm Person');
check('Charm Person carries free 1/LR and slot', cpd?.free_uses?.count === 1 && cpd.costs_slot === true, JSON.stringify(cpd));
check('Smooth Talker data present (activation + "1d4" on Deception/Intimidation/Persuasion text)', act(c, 'Arcane Eloquence', 'Smooth Talker', 'special') && /Deception, Intimidation, or Persuasion\) check, you can roll 1d4/.test(feat(c, 'Arcane Eloquence')!.full_text!));
later('Smooth Talker +1d4 printed on three Cha skills');
check('Misty Step once', spells(c).filter((s) => s.name === 'Misty Step').length === 1);
const bb = spell(c, 'Blood Bolt'); check('Blood Bolt has a complete index row', bb && bb.casting_time && bb.range && bb.duration && bb.save_or_atk && bb.components, JSON.stringify(bb));
check('no Pact Magic feature', !feat(c, 'Pact Magic'));
check('no ASI entry', !all(c).some((f) => /Ability Score/.test(f.name)));
check('no page refs in printable text', !all(c).some((f) => /PHB-2024 \d+/.test(f.full_text ?? '')));
check('species Dhampir', c.species === 'Dhampir');

c = load('bard-lucien-glamour-5');
console.log('bard-lucien-glamour-5');
check('slots 4 / 3 / 2', JSON.stringify([1, 2, 3].map((l) => c.spell_slots?.[String(l)])) === '[4,3,2]');
const bi = res(c, 'Bardic Inspiration'); check('Bardic Inspiration d8 × 4 · short rest', bi?.die === 'd8' && bi.uses === 4 && bi.recovery === 'Short Rest', JSON.stringify(bi));
check('Beguiling Magic 1/LR', res(c, 'Beguiling Magic')?.uses === 1 && res(c, 'Beguiling Magic')?.recovery === 'Long Rest');
check('Lucky 3', res(c, 'Luck Points')?.uses === 3);
const cp = spell(c, 'Charm Person'); check('Charm Person once, always prepared via Beguiling Magic', cp?.always_prepared && /Beguiling Magic/.test(cp.source) && spells(c).filter((s) => s.name === 'Charm Person').length === 1);
check('Finger Guns once (spell attack row)', c.attacks.filter((a) => a.name === 'Finger Guns').length === 1 && c.attacks.find((a) => a.name === 'Finger Guns')?.kind === 'spell');
check('Unarmed Strike 0 row dropped', !c.attacks.some((a) => a.name === 'Unarmed Strike'));
check('Heroic Inspiration from Resourceful', res(c, 'Heroic Inspiration')?.uses === 1);
check('Arcana half proficiency +5', c.skill_proficiencies.arcana === 'half' && c.skill_modifiers.arcana === 5);

c = load('monk-grandpa-dan-sun-soul-5');
console.log('monk-grandpa-dan-sun-soul-5');
// §8 says "Focus DC 16"; §4's formula (8 + PB + Wis) and the export's own Stunning Strike text say 10.
check('Feature DC: Focus DC 10', c.feature_dc?.label === 'Focus DC' && c.feature_dc.value === 10, JSON.stringify(c.feature_dc));
check('Focus Points 5, short rest', res(c, 'Focus Points')?.uses === 5 && res(c, 'Focus Points')?.recovery === 'Short Rest');
check('Uncanny Metabolism 1', res(c, 'Uncanny Metabolism')?.uses === 1);
check('Lucky 3', res(c, 'Luck Points')?.uses === 3);
check('Bonus: Flurry / Patient Defense / Step of the Wind', ['Flurry of Blows', 'Patient Defense', 'Step of the Wind'].every((l) => act(c, "Monk's Focus", l, 'bonus')));
check('Bonus: Unarmed Strike', act(c, 'Martial Arts', 'Unarmed Strike', 'bonus'));
check('Reaction: Deflect Attacks, Slow Fall', act(c, 'Deflect Attacks', 'Deflect Attack', 'reaction') && feat(c, 'Slow Fall')?.action === 'reaction');
check('Action: Attack twice, Stunning Strike, Radiant Sun Bolt', ['Extra Attack', 'Stunning Strike', 'Radiant Sun Bolt'].every((n) => feat(c, n)?.action === 'action'));
check('one Unarmed Strike row +8 · 1d8+5', c.attacks.filter((a) => a.name === 'Unarmed Strike').length === 1 && c.attacks.find((a) => a.name === 'Unarmed Strike')?.atk_bonus === '+8' && c.attacks.find((a) => a.name === 'Unarmed Strike')?.damage === '1d8+5');
check('Flurry row', c.attacks.some((a) => a.name === 'Flurry of Blows'));
check('Martial Arts die rider', c.attacks.some((a) => a.kind === 'rider' && a.damage === '1d8'));
check('Grapple/Shove DC 16 (Dex)', c.grapple_shove_dc === 16);
check('no spells', !c.is_spellcaster && !c.spell_details);

c = load('paladin-amber-slam-castigation-5');
console.log('paladin-amber-slam-castigation-5');
check('half-caster 1st ×4, 2nd ×2, no cantrips', c.spell_slots?.['1'] === 4 && c.spell_slots?.['2'] === 2 && !c.spells?.['0']);
const loh = res(c, 'Lay On Hands'); check('Lay On Hands 25-point pool', loh?.uses === 25 && loh.pool === true);
check('Channel Divinity 2 with Divine Sense and Incite', res(c, 'Channel Divinity')?.uses === 2 && act(c, 'Channel Divinity', 'Divine Sense', 'bonus') && act(c, 'Channel Divinity', 'Incite', 'bonus'));
const ds = spell(c, 'Divine Smite'); check('Divine Smite once: free 1/LR + slot', ds?.free_uses?.count === 1 && ds.costs_slot && spells(c).filter((s) => s.name === 'Divine Smite').length === 1);
check('Divine Smite rider row', c.attacks.some((a) => a.kind === 'rider' && a.name === 'Divine Smite'));
check('Find Steed once', spells(c).filter((s) => s.name === 'Find Steed').length === 1);
check('masteries: Warhammer: Push only', JSON.stringify(c.weapon_masteries) === '[{"weapon":"Warhammer","mastery":"Push"}]');
check('both fighting-style feats under Feats', ['Protection', 'Great Weapon Fighting'].every((n) => (c.feats || []).some((f) => f.name === n)));
check('Oath of Castigation spells always prepared', spells(c).filter((s) => /Oath of Castigation/.test(s.source)).every((s) => s.always_prepared && s.origin === 'subclass'));

c = load('multiclass-wizard5-rogue3');
console.log('multiclass-wizard5-rogue3');
check('both classes and subclasses', JSON.stringify(c.classes) === '[{"class_name":"Wizard","level":5,"subclass":"Evoker"},{"class_name":"Rogue","level":3,"subclass":"Thief"}]');
check('slots 4 / 3 / 2', JSON.stringify([1, 2, 3].map((l) => c.spell_slots?.[String(l)])) === '[4,3,2]');
check('HD 5d6 + 3d8', c.hit_dice_total === '5d6 + 3d8');
check('Wizard and Rogue groups', ['Wizard', 'Rogue'].every((g) => c.class_features.some((f) => f.group === g)));
const sa = c.attacks.find((a) => a.name === 'Sneak Attack'); check('Sneak Attack rider 2d6 with the condition clause', sa?.kind === 'rider' && sa.damage === '2d6' && /once per turn/.test(sa.notes ?? ''));
check('Bonus: Cunning Action, Steady Aim, Fast Hands ×3', feat(c, 'Cunning Action')?.action === 'bonus' && feat(c, 'Steady Aim')?.action === 'bonus' && (feat(c, 'Fast Hands')?.activations || []).filter((a) => a.action === 'bonus').length === 3);
check('Arcane Recovery 1/LR', res(c, 'Arcane Recovery')?.uses === 1 && res(c, 'Arcane Recovery')?.recovery === 'Long Rest');
check('Darkvision 120, magical sleep immunity, Fey Ancestry', /Darkvision 120/.test(c.senses) && /Magical Sleep/.test(c.condition_immunities) && !!feat(c, 'Fey Ancestry'));
const sp = ['Dancing Lights', 'Faerie Fire', 'Darkness'].map((n) => spell(c, n)); check('species spells deduped, species origin, free 1/LR on the leveled ones', sp.every((s) => s?.origin === 'species') && sp[1]?.free_uses && sp[2]?.free_uses && spells(c).length === 5);
for (const n of ['Faerie Fire', 'Darkness']) {
  const s = spell(c, n);
  check(`${n} carries free 1/LR and slot`, s?.free_uses?.count === 1 && s.costs_slot === true, JSON.stringify(s));
}
check('inventory Dagger ×4', c.equipment.find((e) => e.name === 'Dagger')?.qty === 4);
check('climb speed', !!c.speeds.climbing);

c = load('barbarian-zhela-storm-herald-5');
console.log('barbarian-zhela-storm-herald-5');
const rage = feat(c, 'Rage'); check('Rage: 3 / long rest · bonus action · canonical text', rage?.uses?.count === 3 && rage.uses.per === 'long' && rage.action === 'bonus' && (rage.full_text ?? '').length > 100);
check('Rage damage +2 rider', c.attacks.some((a) => a.kind === 'rider' && a.damage === '+2'));
check('Grapple/Shove DC 15', c.feature_dc?.label === 'Grapple/Shove DC' && c.feature_dc.value === 15);
const wm = all(c).filter((f) => f.name === 'Weapon Mastery'); check('Weapon Mastery once: Greatsword Graze · Whip Slow · Handaxe Vex', wm.length === 1 && JSON.stringify((c.weapon_masteries ?? []).map((m) => `${m.weapon}:${m.mastery}`)) === '["Greatsword:Graze","Whip:Slow","Handaxe:Vex"]');
check('Storm Aura: Sea under Bonus action, with the DC 13 text', act(c, 'Storm Aura', 'Sea', 'bonus') && /DEX DC 13/.test(feat(c, 'Storm Aura')?.option_details?.[0]?.text ?? ''));
check('Aggressive under Bonus action', feat(c, 'Aggressive')?.action === 'bonus');
check('Push (Tavern Brawler) → Always on (special)', act(c, 'Tavern Brawler', 'Push', 'special'));
const ha = c.attacks.find((a) => a.name === 'Handaxe'); check('Handaxe Vex tag, 20/60 range', ha?.tags?.includes('Vex') && ha.range === '20/60');
const eq = (n: string) => c.equipment.find((e) => e.name === n)?.qty;
check('inventory Handaxe ×4, Rations ×28, Bedroll ×3', eq('Handaxe') === 4 && eq('Rations') === 28 && eq('Bedroll') === 3);
const lb = c.equipment.reduce((s, e) => s + (parseFloat(e.weight ?? '') || 0), 0); check('inventory totals 162 lb', lb === 162, `${lb}`);
check('no Defenses (literal None suppressed)', !c.damage_resistances && !c.damage_immunities && !c.condition_immunities);
check('no spells', !c.is_spellcaster);
console.log(`\n${pass} pass, ${fail} fail`);
process.exitCode = fail > 0 ? 1 : 0;
