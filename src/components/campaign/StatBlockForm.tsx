'use client';

import { useState } from 'react';
import type { StatBlock } from '@/types';

interface StatBlockFormProps {
  initial?: StatBlock;
  onSave: (data: Omit<StatBlock, 'id' | 'created_at' | 'updated_at'>) => void;
  onCancel: () => void;
  campaignId: string;
}

const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];

export default function StatBlockForm({ initial, onSave, onCancel, campaignId }: StatBlockFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [size, setSize] = useState(initial?.size ?? 'Medium');
  const [type, setType] = useState(initial?.type ?? '');
  const [alignment, setAlignment] = useState(initial?.alignment ?? '');
  const [armorClass, setArmorClass] = useState(initial?.armor_class ?? 10);
  const [hitPoints, setHitPoints] = useState(initial?.hit_points ?? '');
  const [speed, setSpeed] = useState(initial?.speed ?? '30 ft.');
  const [str, setStr] = useState(initial?.str ?? 10);
  const [dex, setDex] = useState(initial?.dex ?? 10);
  const [con, setCon] = useState(initial?.con ?? 10);
  const [int, setInt] = useState(initial?.int ?? 10);
  const [wis, setWis] = useState(initial?.wis ?? 10);
  const [cha, setCha] = useState(initial?.cha ?? 10);
  const [savingThrows, setSavingThrows] = useState(initial?.saving_throws ?? '');
  const [skills, setSkills] = useState(initial?.skills ?? '');
  const [senses, setSenses] = useState(initial?.senses ?? '');
  const [languages, setLanguages] = useState(initial?.languages ?? '');
  const [cr, setCr] = useState(initial?.challenge_rating ?? '0');
  const [traits, setTraits] = useState(initial?.traits ?? '');
  const [actions, setActions] = useState(initial?.actions ?? '');
  const [reactions, setReactions] = useState(initial?.reactions ?? '');
  const [legendaryActions, setLegendaryActions] = useState(initial?.legendary_actions ?? '');
  const [damageResistances, setDamageResistances] = useState(initial?.damage_resistances ?? '');
  const [damageImmunities, setDamageImmunities] = useState(initial?.damage_immunities ?? '');
  const [conditionImmunities, setConditionImmunities] = useState(initial?.condition_immunities ?? '');

  function handleSubmit() {
    if (!name.trim()) return;
    onSave({
      campaign_id: campaignId, name: name.trim(), size, type, alignment,
      armor_class: armorClass, hit_points: hitPoints, speed,
      str, dex, con, int, wis, cha,
      saving_throws: savingThrows, skills,
      damage_resistances: damageResistances, damage_immunities: damageImmunities,
      condition_immunities: conditionImmunities,
      senses, languages, challenge_rating: cr,
      traits, actions, reactions, legendary_actions: legendaryActions,
    });
  }

  const fc = 'w-full bg-surface-light border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent';
  const numFc = 'w-full bg-surface-light border border-border rounded px-3 py-2 text-sm text-center font-data focus:outline-none focus:border-accent';
  const helperText = 'text-xs text-muted italic mt-0.5';

  return (
    <div className="card-parchment rounded p-4 space-y-4">
      {/* ── Identity ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className={`${fc} md:col-span-2`} autoFocus />
        <select value={size} onChange={(e) => setSize(e.target.value)} className={fc}>
          {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="text" placeholder="Type (e.g. Fiend)" value={type} onChange={(e) => setType(e.target.value)} className={fc} />
      </div>

      {/* ── Core Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <input type="text" placeholder="Alignment" value={alignment} onChange={(e) => setAlignment(e.target.value)} className={fc} />
        <div>
          <label className="block text-xs text-muted mb-1 uppercase tracking-wider">AC</label>
          <input type="number" value={armorClass} onChange={(e) => setArmorClass(parseInt(e.target.value) || 0)} className={numFc} />
        </div>
        <input type="text" placeholder="HP (e.g. 52 (8d8+16))" value={hitPoints} onChange={(e) => setHitPoints(e.target.value)} className={fc} />
        <input type="text" placeholder="Speed" value={speed} onChange={(e) => setSpeed(e.target.value)} className={fc} />
        <div>
          <label className="block text-xs text-muted mb-1 uppercase tracking-wider">CR</label>
          <input type="text" placeholder="e.g. 5, 1/2" value={cr} onChange={(e) => setCr(e.target.value)} className={fc} />
        </div>
      </div>

      {/* ── Ability Scores ── */}
      <div>
        <label className="block text-xs text-muted mb-1 uppercase tracking-wider">Ability Scores</label>
        <div className="grid grid-cols-6 gap-2">
          {[
            { label: 'STR', value: str, set: setStr },
            { label: 'DEX', value: dex, set: setDex },
            { label: 'CON', value: con, set: setCon },
            { label: 'INT', value: int, set: setInt },
            { label: 'WIS', value: wis, set: setWis },
            { label: 'CHA', value: cha, set: setCha },
          ].map((a) => (
            <div key={a.label} className="text-center">
              <span className="text-xs text-muted font-display">{a.label}</span>
              <input type="number" value={a.value} onChange={(e) => a.set(parseInt(e.target.value) || 0)} className={numFc} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Secondary Stats ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input type="text" placeholder="Saving Throws (e.g. DEX +5, CON +8)" value={savingThrows} onChange={(e) => setSavingThrows(e.target.value)} className={fc} />
        <input type="text" placeholder="Skills (e.g. Perception +5, Stealth +8)" value={skills} onChange={(e) => setSkills(e.target.value)} className={fc} />
        <input type="text" placeholder="Senses (e.g. darkvision 60 ft.)" value={senses} onChange={(e) => setSenses(e.target.value)} className={fc} />
        <input type="text" placeholder="Languages (e.g. Common, Draconic)" value={languages} onChange={(e) => setLanguages(e.target.value)} className={fc} />
        <input type="text" placeholder="Damage Resistances" value={damageResistances} onChange={(e) => setDamageResistances(e.target.value)} className={fc} />
        <input type="text" placeholder="Damage Immunities" value={damageImmunities} onChange={(e) => setDamageImmunities(e.target.value)} className={fc} />
        <input type="text" placeholder="Condition Immunities" value={conditionImmunities} onChange={(e) => setConditionImmunities(e.target.value)} className={fc} />
      </div>

      <div className="divider-ornament text-xs">◆</div>

      {/* ── Traits ── */}
      <div>
        <label className="block text-xs text-muted mb-1 uppercase tracking-wider">Traits</label>
        <textarea
          placeholder={"Keen Senses. The wolf has advantage on Wisdom (Perception) checks that rely on hearing or smell.\n\nPack Tactics. The wolf has advantage on attack rolls against a creature if at least one of the wolf's allies is within 5 ft."}
          value={traits}
          onChange={(e) => setTraits(e.target.value)}
          className={`${fc} resize-vertical`}
          rows={3}
        />
        <p className={helperText}>One per block, separated by blank lines. Start each with the name followed by a period.</p>
      </div>

      {/* ── Actions ── */}
      <div>
        <label className="block text-xs text-muted mb-1 uppercase tracking-wider">Actions</label>
        <textarea
          placeholder={"Bite. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (2d4+2) piercing damage.\n\nFire Breath (Recharge 5-6). The dragon exhales fire in a 15-foot cone. Each creature must make a DC 11 DEX save, taking 24 (7d6) fire damage on a failed save."}
          value={actions}
          onChange={(e) => setActions(e.target.value)}
          className={`${fc} resize-vertical`}
          rows={4}
        />
        <p className={helperText}>One per block, separated by blank lines. Start each with the name followed by a period.</p>
      </div>

      {/* ── Reactions ── */}
      <div>
        <label className="block text-xs text-muted mb-1 uppercase tracking-wider">Reactions</label>
        <textarea
          placeholder="Parry. The knight adds 2 to its AC against one melee attack that would hit it. To do so, the knight must see the attacker and be wielding a melee weapon."
          value={reactions}
          onChange={(e) => setReactions(e.target.value)}
          className={`${fc} resize-vertical`}
          rows={2}
        />
        <p className={helperText}>One per block, separated by blank lines. Start each with the name followed by a period.</p>
      </div>

      {/* ── Legendary Actions ── */}
      <div>
        <label className="block text-xs text-muted mb-1 uppercase tracking-wider">Legendary Actions</label>
        <textarea
          placeholder={"Detect. The dragon makes a Wisdom (Perception) check.\n\nTail Attack. The dragon makes a tail attack.\n\nWing Attack (Costs 2 Actions). The dragon beats its wings. Each creature within 10 ft. must succeed on a DC 19 DEX save or take 13 (2d6+6) bludgeoning damage."}
          value={legendaryActions}
          onChange={(e) => setLegendaryActions(e.target.value)}
          className={`${fc} resize-vertical`}
          rows={3}
        />
        <p className={helperText}>One per block, separated by blank lines. Start each with the name followed by a period.</p>
      </div>

      {/* ── Submit ── */}
      <div className="flex gap-2 pt-1">
        <button onClick={handleSubmit} className="btn-primary px-4 py-2 rounded text-sm">Save Stat Block</button>
        <button onClick={onCancel} className="btn-ghost px-4 py-2 rounded text-sm">Cancel</button>
      </div>
    </div>
  );
}
