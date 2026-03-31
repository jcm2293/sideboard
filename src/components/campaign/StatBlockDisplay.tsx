'use client';

import type { StatBlock } from '@/types';
import { parseEntries, crToXP, formatXP, abilityMod } from '@/lib/stat-block-utils';

interface StatBlockDisplayProps {
  statBlock: StatBlock;
  compact?: boolean;
}

function Rule() {
  return <hr className="stat-block-rule" />;
}

function StatLine({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <p className="text-[0.84rem] leading-snug">
      <strong className="text-stat-block-header">{label}</strong> {value}
    </p>
  );
}

function FeatureBlock({ entries, name: creatureName, isLegendary }: {
  entries: ReturnType<typeof parseEntries>;
  name?: string;
  isLegendary?: boolean;
}) {
  if (entries.length === 0) return null;
  return (
    <div className="space-y-2">
      {isLegendary && creatureName && (
        <p className="text-[0.84rem] leading-snug italic">
          The {creatureName} can take 3 legendary actions, choosing from the options below.
          Only one legendary action option can be used at a time and only at the end of
          another creature&apos;s turn. The {creatureName} regains spent legendary actions at the
          start of its turn.
        </p>
      )}
      {entries.map((entry, i) => (
        <p key={i} className="text-[0.84rem] leading-snug">
          <em className="text-stat-block-header"><strong>{entry.name}.</strong></em>{' '}
          {entry.description}
        </p>
      ))}
    </div>
  );
}

export default function StatBlockDisplay({ statBlock: sb, compact = false }: StatBlockDisplayProps) {
  const traits = parseEntries(sb.traits);
  const actions = parseEntries(sb.actions);
  const reactions = parseEntries(sb.reactions);
  const legendaryActions = parseEntries(sb.legendary_actions);

  const xp = crToXP(sb.challenge_rating);

  if (compact) {
    return (
      <div className="stat-block rounded-sm overflow-hidden text-foreground">
        <h3 className="font-display text-stat-block-header text-sm leading-tight">{sb.name}</h3>
        <p className="text-xs italic text-muted">{sb.size} {sb.type}{sb.alignment ? `, ${sb.alignment}` : ''}</p>
        <Rule />
        <div className="text-xs space-y-0.5">
          <p>
            <strong className="text-stat-block-header">AC</strong> {sb.armor_class}{' '}
            <strong className="text-stat-block-header ml-1.5">HP</strong> {sb.hit_points}{' '}
            <strong className="text-stat-block-header ml-1.5">Spd</strong> {sb.speed}
          </p>
          <div className="grid grid-cols-6 text-center text-[0.65rem] text-muted font-data py-0.5">
            {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((a) => (
              <span key={a}>{a.toUpperCase()} {sb[a]}({abilityMod(sb[a])})</span>
            ))}
          </div>
        </div>
        {actions.length > 0 && (
          <>
            <Rule />
            <div className="space-y-1">
              {actions.map((entry, i) => (
                <p key={i} className="text-xs leading-snug">
                  <em className="text-stat-block-header"><strong>{entry.name}.</strong></em>{' '}
                  {entry.description}
                </p>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="stat-block rounded-sm overflow-hidden text-foreground">
      {/* ── Header ── */}
      <h3 className="font-display text-stat-block-header text-xl leading-tight tracking-wide">{sb.name}</h3>
      <p className="text-[0.84rem] italic text-muted">{sb.size} {sb.type}{sb.alignment ? `, ${sb.alignment}` : ''}</p>

      <Rule />

      {/* ── Basic Stats ── */}
      <div className="space-y-0.5">
        <p className="text-[0.84rem] leading-snug">
          <strong className="text-stat-block-header">Armor Class</strong> {sb.armor_class}
        </p>
        {sb.hit_points && (
          <p className="text-[0.84rem] leading-snug">
            <strong className="text-stat-block-header">Hit Points</strong> {sb.hit_points}
          </p>
        )}
        <p className="text-[0.84rem] leading-snug">
          <strong className="text-stat-block-header">Speed</strong> {sb.speed}
        </p>
      </div>

      <Rule />

      {/* ── Ability Scores ── */}
      <div className="grid grid-cols-6 text-center py-1">
        {([
          { label: 'STR', val: sb.str },
          { label: 'DEX', val: sb.dex },
          { label: 'CON', val: sb.con },
          { label: 'INT', val: sb.int },
          { label: 'WIS', val: sb.wis },
          { label: 'CHA', val: sb.cha },
        ]).map((a) => (
          <div key={a.label}>
            <div className="text-stat-block-header text-[0.7rem] tracking-wide font-heading">{a.label}</div>
            <div className="text-[0.84rem] font-data">{a.val} ({abilityMod(a.val)})</div>
          </div>
        ))}
      </div>

      <Rule />

      {/* ── Secondary Stats ── */}
      <div className="space-y-0.5">
        <StatLine label="Saving Throws" value={sb.saving_throws} />
        <StatLine label="Skills" value={sb.skills} />
        <StatLine label="Damage Resistances" value={sb.damage_resistances} />
        <StatLine label="Damage Immunities" value={sb.damage_immunities} />
        <StatLine label="Condition Immunities" value={sb.condition_immunities} />
        <StatLine label="Senses" value={sb.senses} />
        <StatLine label="Languages" value={sb.languages} />
        {sb.challenge_rating && (
          <p className="text-[0.84rem] leading-snug">
            <strong className="text-stat-block-header">Challenge</strong>{' '}
            {sb.challenge_rating}
            {xp !== null && ` (${formatXP(xp)} XP)`}
          </p>
        )}
      </div>

      {/* ── Traits ── */}
      {traits.length > 0 && (
        <>
          <Rule />
          <FeatureBlock entries={traits} />
        </>
      )}

      {/* ── Actions ── */}
      {actions.length > 0 && (
        <>
          <Rule />
          <h4 className="stat-block-section-heading">Actions</h4>
          <FeatureBlock entries={actions} />
        </>
      )}

      {/* ── Reactions ── */}
      {reactions.length > 0 && (
        <>
          <Rule />
          <h4 className="stat-block-section-heading">Reactions</h4>
          <FeatureBlock entries={reactions} />
        </>
      )}

      {/* ── Legendary Actions ── */}
      {legendaryActions.length > 0 && (
        <>
          <Rule />
          <h4 className="stat-block-section-heading">Legendary Actions</h4>
          <FeatureBlock entries={legendaryActions} name={sb.name} isLegendary />
        </>
      )}
    </div>
  );
}
