'use client';

import { use, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { playerCharacterStore } from '@/lib/data';
import type {
  PlayerCharacter,
  AttackEntry,
  ClassResource,
  FeatureEntry,
  EquipmentEntry,
} from '@/types';

function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

function modStr(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

const ABILITIES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;

const SKILL_MAP: Record<string, string[]> = {
  STR: ['Athletics'],
  DEX: ['Acrobatics', 'Sleight of Hand', 'Stealth'],
  CON: [],
  INT: ['Arcana', 'History', 'Investigation', 'Nature', 'Religion'],
  WIS: ['Animal Handling', 'Insight', 'Medicine', 'Perception', 'Survival'],
  CHA: ['Deception', 'Intimidation', 'Performance', 'Persuasion'],
};

const inputClass =
  'bg-surface-light border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent w-full';
const numberInputClass =
  'bg-surface-light border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent w-full font-data';

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
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  // Header
  const [name, setName] = useState('');
  const [playerName, setPlayerName] = useState('');
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

  // Save Modifiers
  const [saveMods, setSaveMods] = useState<Record<string, number>>({
    STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0,
  });

  // Skill Modifiers
  const [skillMods, setSkillMods] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const skills of Object.values(SKILL_MAP)) {
      for (const s of skills) init[s] = 0;
    }
    return init;
  });

  // Combat
  const [armorClass, setArmorClass] = useState(10);
  const [acSource, setAcSource] = useState('');
  const [initiativeMod, setInitiativeMod] = useState(0);
  const [hpMax, setHpMax] = useState(1);
  const [walkingSpeed, setWalkingSpeed] = useState('30 ft.');
  const [climbingSpeed, setClimbingSpeed] = useState('');
  const [swimmingSpeed, setSwimmingSpeed] = useState('');
  const [hitDiceTotal, setHitDiceTotal] = useState('');

  // Attacks
  const [attacks, setAttacks] = useState<AttackEntry[]>([]);

  // Defenses
  const [damageResistances, setDamageResistances] = useState('');
  const [damageImmunities, setDamageImmunities] = useState('');
  const [conditionImmunities, setConditionImmunities] = useState('');

  // Proficiencies
  const [armorProfs, setArmorProfs] = useState<Record<string, boolean>>({
    Light: false, Medium: false, Heavy: false, Shields: false,
  });
  const [weaponProfs, setWeaponProfs] = useState<Record<string, boolean>>({
    Simple: false, Martial: false,
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
  const [spellAttackBonus, setSpellAttackBonus] = useState(0);
  const [spellSaveDC, setSpellSaveDC] = useState(8);
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
    if (pc.player_name) setPlayerName(pc.player_name);
    if (pc.class_name) setClassName(pc.class_name);
    if (pc.subclass) setSubclass(pc.subclass);
    if (pc.level != null) setLevel(pc.level);
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

    if (pc.save_modifiers) setSaveMods(pc.save_modifiers);
    if (pc.skill_modifiers) setSkillMods(pc.skill_modifiers);

    if (pc.armor_class != null) setArmorClass(pc.armor_class);
    if (pc.ac_source) setAcSource(pc.ac_source);
    if (pc.initiative_modifier != null) setInitiativeMod(pc.initiative_modifier);
    if (pc.hp_max != null) setHpMax(pc.hp_max);
    if (pc.speeds) {
      if (pc.speeds.walking) setWalkingSpeed(pc.speeds.walking);
      if (pc.speeds.climbing) setClimbingSpeed(pc.speeds.climbing);
      if (pc.speeds.swimming) setSwimmingSpeed(pc.speeds.swimming);
    }
    if (pc.hit_dice_total) setHitDiceTotal(pc.hit_dice_total);

    if (pc.attacks) setAttacks(pc.attacks);

    if (pc.damage_resistances) setDamageResistances(pc.damage_resistances);
    if (pc.damage_immunities) setDamageImmunities(pc.damage_immunities);
    if (pc.condition_immunities) setConditionImmunities(pc.condition_immunities);

    if (pc.armor_proficiencies) setArmorProfs(pc.armor_proficiencies);
    if (pc.weapon_proficiencies) setWeaponProfs(pc.weapon_proficiencies);
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
    if (pc.spell_attack_bonus != null) setSpellAttackBonus(pc.spell_attack_bonus);
    if (pc.spell_save_dc != null) setSpellSaveDC(pc.spell_save_dc);
    if (pc.is_prepared_caster != null) setIsPreparedCaster(pc.is_prepared_caster);
    if (pc.pact_slot_level != null) setPactSlotLevel(pc.pact_slot_level);
    if (pc.pact_slot_count != null) setPactSlotCount(pc.pact_slot_count);
    if (pc.spell_slots) setSpellSlots(pc.spell_slots);
    if (pc.spells) setSpells(pc.spells);
    if (pc.prepared_spells) setPreparedSpells(pc.prepared_spells);
  }

  // Load character data
  useEffect(() => {
    async function load() {
      // Check for parsed data from PDF upload flow
      if (isParsed) {
        try {
          const raw = sessionStorage.getItem('parsedCharacter');
          if (raw) {
            const parsed = JSON.parse(raw) as Partial<PlayerCharacter>;
            populateForm(parsed);
            sessionStorage.removeItem('parsedCharacter');
          }
        } catch {
          // ignore parse errors
        }
        setLoading(false);
        return;
      }

      if (!isNew) {
        const pc = await playerCharacterStore.getById(pcId);
        if (pc) populateForm(pc);
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pcId, isNew, isParsed]);

  // Score setters by ability key
  const scoreSetters: Record<string, (v: number) => void> = {
    STR: setStrScore, DEX: setDexScore, CON: setConScore,
    INT: setIntScore, WIS: setWisScore, CHA: setChaScore,
  };
  const scoreGetters: Record<string, number> = {
    STR: strScore, DEX: dexScore, CON: conScore,
    INT: intScore, WIS: wisScore, CHA: chaScore,
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
      armor_class: armorClass,
      ac_source: acSource,
      initiative_modifier: initiativeMod,
      hp_max: hpMax,
      speeds: {
        walking: walkingSpeed,
        ...(climbingSpeed ? { climbing: climbingSpeed } : {}),
        ...(swimmingSpeed ? { swimming: swimmingSpeed } : {}),
      },
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
      spell_attack_bonus: isSpellcaster ? spellAttackBonus : null,
      spell_save_dc: isSpellcaster ? spellSaveDC : null,
      is_prepared_caster: isSpellcaster ? isPreparedCaster : false,
      pact_slot_level: isSpellcaster && className.toLowerCase().includes('warlock') ? pactSlotLevel : null,
      pact_slot_count: isSpellcaster && className.toLowerCase().includes('warlock') ? pactSlotCount : null,
      spell_slots: isSpellcaster ? spellSlots : null,
      spells: isSpellcaster ? spells : null,
      prepared_spells: isSpellcaster && isPreparedCaster ? preparedSpells : null,
      pdf_url: null,
    };
  }

  async function handleSave() {
    setSaving(true);
    try {
      const data = buildCharacterData();
      if (isNew || isParsed) {
        await playerCharacterStore.create(data);
      } else {
        await playerCharacterStore.update(pcId, data);
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
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name || 'character'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('PDF export failed. The endpoint may not be built yet.');
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

      {/* ─── ABILITY SCORES ─── */}
      <section className="card-parchment rounded-lg p-5 mb-6">
        <h2 className="font-display text-lg text-accent mb-4">Ability Scores & Skills</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {ABILITIES.map((ability) => {
            const score = scoreGetters[ability];
            const mod = abilityMod(score);
            return (
              <div key={ability} className="text-center">
                <h3 className="font-display text-sm text-accent mb-2">{ability}</h3>
                <div className="flex items-center justify-center gap-1 mb-2">
                  <input
                    type="number"
                    value={score}
                    onChange={(e) => scoreSetters[ability](Number(e.target.value))}
                    className={`${numberInputClass} w-16 text-center`}
                  />
                  <span className="text-sm text-muted font-data">{modStr(mod)}</span>
                </div>
                <div className="mb-2">
                  <label className="block text-xs text-muted mb-1">Save</label>
                  <input
                    type="number"
                    value={saveMods[ability] ?? 0}
                    onChange={(e) =>
                      setSaveMods((prev) => ({ ...prev, [ability]: Number(e.target.value) }))
                    }
                    className={`${numberInputClass} w-16 text-center mx-auto`}
                  />
                </div>
                {SKILL_MAP[ability].map((skill) => (
                  <div key={skill} className="mb-1">
                    <label className="block text-xs text-muted">{skill}</label>
                    <input
                      type="number"
                      value={skillMods[skill] ?? 0}
                      onChange={(e) =>
                        setSkillMods((prev) => ({ ...prev, [skill]: Number(e.target.value) }))
                      }
                      className={`${numberInputClass} w-16 text-center mx-auto`}
                    />
                  </div>
                ))}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Walking Speed *</label>
            <input
              type="text"
              required
              value={walkingSpeed}
              onChange={(e) => setWalkingSpeed(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Climbing Speed</label>
            <input
              type="text"
              value={climbingSpeed}
              onChange={(e) => setClimbingSpeed(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Swimming Speed</label>
            <input
              type="text"
              value={swimmingSpeed}
              onChange={(e) => setSwimmingSpeed(e.target.value)}
              className={inputClass}
            />
          </div>
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
            {Object.keys(armorProfs).map((key) => (
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
                {key}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-muted mb-2">Weapons</label>
          <div className="flex gap-2 flex-wrap">
            {Object.keys(weaponProfs).map((key) => (
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
                {key}
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
            <select
              value={res.recovery}
              onChange={(e) => updateClassResource(i, 'recovery', e.target.value)}
              className={inputClass}
            >
              <option value="Short Rest">Short Rest</option>
              <option value="Long Rest">Long Rest</option>
            </select>
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
      </section>

      {/* ─── CLASS FEATURES ─── */}
      <section className="card-parchment rounded-lg p-5 mb-6">
        <h2 className="font-display text-lg text-accent mb-4">Class Features</h2>
        <p className="text-xs text-muted mb-3">Keep summaries to one sentence</p>
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
              placeholder="Summary"
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
              placeholder="Summary"
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
              placeholder="Summary"
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
        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={isSpellcaster}
            onChange={(e) => setIsSpellcaster(e.target.checked)}
            className="accent-accent"
          />
          <span className="text-sm">This character is a spellcaster</span>
        </label>

        {isSpellcaster && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">
                  Spellcasting Ability
                </label>
                <select
                  value={spellcastingAbility}
                  onChange={(e) => setSpellcastingAbility(e.target.value)}
                  className={inputClass}
                >
                  {ABILITIES.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">
                  Spell Attack Bonus
                </label>
                <input
                  type="number"
                  value={spellAttackBonus}
                  onChange={(e) => setSpellAttackBonus(Number(e.target.value))}
                  className={numberInputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Spell Save DC</label>
                <input
                  type="number"
                  value={spellSaveDC}
                  onChange={(e) => setSpellSaveDC(Number(e.target.value))}
                  className={numberInputClass}
                />
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
                      {levelSpells.map((spell, i) => (
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
                          <button
                            type="button"
                            onClick={() => removeSpell(lvl, i)}
                            className="text-danger text-xs hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
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
        )}
      </section>

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
