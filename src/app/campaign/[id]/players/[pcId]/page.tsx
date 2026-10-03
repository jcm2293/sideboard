'use client';

import { use, useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { playerCharacterStore, customSpellStore } from '@/lib/data';
import srdSpellsData from '@/data/spells.json';
import type {
  PlayerCharacter,
  AttackEntry,
  ClassResource,
  FeatureEntry,
  EquipmentEntry,
  ProficiencyLevel,
  SrdSpell,
  CustomSpell,
} from '@/types';
import {
  abilityModifier,
  spellSaveDc,
  spellAttackBonus,
  modString,
  normalizeFlagKeys,
  normalizeSaveKeys,
  normalizeSkillKeys,
  normalizeSpeedKeys,
  deriveClasses,
  spellKey,
} from '@/lib/character';
import { mergeReupload, withoutPdfOnly, type PdfOnlyGroup, type ReuploadReport } from '@/lib/character-merge';
import ReuploadReportPanel from '@/components/characters/ReuploadReportPanel';

const SRD_SPELLS = srdSpellsData as SrdSpell[];

// Normalize a spell name for fuzzy library lookup.
function normalizeSpellName(s: string): string {
  return s.toLowerCase().replace(/['']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

function modStr(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

// Lower-case 3-letter ability keys — match parser, schema, and PDF export.
const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
type AbilityKey = (typeof ABILITY_KEYS)[number];

const ABILITY_LABEL: Record<AbilityKey, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
};

// Skill keys are snake_case. Display labels rendered separately.
interface SkillSpec { key: string; label: string }

const SKILLS_BY_ABILITY: Record<AbilityKey, SkillSpec[]> = {
  str: [{ key: 'athletics', label: 'Athletics' }],
  dex: [
    { key: 'acrobatics', label: 'Acrobatics' },
    { key: 'sleight_of_hand', label: 'Sleight of Hand' },
    { key: 'stealth', label: 'Stealth' },
  ],
  con: [],
  int: [
    { key: 'arcana', label: 'Arcana' },
    { key: 'history', label: 'History' },
    { key: 'investigation', label: 'Investigation' },
    { key: 'nature', label: 'Nature' },
    { key: 'religion', label: 'Religion' },
  ],
  wis: [
    { key: 'animal_handling', label: 'Animal Handling' },
    { key: 'insight', label: 'Insight' },
    { key: 'medicine', label: 'Medicine' },
    { key: 'perception', label: 'Perception' },
    { key: 'survival', label: 'Survival' },
  ],
  cha: [
    { key: 'deception', label: 'Deception' },
    { key: 'intimidation', label: 'Intimidation' },
    { key: 'performance', label: 'Performance' },
    { key: 'persuasion', label: 'Persuasion' },
  ],
};

// Stored keys are lowercase — the parser, homebrew wizard and PDF export all
// read that shape. Labels are display-only.
const ARMOR_TYPES = [
  { key: 'light', label: 'Light' },
  { key: 'medium', label: 'Medium' },
  { key: 'heavy', label: 'Heavy' },
  { key: 'shields', label: 'Shields' },
];
const WEAPON_TYPES = [
  { key: 'simple', label: 'Simple' },
  { key: 'martial', label: 'Martial' },
];

const MOVEMENT_TYPES = ['walking', 'climbing', 'swimming', 'flying', 'burrowing'];

// Suggestions only — recovery is free text ("Long Rest (regain 1 on Short Rest)").
const RECOVERY_OPTIONS = ['Short Rest', 'Long Rest', 'Dawn', 'Once per turn'];

const PROF_LEVELS: ProficiencyLevel[] = ['none', 'half', 'proficient', 'expertise'];

function pruneSpellDetails(
  details: PlayerCharacter['spell_details'] | undefined,
  spells: Record<string, string[]>,
): PlayerCharacter['spell_details'] {
  if (!details) return null;
  const onSheet = new Set(Object.values(spells).flat().map(spellKey));
  const kept = Object.fromEntries(Object.entries(details).filter(([, d]) => onSheet.has(spellKey(d.name))));
  return Object.keys(kept).length > 0 ? kept : null;
}
const SAVE_PROF_LEVELS: ProficiencyLevel[] = ['none', 'proficient'];

const inputClass =
  'bg-surface-light border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent w-full';
const numberInputClass =
  'bg-surface-light border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent w-full font-data';
// Compact variants for inline rows where w-full would crush sibling labels.
const compactInputClass =
  'bg-surface-light border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-accent';
const compactNumberClass =
  'bg-surface-light border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-accent font-data';

export default function PlayerCharacterEditPage({
  params,
}: {
  params: Promise<{ id: string; pcId: string }>;
}) {
  const { id, pcId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNew = pcId === 'new';
  const isParsed = searchParams.get('parsed') === 'true';

  // Loading state
  const [loading, setLoading] = useState(!isNew || isParsed);
  const [saving, setSaving] = useState(false);
  // Multiclass flag from the parse flow — surfaces a verify-slots banner.
  const [isMulticlass, setIsMulticlass] = useState(false);
  // What a re-uploaded PDF changed, kept, and offered when merged into this sheet.
  const [reuploadReport, setReuploadReport] = useState<ReuploadReport | null>(null);
  // What the parser and the JSON overlay want the DM to know about this import.
  const [importNotices, setImportNotices] = useState<string[]>([]);
  // Structured import data (sheet v3) with no form controls; carried through to save.
  // `classes` is re-derived from the class line on save, so it isn't held here.
  const [importData, setImportData] = useState<
    Pick<PlayerCharacter, 'spell_details' | 'weapon_masteries' | 'grapple_shove_dc' | 'feature_dc'>
  >({});
  // Campaign-scoped custom spells, used to detect spells that lack a library entry.
  const [customSpells, setCustomSpells] = useState<CustomSpell[]>([]);
  // Modal state for adding a description to a not-in-library spell.
  const [addDescSpell, setAddDescSpell] = useState<{ name: string; level: number } | null>(null);

  // Header
  const [name, setName] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [species, setSpecies] = useState('');
  const [background, setBackground] = useState('');
  const [className, setClassName] = useState('');
  const [subclass, setSubclass] = useState('');
  const [level, setLevel] = useState(1);
  const [proficiencyBonus, setProficiencyBonus] = useState(2);

  // Passives & Senses
  const [passivePerception, setPassivePerception] = useState(10);
  const [passiveInsight, setPassiveInsight] = useState(10);
  const [passiveInvestigation, setPassiveInvestigation] = useState(10);
  const [senses, setSenses] = useState('');

  // Ability Scores
  const [strScore, setStrScore] = useState(10);
  const [dexScore, setDexScore] = useState(10);
  const [conScore, setConScore] = useState(10);
  const [intScore, setIntScore] = useState(10);
  const [wisScore, setWisScore] = useState(10);
  const [chaScore, setChaScore] = useState(10);

  // Save Modifiers (keyed by lowercase 3-letter ability: str/dex/con/int/wis/cha)
  const [saveMods, setSaveMods] = useState<Record<string, number>>({
    str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0,
  });
  const [saveProfs, setSaveProfs] = useState<Record<string, ProficiencyLevel>>({
    str: 'none', dex: 'none', con: 'none', int: 'none', wis: 'none', cha: 'none',
  });

  // Skill Modifiers (keyed by snake_case skill name)
  const [skillMods, setSkillMods] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const list of Object.values(SKILLS_BY_ABILITY)) {
      for (const s of list) init[s.key] = 0;
    }
    return init;
  });
  const [skillProfs, setSkillProfs] = useState<Record<string, ProficiencyLevel>>(() => {
    const init: Record<string, ProficiencyLevel> = {};
    for (const list of Object.values(SKILLS_BY_ABILITY)) {
      for (const s of list) init[s.key] = 'none';
    }
    return init;
  });

  // Combat
  const [armorClass, setArmorClass] = useState(10);
  const [acSource, setAcSource] = useState('');
  const [initiativeMod, setInitiativeMod] = useState(0);
  const [hpMax, setHpMax] = useState(1);
  // Keyed by movement type. Keys outside MOVEMENT_TYPES are kept and stay
  // editable, so a record's speeds survive a save intact.
  const [speeds, setSpeeds] = useState<Record<string, string>>({ walking: '30 ft.' });
  const [hitDiceTotal, setHitDiceTotal] = useState('');

  // Attacks
  const [attacks, setAttacks] = useState<AttackEntry[]>([]);

  // Defenses
  const [damageResistances, setDamageResistances] = useState('');
  const [damageImmunities, setDamageImmunities] = useState('');
  const [conditionImmunities, setConditionImmunities] = useState('');

  // Proficiencies
  const [armorProfs, setArmorProfs] = useState<Record<string, boolean>>({
    light: false, medium: false, heavy: false, shields: false,
  });
  const [weaponProfs, setWeaponProfs] = useState<Record<string, boolean>>({
    simple: false, martial: false,
  });
  const [languages, setLanguages] = useState('');
  const [toolProficiencies, setToolProficiencies] = useState('');

  // Class Resources
  const [classResources, setClassResources] = useState<ClassResource[]>([]);

  // Features
  const [classFeatures, setClassFeatures] = useState<FeatureEntry[]>([]);
  const [racialTraits, setRacialTraits] = useState<FeatureEntry[]>([]);
  const [feats, setFeats] = useState<FeatureEntry[]>([]);

  // Equipment
  const [equipment, setEquipment] = useState<EquipmentEntry[]>([]);

  // Currency
  const [cp, setCp] = useState(0);
  const [sp, setSp] = useState(0);
  const [ep, setEp] = useState(0);
  const [gp, setGp] = useState(0);
  const [pp, setPp] = useState(0);

  // Spellcasting
  const [isSpellcaster, setIsSpellcaster] = useState(false);
  const [spellcastingAbility, setSpellcastingAbility] = useState('INT');
  // Override fields: null when calculation is used; non-null when user toggles override on.
  const [spellAttackBonusOverride, setSpellAttackBonusOverride] = useState<number | null>(null);
  const [spellSaveDcOverride, setSpellSaveDcOverride] = useState<number | null>(null);
  const [isPreparedCaster, setIsPreparedCaster] = useState(false);
  const [pactSlotLevel, setPactSlotLevel] = useState(1);
  const [pactSlotCount, setPactSlotCount] = useState(1);
  const [spellSlots, setSpellSlots] = useState<Record<string, number>>({
    '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0,
  });
  const [spells, setSpells] = useState<Record<string, string[]>>({
    '0': [], '1': [], '2': [], '3': [], '4': [],
    '5': [], '6': [], '7': [], '8': [], '9': [],
  });
  const [preparedSpells, setPreparedSpells] = useState<string[]>([]);

  // Populate form from a PlayerCharacter object
  function populateForm(pc: Partial<PlayerCharacter>) {
    if (pc.name) setName(pc.name);
    if (pc.species) setSpecies(pc.species);
    if (pc.background) setBackground(pc.background);
    setImportData({
      spell_details: pc.spell_details ?? null,
      weapon_masteries: pc.weapon_masteries ?? null,
      grapple_shove_dc: pc.grapple_shove_dc ?? null,
      feature_dc: pc.feature_dc ?? null,
    });
    if (pc.player_name) setPlayerName(pc.player_name);
    if (pc.class_name) setClassName(pc.class_name);
    if (pc.subclass) setSubclass(pc.subclass);
    if (pc.level != null) setLevel(pc.level);
    if (pc.is_multiclass) setIsMulticlass(true);
    if (pc.proficiency_bonus != null) setProficiencyBonus(pc.proficiency_bonus);

    if (pc.passive_perception != null) setPassivePerception(pc.passive_perception);
    if (pc.passive_insight != null) setPassiveInsight(pc.passive_insight);
    if (pc.passive_investigation != null) setPassiveInvestigation(pc.passive_investigation);
    if (pc.senses) setSenses(pc.senses);

    if (pc.str_score != null) setStrScore(pc.str_score);
    if (pc.dex_score != null) setDexScore(pc.dex_score);
    if (pc.con_score != null) setConScore(pc.con_score);
    if (pc.int_score != null) setIntScore(pc.int_score);
    if (pc.wis_score != null) setWisScore(pc.wis_score);
    if (pc.cha_score != null) setChaScore(pc.cha_score);

    if (pc.save_modifiers) setSaveMods(normalizeSaveKeys(pc.save_modifiers));
    if (pc.skill_modifiers) setSkillMods(normalizeSkillKeys(pc.skill_modifiers));
    if (pc.save_proficiencies) {
      setSaveProfs((prev) => ({ ...prev, ...pc.save_proficiencies }));
    }
    if (pc.skill_proficiencies) {
      setSkillProfs((prev) => ({ ...prev, ...pc.skill_proficiencies }));
    }

    if (pc.armor_class != null) setArmorClass(pc.armor_class);
    if (pc.ac_source) setAcSource(pc.ac_source);
    if (pc.initiative_modifier != null) setInitiativeMod(pc.initiative_modifier);
    if (pc.hp_max != null) setHpMax(pc.hp_max);
    if (pc.speeds) {
      const loaded = normalizeSpeedKeys(pc.speeds);
      setSpeeds((prev) => ({ ...prev, ...loaded }));
    }
    if (pc.hit_dice_total) setHitDiceTotal(pc.hit_dice_total);

    if (pc.attacks) setAttacks(pc.attacks);

    if (pc.damage_resistances) setDamageResistances(pc.damage_resistances);
    if (pc.damage_immunities) setDamageImmunities(pc.damage_immunities);
    if (pc.condition_immunities) setConditionImmunities(pc.condition_immunities);

    if (pc.armor_proficiencies) {
      const loaded = normalizeFlagKeys(pc.armor_proficiencies);
      setArmorProfs((prev) => ({ ...prev, ...loaded }));
    }
    if (pc.weapon_proficiencies) {
      const loaded = normalizeFlagKeys(pc.weapon_proficiencies);
      setWeaponProfs((prev) => ({ ...prev, ...loaded }));
    }
    if (pc.languages) setLanguages(pc.languages);
    if (pc.tool_proficiencies) setToolProficiencies(pc.tool_proficiencies);

    if (pc.class_resources) setClassResources(pc.class_resources);
    if (pc.class_features) setClassFeatures(pc.class_features);
    if (pc.racial_traits) setRacialTraits(pc.racial_traits);
    if (pc.feats) setFeats(pc.feats);

    if (pc.equipment) setEquipment(pc.equipment);

    if (pc.cp != null) setCp(pc.cp);
    if (pc.sp != null) setSp(pc.sp);
    if (pc.ep != null) setEp(pc.ep);
    if (pc.gp != null) setGp(pc.gp);
    if (pc.pp != null) setPp(pc.pp);

    if (pc.is_spellcaster != null) setIsSpellcaster(pc.is_spellcaster);
    if (pc.spellcasting_ability) setSpellcastingAbility(pc.spellcasting_ability);
    setSpellAttackBonusOverride(pc.spell_attack_bonus_override ?? null);
    setSpellSaveDcOverride(pc.spell_save_dc_override ?? null);
    if (pc.is_prepared_caster != null) setIsPreparedCaster(pc.is_prepared_caster);
    if (pc.pact_slot_level != null) setPactSlotLevel(pc.pact_slot_level);
    if (pc.pact_slot_count != null) setPactSlotCount(pc.pact_slot_count);
    if (pc.spell_slots) setSpellSlots(pc.spell_slots);
    if (pc.spells) setSpells(pc.spells);
    if (pc.prepared_spells) setPreparedSpells(pc.prepared_spells);
  }

  // Load character data: an existing sheet, a freshly parsed PDF (new upload),
  // or both — a re-upload, merged into the existing sheet.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const raw = isParsed ? sessionStorage.getItem('parsedCharacter') : null;
      const rawNotices = isParsed ? sessionStorage.getItem('parsedNotices') : null;
      let parsed: Partial<PlayerCharacter> | null = null;
      let notices: string[] = [];
      if (raw) {
        try {
          parsed = JSON.parse(raw) as Partial<PlayerCharacter>;
          notices = rawNotices ? (JSON.parse(rawNotices) as string[]) : [];
        } catch {
          // ignore malformed hand-off data
        }
      }

      const [existing, cs] = await Promise.all([
        isNew ? Promise.resolve(undefined) : playerCharacterStore.getById(pcId),
        // Campaign custom spells drive the Add-Description workflow.
        customSpellStore.getAll({ campaign_id: id } as Partial<CustomSpell>),
      ]);
      // Strict Mode runs this effect twice in dev; only the live run may
      // populate the form and consume the hand-off.
      if (cancelled) return;

      if (existing && parsed) {
        const { merged, report } = mergeReupload(existing, parsed);
        populateForm(merged);
        setReuploadReport(report);
      } else if (parsed) {
        populateForm(parsed);
      } else if (existing) {
        populateForm(existing);
      }
      if (parsed) setImportNotices(notices);
      if (raw) sessionStorage.removeItem('parsedCharacter');
      if (rawNotices) sessionStorage.removeItem('parsedNotices');
      setCustomSpells(cs);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id, pcId, isNew, isParsed]);

  // Set of every known spell name (SRD + this campaign's custom spells) for fast missing-spell detection.
  const knownSpellSet = useMemo(() => {
    const s = new Set<string>();
    for (const sp of SRD_SPELLS) s.add(normalizeSpellName(sp.name));
    for (const cs of customSpells) s.add(normalizeSpellName(cs.name));
    return s;
  }, [customSpells]);

  function spellInLibrary(name: string): boolean {
    if (!name.trim()) return true; // empty input — don't surface UI noise
    return knownSpellSet.has(normalizeSpellName(name));
  }

  // Score setters/getters by canonical lowercase ability key
  const scoreSetters: Record<AbilityKey, (v: number) => void> = {
    str: setStrScore, dex: setDexScore, con: setConScore,
    int: setIntScore, wis: setWisScore, cha: setChaScore,
  };
  const scoreGetters: Record<AbilityKey, number> = {
    str: strScore, dex: dexScore, con: conScore,
    int: intScore, wis: wisScore, cha: chaScore,
  };

  // Build the full PC data from form state
  function buildCharacterData(): Omit<PlayerCharacter, 'id' | 'created_at' | 'updated_at'> {
    return {
      campaign_id: id,
      name,
      player_name: playerName,
      class_name: className,
      subclass,
      level,
      is_multiclass: isMulticlass,
      proficiency_bonus: proficiencyBonus,
      passive_perception: passivePerception,
      passive_insight: passiveInsight,
      passive_investigation: passiveInvestigation,
      senses,
      str_score: strScore,
      dex_score: dexScore,
      con_score: conScore,
      int_score: intScore,
      wis_score: wisScore,
      cha_score: chaScore,
      save_modifiers: saveMods,
      skill_modifiers: skillMods,
      save_proficiencies: saveProfs,
      skill_proficiencies: skillProfs,
      armor_class: armorClass,
      ac_source: acSource,
      initiative_modifier: initiativeMod,
      hp_max: hpMax,
      speeds: Object.fromEntries(
        Object.entries(speeds).filter(([type, value]) => type === 'walking' || value.trim()),
      ),
      hit_dice_total: hitDiceTotal,
      attacks,
      damage_resistances: damageResistances,
      damage_immunities: damageImmunities,
      condition_immunities: conditionImmunities,
      armor_proficiencies: armorProfs,
      weapon_proficiencies: weaponProfs,
      languages,
      tool_proficiencies: toolProficiencies,
      class_resources: classResources.length > 0 ? classResources : null,
      class_features: classFeatures,
      racial_traits: racialTraits.length > 0 ? racialTraits : null,
      feats: feats.length > 0 ? feats : null,
      equipment,
      cp, sp, ep, gp, pp,
      is_spellcaster: isSpellcaster,
      spellcasting_ability: isSpellcaster ? spellcastingAbility : null,
      spell_attack_bonus_override: isSpellcaster ? spellAttackBonusOverride : null,
      spell_save_dc_override: isSpellcaster ? spellSaveDcOverride : null,
      is_prepared_caster: isSpellcaster ? isPreparedCaster : false,
      pact_slot_level: isSpellcaster && className.toLowerCase().includes('warlock') ? pactSlotLevel : null,
      pact_slot_count: isSpellcaster && className.toLowerCase().includes('warlock') ? pactSlotCount : null,
      spell_slots: isSpellcaster ? spellSlots : null,
      spells: isSpellcaster ? spells : null,
      prepared_spells: isSpellcaster && isPreparedCaster ? preparedSpells : null,
      pdf_url: null,
      species: species.trim() || null,
      background: background.trim() || null,
      classes: deriveClasses(className, level, subclass),
      // Details only for spells still on the sheet (renamed or removed spells drop theirs).
      spell_details: isSpellcaster ? pruneSpellDetails(importData.spell_details, spells) : null,
      weapon_masteries: importData.weapon_masteries ?? null,
      grapple_shove_dc: importData.grapple_shove_dc ?? null,
      feature_dc: importData.feature_dc ?? null,
    };
  }

  async function handleSave() {
    if (
      reuploadReport?.warnings.length &&
      !confirm(`${reuploadReport.warnings.join('\n\n')}\n\nSave anyway?`)
    ) {
      return;
    }
    setSaving(true);
    try {
      const data = buildCharacterData();
      // A re-upload arrives as /players/{pcId}?parsed=true and must update that
      // character; only /players/new creates one.
      if (isNew) {
        await playerCharacterStore.create(data);
      } else if (!(await playerCharacterStore.update(pcId, data))) {
        throw new Error(`Update failed for character ${pcId}`);
      }
      router.push(`/campaign/${id}/players`);
    } catch (err) {
      console.error('Failed to save character:', err);
      alert('Failed to save character. Check console for details.');
    } finally {
      setSaving(false);
    }
  }

  async function handleExportPDF() {
    try {
      const data = buildCharacterData();
      const res = await fetch('/api/export-character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character: data, customSpells }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name || 'character'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert(`PDF export failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this character? This cannot be undone.')) return;
    await playerCharacterStore.delete(pcId);
    router.push(`/campaign/${id}/players`);
  }

  // Array helpers
  function updateAttack(index: number, field: keyof AttackEntry, value: string) {
    setAttacks((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  }
  function removeAttack(index: number) {
    setAttacks((prev) => prev.filter((_, i) => i !== index));
  }
  function updateClassResource(index: number, field: keyof ClassResource, value: string | number) {
    setClassResources((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  }
  function removeClassResource(index: number) {
    setClassResources((prev) => prev.filter((_, i) => i !== index));
  }
  function updateFeatureList(
    setter: React.Dispatch<React.SetStateAction<FeatureEntry[]>>,
    index: number,
    field: keyof FeatureEntry,
    value: string
  ) {
    setter((prev) => prev.map((f, i) => (i === index ? { ...f, [field]: value } : f)));
  }
  function removeFromFeatureList(
    setter: React.Dispatch<React.SetStateAction<FeatureEntry[]>>,
    index: number
  ) {
    setter((prev) => prev.filter((_, i) => i !== index));
  }
  function updateEquipment(index: number, field: keyof EquipmentEntry, value: string | number) {
    setEquipment((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [field]: value } : e))
    );
  }
  function removeEquipment(index: number) {
    setEquipment((prev) => prev.filter((_, i) => i !== index));
  }
  function updateSpellName(level: string, index: number, value: string) {
    setSpells((prev) => ({
      ...prev,
      [level]: prev[level].map((s, i) => (i === index ? value : s)),
    }));
  }
  function addSpell(level: string) {
    setSpells((prev) => ({ ...prev, [level]: [...prev[level], ''] }));
  }
  function removeSpell(level: string, index: number) {
    setSpells((prev) => ({
      ...prev,
      [level]: prev[level].filter((_, i) => i !== index),
    }));
  }
  function togglePreparedSpell(spellName: string) {
    setPreparedSpells((prev) =>
      prev.includes(spellName) ? prev.filter((s) => s !== spellName) : [...prev, spellName]
    );
  }

  // Copy items a re-uploaded PDF has (and this sheet doesn't) onto the sheet.
  function addFromPdf(group: PdfOnlyGroup, indexes: number[]) {
    switch (group.section) {
      case 'attacks': {
        const items = indexes.map((i) => group.items[i]);
        setAttacks((prev) => [...prev, ...items]);
        break;
      }
      case 'class_resources': {
        const items = indexes.map((i) => group.items[i]);
        setClassResources((prev) => [...prev, ...items]);
        break;
      }
      case 'class_features': {
        const items = indexes.map((i) => group.items[i]);
        setClassFeatures((prev) => [...prev, ...items]);
        break;
      }
      case 'racial_traits': {
        const items = indexes.map((i) => group.items[i]);
        setRacialTraits((prev) => [...prev, ...items]);
        break;
      }
      case 'feats': {
        const items = indexes.map((i) => group.items[i]);
        setFeats((prev) => [...prev, ...items]);
        break;
      }
      case 'equipment': {
        const items = indexes.map((i) => group.items[i]);
        setEquipment((prev) => [...prev, ...items]);
        break;
      }
      case 'spells': {
        const items = indexes.map((i) => group.items[i]);
        setSpells((prev) => {
          const next = { ...prev };
          for (const { name, level } of items) next[level] = [...(next[level] ?? []), name];
          return next;
        });
        setImportData((prev) => {
          const details = { ...(prev.spell_details ?? {}) };
          for (const { name, detail } of items) if (detail) details[name] = detail;
          return { ...prev, spell_details: details };
        });
        break;
      }
    }
    setReuploadReport((r) => (r ? withoutPdfOnly(r, group.section, indexes) : r));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted">Loading character...</p>
      </div>
    );
  }

  const isWarlock = className.toLowerCase().includes('warlock');

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-24">
      <h1 className="font-display text-2xl text-accent mb-6">
        {isNew ? 'Create Character' : `Edit ${name || 'Character'}`}
      </h1>

      {importNotices.length > 0 && (
        <section className="card-parchment rounded-lg p-4 mb-6 text-sm">
          <div className="flex justify-between items-start mb-2">
            <h2 className="font-display text-base text-accent">Import notes</h2>
            <button type="button" onClick={() => setImportNotices([])} className="text-xs text-muted hover:underline">
              Dismiss
            </button>
          </div>
          <ul className="list-disc pl-5 space-y-1">
            {importNotices.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      )}

      {reuploadReport && (
        <ReuploadReportPanel
          report={reuploadReport}
          onAdd={addFromPdf}
          onDismiss={() => setReuploadReport(null)}
        />
      )}

      {/* ─── HEADER ─── */}
      <section className="card-parchment rounded-lg p-5 mb-6">
        <h2 className="font-display text-lg text-accent mb-4">Identity</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Character name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Player Name</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className={inputClass}
              placeholder="Player name"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-muted mb-1">Species</label>
              <input
                type="text"
                value={species}
                onChange={(e) => setSpecies(e.target.value)}
                className={inputClass}
                placeholder="e.g. Dhampir"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-muted mb-1">Background</label>
              <input
                type="text"
                value={background}
                onChange={(e) => setBackground(e.target.value)}
                className={inputClass}
                placeholder="e.g. Sailor"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-muted mb-1">Class</label>
              <input
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className={inputClass}
                placeholder="e.g. Fighter"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-muted mb-1">Subclass</label>
              <input
                type="text"
                value={subclass}
                onChange={(e) => setSubclass(e.target.value)}
                className={inputClass}
                placeholder="e.g. Champion"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-muted mb-1">Level</label>
              <input
                type="number"
                min={1}
                max={20}
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
                className={numberInputClass}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-muted mb-1">Proficiency Bonus</label>
              <input
                type="number"
                value={proficiencyBonus}
                onChange={(e) => setProficiencyBonus(Number(e.target.value))}
                className={numberInputClass}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─── PASSIVES & SENSES ─── */}
      <section className="card-parchment rounded-lg p-5 mb-6">
        <h2 className="font-display text-lg text-accent mb-4">Passives & Senses</h2>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Passive Perception</label>
            <input
              type="number"
              value={passivePerception}
              onChange={(e) => setPassivePerception(Number(e.target.value))}
              className={numberInputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Passive Insight</label>
            <input
              type="number"
              value={passiveInsight}
              onChange={(e) => setPassiveInsight(Number(e.target.value))}
              className={numberInputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Passive Investigation</label>
            <input
              type="number"
              value={passiveInvestigation}
              onChange={(e) => setPassiveInvestigation(Number(e.target.value))}
              className={numberInputClass}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Senses</label>
          <input
            type="text"
            value={senses}
            onChange={(e) => setSenses(e.target.value)}
            className={inputClass}
            placeholder="e.g. Darkvision 60 ft."
          />
        </div>
      </section>

      {/* ─── ABILITY SCORES & SKILLS ─── */}
      <section className="card-parchment rounded-lg p-5 mb-6">
        <h2 className="font-display text-lg text-accent mb-1">Ability Scores & Skills</h2>
        <p className="text-xs text-muted mb-4">
          Modifiers are pre-calculated and authoritative. Proficiency toggles are metadata for editing — they do not auto-recalculate the modifier.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ABILITY_KEYS.map((ab) => {
            const score = scoreGetters[ab];
            const mod = abilityMod(score);
            const skills = SKILLS_BY_ABILITY[ab];
            const saveMod = saveMods[ab] ?? 0;
            const saveProf = saveProfs[ab] ?? 'none';
            const isProfHint = saveProf === 'proficient'
              ? `${modStr(mod)} + ${proficiencyBonus} = ${modStr(mod + proficiencyBonus)}`
              : null;

            return (
              <div key={ab} className="border border-border rounded-md p-3 bg-surface-light/40">
                {/* Ability header: name + score + mod */}
                <div className="flex items-baseline justify-between mb-2 pb-2 border-b border-border/60">
                  <h3 className="font-display text-sm text-accent">{ABILITY_LABEL[ab]}</h3>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={score}
                      onChange={(e) => scoreSetters[ab](Number(e.target.value))}
                      className={`${compactNumberClass} w-14 text-center`}
                    />
                    <span className="font-data text-sm text-muted w-8 text-right">
                      {modStr(mod)}
                    </span>
                  </div>
                </div>

                {/* Save row */}
                <div className="flex items-center gap-2 mb-3 text-sm">
                  <span className="flex-1 font-medium text-muted">Save</span>
                  <input
                    type="number"
                    value={saveMod}
                    onChange={(e) =>
                      setSaveMods((prev) => ({ ...prev, [ab]: Number(e.target.value) }))
                    }
                    className={`${compactNumberClass} w-14 text-center shrink-0`}
                  />
                  <select
                    value={saveProf}
                    onChange={(e) =>
                      setSaveProfs((prev) => ({
                        ...prev,
                        [ab]: e.target.value as ProficiencyLevel,
                      }))
                    }
                    className={`${compactInputClass} text-xs w-24 shrink-0`}
                  >
                    {SAVE_PROF_LEVELS.map((p) => (
                      <option key={p} value={p}>
                        {p === 'none' ? '—' : 'Proficient'}
                      </option>
                    ))}
                  </select>
                </div>
                {isProfHint && (
                  <p className="text-[10px] text-muted/70 -mt-2 mb-2 font-data">
                    {isProfHint}
                  </p>
                )}

                {/* Skill rows */}
                {skills.length === 0 ? (
                  <p className="text-xs text-muted/60 italic">No skills under {ABILITY_LABEL[ab]}.</p>
                ) : (
                  <div className="space-y-1.5">
                    {skills.map((s) => (
                      <div key={s.key} className="flex items-center gap-2 text-sm">
                        <span className="flex-1 min-w-0 truncate" title={s.label}>
                          {s.label}
                        </span>
                        <input
                          type="number"
                          value={skillMods[s.key] ?? 0}
                          onChange={(e) =>
                            setSkillMods((prev) => ({
                              ...prev,
                              [s.key]: Number(e.target.value),
                            }))
                          }
                          className={`${compactNumberClass} w-14 text-center shrink-0`}
                        />
                        <select
                          value={skillProfs[s.key] ?? 'none'}
                          onChange={(e) =>
                            setSkillProfs((prev) => ({
                              ...prev,
                              [s.key]: e.target.value as ProficiencyLevel,
                            }))
                          }
                          className={`${compactInputClass} text-xs w-24 shrink-0`}
                        >
                          {PROF_LEVELS.map((p) => (
                            <option key={p} value={p}>
                              {p === 'none' ? '—' : p[0].toUpperCase() + p.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── COMBAT ─── */}
      <section className="card-parchment rounded-lg p-5 mb-6">
        <h2 className="font-display text-lg text-accent mb-4">Combat</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-muted mb-1">AC</label>
              <input
                type="number"
                value={armorClass}
                onChange={(e) => setArmorClass(Number(e.target.value))}
                className={numberInputClass}
              />
            </div>
            <div className="flex-[2]">
              <label className="block text-sm font-medium text-muted mb-1">AC Source</label>
              <input
                type="text"
                value={acSource}
                onChange={(e) => setAcSource(e.target.value)}
                className={inputClass}
                placeholder="e.g. Leather armor + DEX"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-muted mb-1">Initiative</label>
              <input
                type="number"
                value={initiativeMod}
                onChange={(e) => setInitiativeMod(Number(e.target.value))}
                className={numberInputClass}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-muted mb-1">HP Max</label>
              <input
                type="number"
                value={hpMax}
                onChange={(e) => setHpMax(Number(e.target.value))}
                className={numberInputClass}
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
          {[...MOVEMENT_TYPES, ...Object.keys(speeds).filter((t) => !MOVEMENT_TYPES.includes(t))].map(
            (type) => (
              <div key={type}>
                <label className="block text-sm font-medium text-muted mb-1">
                  {type[0].toUpperCase() + type.slice(1)} Speed{type === 'walking' ? ' *' : ''}
                </label>
                <input
                  type="text"
                  required={type === 'walking'}
                  value={speeds[type] ?? ''}
                  onChange={(e) => setSpeeds((prev) => ({ ...prev, [type]: e.target.value }))}
                  className={inputClass}
                />
              </div>
            ),
          )}
        </div>
        <div className="max-w-xs">
          <label className="block text-sm font-medium text-muted mb-1">Hit Dice Total</label>
          <input
            type="text"
            value={hitDiceTotal}
            onChange={(e) => setHitDiceTotal(e.target.value)}
            className={inputClass}
            placeholder="e.g. 7d8"
          />
        </div>
      </section>

      {/* ─── ATTACKS ─── */}
      <section className="card-parchment rounded-lg p-5 mb-6">
        <h2 className="font-display text-lg text-accent mb-4">Attacks</h2>
        <p className="text-xs text-muted mb-3">Include 1-2 key attack spells for quick reference</p>
        {attacks.map((atk, i) => (
          <div key={i} className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-2 items-end">
            <input
              type="text"
              value={atk.name}
              onChange={(e) => updateAttack(i, 'name', e.target.value)}
              className={inputClass}
              placeholder="Name"
            />
            <input
              type="text"
              value={atk.atk_bonus}
              onChange={(e) => updateAttack(i, 'atk_bonus', e.target.value)}
              className={inputClass}
              placeholder="+4"
            />
            <input
              type="text"
              value={atk.damage}
              onChange={(e) => updateAttack(i, 'damage', e.target.value)}
              className={inputClass}
              placeholder="1d6+1"
            />
            <input
              type="text"
              value={atk.damage_type}
              onChange={(e) => updateAttack(i, 'damage_type', e.target.value)}
              className={inputClass}
              placeholder="Type"
            />
            <input
              type="text"
              value={atk.range ?? ''}
              onChange={(e) => updateAttack(i, 'range', e.target.value)}
              className={inputClass}
              placeholder="Range"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={atk.notes ?? ''}
                onChange={(e) => updateAttack(i, 'notes', e.target.value)}
                className={`${inputClass} flex-1`}
                placeholder="Notes"
              />
              <button
                type="button"
                onClick={() => removeAttack(i)}
                className="text-danger text-xs hover:underline whitespace-nowrap"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setAttacks((prev) => [
              ...prev,
              { name: '', atk_bonus: '', damage: '', damage_type: '', range: '', notes: '' },
            ])
          }
          className="text-sm text-accent hover:underline mt-2"
        >
          + Add Attack
        </button>
      </section>

      {/* ─── DEFENSES ─── */}
      <section className="card-parchment rounded-lg p-5 mb-6">
        <h2 className="font-display text-lg text-accent mb-4">Defenses</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Damage Resistances</label>
            <input
              type="text"
              value={damageResistances}
              onChange={(e) => setDamageResistances(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Damage Immunities</label>
            <input
              type="text"
              value={damageImmunities}
              onChange={(e) => setDamageImmunities(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Condition Immunities</label>
            <input
              type="text"
              value={conditionImmunities}
              onChange={(e) => setConditionImmunities(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      {/* ─── PROFICIENCIES ─── */}
      <section className="card-parchment rounded-lg p-5 mb-6">
        <h2 className="font-display text-lg text-accent mb-4">Proficiencies</h2>
        <div className="mb-4">
          <label className="block text-sm font-medium text-muted mb-2">Armor</label>
          <div className="flex gap-2 flex-wrap">
            {ARMOR_TYPES.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setArmorProfs((prev) => ({ ...prev, [key]: !prev[key] }))}
                className={`px-3 py-1 rounded text-xs transition-colors ${
                  armorProfs[key]
                    ? 'bg-accent text-amber-50'
                    : 'bg-surface-light border border-border text-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-muted mb-2">Weapons</label>
          <div className="flex gap-2 flex-wrap">
            {WEAPON_TYPES.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setWeaponProfs((prev) => ({ ...prev, [key]: !prev[key] }))}
                className={`px-3 py-1 rounded text-xs transition-colors ${
                  weaponProfs[key]
                    ? 'bg-accent text-amber-50'
                    : 'bg-surface-light border border-border text-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Languages</label>
            <input
              type="text"
              value={languages}
              onChange={(e) => setLanguages(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Tool Proficiencies</label>
            <input
              type="text"
              value={toolProficiencies}
              onChange={(e) => setToolProficiencies(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      {/* ─── CLASS RESOURCES ─── */}
      <section className="card-parchment rounded-lg p-5 mb-6">
        <h2 className="font-display text-lg text-accent mb-4">Class Resources</h2>
        {classResources.map((res, i) => (
          <div key={i} className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-2 items-end">
            <input
              type="text"
              value={res.name}
              onChange={(e) => updateClassResource(i, 'name', e.target.value)}
              className={inputClass}
              placeholder="Name"
            />
            <input
              type="number"
              value={res.uses}
              onChange={(e) => updateClassResource(i, 'uses', Number(e.target.value))}
              className={numberInputClass}
              placeholder="Uses"
            />
            <input
              type="text"
              value={res.die ?? ''}
              onChange={(e) => updateClassResource(i, 'die', e.target.value)}
              className={inputClass}
              placeholder="e.g. d6"
            />
            <input
              type="text"
              list="recovery-options"
              value={res.recovery}
              onChange={(e) => updateClassResource(i, 'recovery', e.target.value)}
              className={inputClass}
              placeholder="Recovery"
            />
            <button
              type="button"
              onClick={() => removeClassResource(i)}
              className="text-danger text-xs hover:underline"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setClassResources((prev) => [
              ...prev,
              { name: '', uses: 0, die: '', recovery: 'Short Rest' },
            ])
          }
          className="text-sm text-accent hover:underline mt-2"
        >
          + Add Resource
        </button>
        <datalist id="recovery-options">
          {RECOVERY_OPTIONS.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      </section>

      {/* ─── CLASS FEATURES ─── */}
      <section className="card-parchment rounded-lg p-5 mb-6">
        <h2 className="font-display text-lg text-accent mb-4">Class Features</h2>
        <p className="text-xs text-muted mb-3">The summary is the one line the sheet shows in Your turn and on the feature heading; the full rules text comes from the import.</p>
        {classFeatures.map((f, i) => (
          <div key={i} className="flex gap-2 mb-2 items-end">
            <input
              type="text"
              value={f.name}
              onChange={(e) => updateFeatureList(setClassFeatures, i, 'name', e.target.value)}
              className={`${inputClass} flex-1`}
              placeholder="Feature Name"
            />
            <input
              type="text"
              value={f.summary}
              onChange={(e) => updateFeatureList(setClassFeatures, i, 'summary', e.target.value)}
              className={`${inputClass} flex-[2]`}
              placeholder="One-line summary"
            />
            <button
              type="button"
              onClick={() => removeFromFeatureList(setClassFeatures, i)}
              className="text-danger text-xs hover:underline whitespace-nowrap"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setClassFeatures((prev) => [...prev, { name: '', summary: '' }])}
          className="text-sm text-accent hover:underline mt-2"
        >
          + Add Feature
        </button>
      </section>

      {/* ─── RACIAL/SPECIES TRAITS ─── */}
      <section className="card-parchment rounded-lg p-5 mb-6">
        <h2 className="font-display text-lg text-accent mb-4">Racial / Species Traits</h2>
        {racialTraits.map((f, i) => (
          <div key={i} className="flex gap-2 mb-2 items-end">
            <input
              type="text"
              value={f.name}
              onChange={(e) => updateFeatureList(setRacialTraits, i, 'name', e.target.value)}
              className={`${inputClass} flex-1`}
              placeholder="Trait Name"
            />
            <input
              type="text"
              value={f.summary}
              onChange={(e) => updateFeatureList(setRacialTraits, i, 'summary', e.target.value)}
              className={`${inputClass} flex-[2]`}
              placeholder="One-line summary"
            />
            <button
              type="button"
              onClick={() => removeFromFeatureList(setRacialTraits, i)}
              className="text-danger text-xs hover:underline whitespace-nowrap"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setRacialTraits((prev) => [...prev, { name: '', summary: '' }])}
          className="text-sm text-accent hover:underline mt-2"
        >
          + Add Trait
        </button>
      </section>

      {/* ─── FEATS ─── */}
      <section className="card-parchment rounded-lg p-5 mb-6">
        <h2 className="font-display text-lg text-accent mb-4">Feats</h2>
        {feats.map((f, i) => (
          <div key={i} className="flex gap-2 mb-2 items-end">
            <input
              type="text"
              value={f.name}
              onChange={(e) => updateFeatureList(setFeats, i, 'name', e.target.value)}
              className={`${inputClass} flex-1`}
              placeholder="Feat Name"
            />
            <input
              type="text"
              value={f.summary}
              onChange={(e) => updateFeatureList(setFeats, i, 'summary', e.target.value)}
              className={`${inputClass} flex-[2]`}
              placeholder="One-line summary"
            />
            <button
              type="button"
              onClick={() => removeFromFeatureList(setFeats, i)}
              className="text-danger text-xs hover:underline whitespace-nowrap"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setFeats((prev) => [...prev, { name: '', summary: '' }])}
          className="text-sm text-accent hover:underline mt-2"
        >
          + Add Feat
        </button>
      </section>

      {/* ─── INVENTORY ─── */}
      <section className="card-parchment rounded-lg p-5 mb-6">
        <h2 className="font-display text-lg text-accent mb-4">Inventory</h2>
        {equipment.map((item, i) => (
          <div key={i} className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-2 items-end">
            <input
              type="text"
              value={item.name}
              onChange={(e) => updateEquipment(i, 'name', e.target.value)}
              className={inputClass}
              placeholder="Name"
            />
            <input
              type="number"
              value={item.qty}
              onChange={(e) => updateEquipment(i, 'qty', Number(e.target.value))}
              className={numberInputClass}
              placeholder="Qty"
            />
            <input
              type="text"
              value={item.weight ?? ''}
              onChange={(e) => updateEquipment(i, 'weight', e.target.value)}
              className={inputClass}
              placeholder="Weight"
            />
            <input
              type="text"
              value={item.notes ?? ''}
              onChange={(e) => updateEquipment(i, 'notes', e.target.value)}
              className={inputClass}
              placeholder="Notes"
            />
            <button
              type="button"
              onClick={() => removeEquipment(i)}
              className="text-danger text-xs hover:underline"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setEquipment((prev) => [...prev, { name: '', qty: 1, weight: '', notes: '' }])
          }
          className="text-sm text-accent hover:underline mt-2"
        >
          + Add Item
        </button>
      </section>

      {/* ─── CURRENCY ─── */}
      <section className="card-parchment rounded-lg p-5 mb-6">
        <h2 className="font-display text-lg text-accent mb-4">Currency</h2>
        <div className="flex gap-4 flex-wrap">
          {[
            { label: 'CP', value: cp, setter: setCp },
            { label: 'SP', value: sp, setter: setSp },
            { label: 'EP', value: ep, setter: setEp },
            { label: 'GP', value: gp, setter: setGp },
            { label: 'PP', value: pp, setter: setPp },
          ].map(({ label, value, setter }) => (
            <div key={label} className="flex flex-col items-center">
              <label className="text-xs text-muted mb-1">{label}</label>
              <input
                type="number"
                value={value}
                onChange={(e) => setter(Number(e.target.value))}
                className={`${numberInputClass} w-20 text-center`}
              />
            </div>
          ))}
        </div>
      </section>

      {/* ─── SPELLCASTING ─── */}
      <section className="card-parchment rounded-lg p-5 mb-6">
        <h2 className="font-display text-lg text-accent mb-4">Spellcasting</h2>
        {isMulticlass && (
          <div className="mb-4 p-3 border border-amber-500/40 bg-amber-50/40 rounded text-sm">
            <strong>Multiclass detected.</strong> Spell slots were auto-populated using only the
            highest-level class. The 5e multiclass spellcasting rule (sum half/third caster levels,
            then look up combined level) is not applied automatically — review and adjust the slots
            below if needed.
          </div>
        )}
        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={isSpellcaster}
            onChange={(e) => setIsSpellcaster(e.target.checked)}
            className="accent-accent"
          />
          <span className="text-sm">This character is a spellcaster</span>
        </label>

        {isSpellcaster && (() => {
          // Live calculation that mirrors /src/lib/character.ts so the displays
          // update as the user changes ability/level. Override values win when set.
          const abilityScore = (() => {
            const k = spellcastingAbility.toUpperCase();
            return k === 'STR' ? strScore
              : k === 'DEX' ? dexScore
              : k === 'CON' ? conScore
              : k === 'INT' ? intScore
              : k === 'WIS' ? wisScore
              : k === 'CHA' ? chaScore
              : 10;
          })();
          const calcAtk = proficiencyBonus + abilityModifier(abilityScore);
          const calcDc = 8 + proficiencyBonus + abilityModifier(abilityScore);
          const displayAtk = spellAttackBonusOverride ?? calcAtk;
          const displayDc = spellSaveDcOverride ?? calcDc;
          const overrideOn = spellAttackBonusOverride != null || spellSaveDcOverride != null;

          return (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">
                  Spellcasting Ability
                </label>
                <select
                  value={spellcastingAbility}
                  onChange={(e) => setSpellcastingAbility(e.target.value)}
                  className={inputClass}
                >
                  {ABILITY_KEYS.map((a) => (
                    <option key={a} value={a.toUpperCase()}>
                      {ABILITY_LABEL[a]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted uppercase tracking-wider mb-1">
                  Spell Attack
                </label>
                <div className="border border-border rounded px-3 py-2 text-sm bg-surface-light/40 font-data">
                  {modString(displayAtk)}
                  {spellAttackBonusOverride != null && (
                    <span className="ml-2 text-xs text-muted">override</span>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted uppercase tracking-wider mb-1">
                  Spell Save DC
                </label>
                <div className="border border-border rounded px-3 py-2 text-sm bg-surface-light/40 font-data">
                  {displayDc}
                  {spellSaveDcOverride != null && (
                    <span className="ml-2 text-xs text-muted">override</span>
                  )}
                </div>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPreparedCaster}
                    onChange={(e) => setIsPreparedCaster(e.target.checked)}
                    className="accent-accent"
                  />
                  <span className="text-sm">Prepared caster</span>
                </label>
              </div>
            </div>

            {/* Override toggle */}
            <div className="mb-4 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-muted">
                <input
                  type="checkbox"
                  checked={overrideOn}
                  onChange={(e) => {
                    if (e.target.checked) {
                      // Initialize overrides to current calculated values so the user can edit from there.
                      setSpellAttackBonusOverride(calcAtk);
                      setSpellSaveDcOverride(calcDc);
                    } else {
                      setSpellAttackBonusOverride(null);
                      setSpellSaveDcOverride(null);
                    }
                  }}
                  className="accent-accent"
                />
                <span>
                  Override calculated values (use only if a magic item or feature shifts these off the formula)
                </span>
              </label>
              {overrideOn && (
                <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-3 max-w-md">
                  <div>
                    <label className="block text-xs text-muted mb-1">Spell Attack Override</label>
                    <input
                      type="number"
                      value={spellAttackBonusOverride ?? calcAtk}
                      onChange={(e) => setSpellAttackBonusOverride(Number(e.target.value))}
                      className={`${numberInputClass} w-20`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">Spell DC Override</label>
                    <input
                      type="number"
                      value={spellSaveDcOverride ?? calcDc}
                      onChange={(e) => setSpellSaveDcOverride(Number(e.target.value))}
                      className={`${numberInputClass} w-20`}
                    />
                  </div>
                </div>
              )}
            </div>

            {isWarlock && (
              <div className="grid grid-cols-2 gap-4 mb-4 max-w-sm">
                <div>
                  <label className="block text-sm font-medium text-muted mb-1">
                    Pact Slot Level
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={pactSlotLevel}
                    onChange={(e) => setPactSlotLevel(Number(e.target.value))}
                    className={numberInputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted mb-1">
                    Pact Slot Count
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={pactSlotCount}
                    onChange={(e) => setPactSlotCount(Number(e.target.value))}
                    className={numberInputClass}
                  />
                </div>
              </div>
            )}

            {/* Spell Slots */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-muted mb-2">Spell Slots</label>
              <div className="flex gap-3 flex-wrap">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => (
                  <div key={lvl} className="flex flex-col items-center">
                    <span className="text-xs text-muted mb-1">{lvl}</span>
                    <input
                      type="number"
                      min={0}
                      value={spellSlots[String(lvl)] ?? 0}
                      onChange={(e) =>
                        setSpellSlots((prev) => ({
                          ...prev,
                          [String(lvl)]: Number(e.target.value),
                        }))
                      }
                      className={`${numberInputClass} w-14 text-center`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Spell List */}
            <div>
              <label className="block text-sm font-medium text-muted mb-2">Spells</label>
              {['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map((lvl) => {
                const levelLabel = lvl === '0' ? 'Cantrips' : `${lvl}${lvl === '1' ? 'st' : lvl === '2' ? 'nd' : lvl === '3' ? 'rd' : 'th'} Level`;
                const levelSpells = spells[lvl] ?? [];
                return (
                  <details key={lvl} className="mb-2">
                    <summary className="cursor-pointer text-sm font-medium text-accent hover:underline">
                      {levelLabel} ({levelSpells.length})
                    </summary>
                    <div className="pl-4 pt-2">
                      {levelSpells.map((spell, i) => {
                        const inLib = spellInLibrary(spell);
                        return (
                          <div key={i} className="flex items-center gap-2 mb-1">
                            {isPreparedCaster && lvl !== '0' && (
                              <input
                                type="checkbox"
                                checked={preparedSpells.includes(spell)}
                                onChange={() => togglePreparedSpell(spell)}
                                className="accent-accent"
                                title="Prepared"
                              />
                            )}
                            <input
                              type="text"
                              value={spell}
                              onChange={(e) => updateSpellName(lvl, i, e.target.value)}
                              className={`${inputClass} flex-1`}
                              placeholder="Spell name"
                            />
                            {spell.trim() && !inLib && (
                              <button
                                type="button"
                                onClick={() => setAddDescSpell({ name: spell, level: parseInt(lvl, 10) })}
                                className="text-xs text-amber-700 hover:underline whitespace-nowrap"
                                title="Spell not found in SRD or custom library"
                              >
                                + Add Description
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => removeSpell(lvl, i)}
                              className="text-danger text-xs hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => addSpell(lvl)}
                        className="text-xs text-accent hover:underline mt-1"
                      >
                        + Add Spell
                      </button>
                    </div>
                  </details>
                );
              })}
            </div>
          </>
          );
        })()}
      </section>

      {/* ─── ADD DESCRIPTION MODAL (for spells missing from SRD + custom library) ─── */}
      {addDescSpell && (
        <AddDescriptionModal
          campaignId={id}
          initialName={addDescSpell.name}
          initialLevel={addDescSpell.level}
          initialClass={className}
          onCancel={() => setAddDescSpell(null)}
          onSaved={(saved) => {
            setCustomSpells((prev) => [...prev, saved]);
            setAddDescSpell(null);
          }}
        />
      )}

      {/* ─── STICKY BOTTOM BAR ─── */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border p-3 flex gap-2 justify-center z-30">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !name}
          className="btn-primary px-6 py-2 rounded text-sm disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={handleExportPDF}
          className="btn-ghost px-6 py-2 rounded text-sm"
        >
          Export PDF
        </button>
        {!isNew && (
          <button
            type="button"
            onClick={handleDelete}
            className="px-6 py-2 rounded text-sm border border-danger text-danger hover:bg-danger hover:text-amber-50 transition-colors"
          >
            Delete Character
          </button>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// AddDescriptionModal
// Quick-create a campaign-scoped custom spell when a name appears on the sheet
// but isn't in any library. The user fills in the description from their own
// PHB; this is local data, not redistribution.
// ──────────────────────────────────────────────────────────────────────────

function AddDescriptionModal({
  campaignId,
  initialName,
  initialLevel,
  initialClass,
  onCancel,
  onSaved,
}: {
  campaignId: string;
  initialName: string;
  initialLevel: number;
  initialClass: string;
  onCancel: () => void;
  onSaved: (saved: CustomSpell) => void;
}) {
  const [school, setSchool] = useState('');
  const [castingTime, setCastingTime] = useState('1 action');
  const [range, setRange] = useState('');
  const [v, setV] = useState(false);
  const [s, setS] = useState(false);
  const [m, setM] = useState(false);
  const [material, setMaterial] = useState('');
  const [duration, setDuration] = useState('Instantaneous');
  const [concentration, setConcentration] = useState(false);
  const [ritual, setRitual] = useState(false);
  const [description, setDescription] = useState('');
  const [higherLevels, setHigherLevels] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const saved = await customSpellStore.create({
        campaign_id: campaignId,
        name: initialName.trim(),
        level: initialLevel,
        school: school.trim(),
        casting_time: castingTime.trim(),
        range: range.trim(),
        components_v: v,
        components_s: s,
        components_m: m,
        material_description: material.trim(),
        duration: duration.trim(),
        concentration,
        ritual,
        description: description.trim(),
        higher_levels: higherLevels.trim(),
        classes: initialClass ? [initialClass] : [],
      } as Omit<CustomSpell, 'id' | 'created_at'>);
      onSaved(saved);
    } catch (err) {
      console.error('Save custom spell failed:', err);
      alert('Save failed. Check console.');
    } finally {
      setSaving(false);
    }
  }

  const fc =
    'bg-surface-light border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-accent w-full';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card-parchment rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="font-display text-lg text-accent">Add Description</h3>
          <span className="text-xs text-muted">
            {initialLevel === 0 ? 'Cantrip' : `Level ${initialLevel}`}
            {initialClass ? ` • ${initialClass}` : ''}
          </span>
        </div>
        <p className="text-sm font-display text-accent">{initialName}</p>
        <p className="text-xs text-muted">
          This spell isn&apos;t in the SRD library. Fill in the details from your PHB and it&apos;ll be saved as a custom spell on this campaign.
        </p>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <div>
            <label className="block text-xs text-muted mb-1">School</label>
            <select value={school} onChange={(e) => setSchool(e.target.value)} className={fc}>
              <option value="">—</option>
              <option>Abjuration</option>
              <option>Conjuration</option>
              <option>Divination</option>
              <option>Enchantment</option>
              <option>Evocation</option>
              <option>Illusion</option>
              <option>Necromancy</option>
              <option>Transmutation</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Casting Time</label>
            <input value={castingTime} onChange={(e) => setCastingTime(e.target.value)} className={fc} placeholder="1 action / 1 bonus action / 1 reaction" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Range</label>
            <input value={range} onChange={(e) => setRange(e.target.value)} className={fc} placeholder="60 feet / Self / Touch" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Duration</label>
            <input value={duration} onChange={(e) => setDuration(e.target.value)} className={fc} placeholder="Instantaneous / 1 minute" />
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm pt-1">
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={v} onChange={(e) => setV(e.target.checked)} className="accent-accent" /> V
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={s} onChange={(e) => setS(e.target.checked)} className="accent-accent" /> S
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={m} onChange={(e) => setM(e.target.checked)} className="accent-accent" /> M
          </label>
          <label className="flex items-center gap-1 cursor-pointer ml-4">
            <input type="checkbox" checked={concentration} onChange={(e) => setConcentration(e.target.checked)} className="accent-accent" /> Concentration
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={ritual} onChange={(e) => setRitual(e.target.checked)} className="accent-accent" /> Ritual
          </label>
        </div>

        {m && (
          <div>
            <label className="block text-xs text-muted mb-1">Material Components</label>
            <input value={material} onChange={(e) => setMaterial(e.target.value)} className={fc} placeholder="a pinch of bat guano..." />
          </div>
        )}

        <div>
          <label className="block text-xs text-muted mb-1">Description *</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={`${fc} resize-none`} rows={5} />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">At Higher Levels (optional)</label>
          <textarea value={higherLevels} onChange={(e) => setHigherLevels(e.target.value)} className={`${fc} resize-none`} rows={2} />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={saving || !description.trim()}
            className="btn-primary px-4 py-2 rounded text-sm disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save to Custom Spells'}
          </button>
          <button onClick={onCancel} className="btn-ghost px-4 py-2 rounded text-sm">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
