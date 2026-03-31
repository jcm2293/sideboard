'use client';

import { use, useState, useMemo, useCallback, Fragment } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReferenceItem {
  name: string;
  desc: string;
}

interface TableRow {
  [key: string]: string;
}

interface ReferenceSection {
  title: string;
  type: 'list' | 'table' | 'conditions' | 'custom';
  items?: ReferenceItem[];
  tableHeaders?: string[];
  tableRows?: TableRow[];
  content?: string;
  subsections?: { title: string; items: ReferenceItem[] }[];
}

interface ReferenceGroup {
  title: string;
  sections: ReferenceSection[];
}

// ─── Reference Data ──────────────────────────────────────────────────────────

const REFERENCE_DATA: ReferenceGroup[] = [
  // ═══ GROUP 1: COMBAT ═══
  {
    title: 'Combat',
    sections: [
      {
        title: 'Actions in Combat',
        type: 'list',
        items: [
          { name: 'Attack', desc: 'Use a melee or ranged weapon attack.' },
          { name: 'Cast a Spell', desc: "Cast a cantrip or a spell of 1st level or higher. See the spell's casting time." },
          { name: 'Dash', desc: 'Gain extra movement equal to your speed (plus any modifiers) for the current turn.' },
          { name: 'Disengage', desc: "Your movement doesn't provoke opportunity attacks for the rest of the turn." },
          { name: 'Dodge', desc: "Until the start of your next turn, any attack roll made against you has disadvantage if you can see the attacker, and you make DEX saving throws with advantage. Lost if incapacitated or speed drops to 0." },
          { name: 'Help', desc: 'Give a creature advantage on the next ability check for a task. Or help with an attack within 5 feet of the target, giving the next attacker advantage.' },
          { name: 'Hide', desc: 'Make a Dexterity (Stealth) check to become hidden\u2014unseen and unheard.' },
          { name: 'Ready', desc: 'Set a trigger and use your reaction to respond. Readied spells require concentration and use a casting time of 1 action.' },
          { name: 'Search', desc: 'Make a Wisdom (Perception) check or Intelligence (Investigation) check to find something.' },
          { name: 'Use an Object or Magic Item', desc: 'Use an item that requires your action.' },
          { name: 'Use a Special Ability', desc: 'Use a class feature or other special ability that requires your action.' },
        ],
      },
      {
        title: 'Attack Types',
        type: 'list',
        items: [
          { name: 'Melee Attack', desc: 'Reach typically 5 feet.' },
          { name: 'Ranged Attacks', desc: "Disadvantage when target is beyond normal range. Can't attack beyond long range. Disadvantage if within 5 feet of a hostile creature who can see you." },
          { name: 'Opportunity Attack', desc: 'Provoked when a creature moves out of your reach without disengaging. Uses your reaction.' },
          { name: 'Two-Weapon Fighting', desc: "Attack action with a light melee weapon lets you use a bonus action to attack with a different light weapon in the other hand. Don't add ability modifier to the bonus attack damage unless negative." },
          { name: 'Grappling', desc: "Uses 1 attack of the attack action. Target can't be more than one size larger. Must have a free hand. Your Strength (Athletics) vs. target's Strength (Athletics) or Dexterity (Acrobatics). Move grappled creature at half speed. Escape: target's Athletics or Acrobatics vs. your Athletics." },
          { name: 'Shoving', desc: "Uses 1 attack of the attack action. Target can't be more than one size larger. Your Strength (Athletics) vs. target's Strength (Athletics) or Dexterity (Acrobatics). On success, knock prone or push 5 feet." },
        ],
      },
      {
        title: 'Cover',
        type: 'list',
        items: [
          { name: 'Half cover', desc: '+2 AC and DEX saves.' },
          { name: 'Three-quarters cover', desc: '+5 AC and DEX saves.' },
          { name: 'Total cover', desc: "Can't be targeted directly by attacks or spells." },
        ],
      },
      {
        title: 'Damage Types',
        type: 'list',
        items: [
          { name: 'Acid', desc: 'Corrosive liquid or vapors that dissolve flesh and materials.' },
          { name: 'Bludgeoning', desc: 'Blunt force from hammers, falling, or constriction.' },
          { name: 'Cold', desc: 'Freezing temperatures, ice, and frigid blasts.' },
          { name: 'Fire', desc: 'Flames, extreme heat, and searing burns.' },
          { name: 'Force', desc: 'Pure magical energy focused into a damaging form.' },
          { name: 'Lightning', desc: 'Electrical bolts and arcs of high-voltage energy.' },
          { name: 'Necrotic', desc: 'Dark energy that withers matter and drains life force.' },
          { name: 'Piercing', desc: 'Puncturing and impaling from spears, arrows, or bites.' },
          { name: 'Poison', desc: 'Venomous stings, toxic gases, and noxious substances.' },
          { name: 'Psychic', desc: 'Mental attacks that assault the mind directly.' },
          { name: 'Radiant', desc: 'Holy light and searing luminous energy.' },
          { name: 'Slashing', desc: 'Cutting blades, claws, and edged weapons.' },
          { name: 'Thunder', desc: 'Concussive bursts of sound and shockwaves.' },
        ],
      },
    ],
  },

  // ═══ GROUP 2: SPELLCASTING RULES ═══
  {
    title: 'Spellcasting Rules',
    sections: [
      {
        title: 'Casting Rules',
        type: 'list',
        items: [
          { name: 'Spell Slots', desc: 'Casting a spell of 1st level or higher expends a spell slot of that level or higher. You regain all slots on a long rest (some classes differ).' },
          { name: 'Cantrips', desc: 'Cantrips can be cast at will without expending a spell slot.' },
          { name: 'Casting Time', desc: 'Most spells require 1 action. Some require a bonus action, reaction, or longer (minutes/hours).' },
          { name: 'Range', desc: 'Each spell has a range: self, touch, or a specific distance in feet.' },
          { name: 'Targets', desc: 'A spell specifies what it can target: creatures, objects, or a point of origin for an area of effect.' },
          { name: 'Areas of Effect', desc: 'Cone, cube, cylinder, line, or sphere. Each has specific rules for size and origin.' },
          { name: 'Saving Throws', desc: 'Some spells require the target to make a saving throw. The DC = 8 + proficiency bonus + spellcasting ability modifier.' },
          { name: 'Attack Rolls', desc: 'Some spells require an attack roll. Modifier = proficiency bonus + spellcasting ability modifier.' },
          { name: 'Combining Effects', desc: "The effects of different spells add together. The same spell cast multiple times doesn't combine\u2014only the most potent applies." },
          { name: 'Casting in Armor', desc: "You must be proficient with the armor you're wearing to cast spells. Otherwise you are unable to cast." },
        ],
      },
      {
        title: 'Components',
        type: 'list',
        items: [
          { name: 'Verbal (V)', desc: 'Chanting of mystic words. Must be able to speak.' },
          { name: 'Somatic (S)', desc: 'Specific hand gestures. Must have at least one free hand.' },
          { name: 'Material (M)', desc: 'Particular materials specified in the spell. A component pouch or spellcasting focus can replace non-consumed, non-costed components.' },
        ],
      },
      {
        title: 'Duration & Concentration',
        type: 'list',
        items: [
          { name: 'Instantaneous', desc: 'The spell effect happens and ends immediately. The magic is not sustained.' },
          { name: 'Concentration', desc: 'The spell lasts for its duration while you concentrate. Broken by: casting another concentration spell, taking damage (CON save DC = 10 or half damage taken, whichever is higher), being incapacitated or killed, or DM-determined environmental interference.' },
          { name: 'Duration', desc: 'Some spells last a set time (1 minute, 1 hour, 8 hours, etc.) without concentration.' },
          { name: 'Ritual Casting', desc: 'Spells with the ritual tag can be cast as a ritual, taking 10 extra minutes but not expending a spell slot. The caster must have the feature that permits ritual casting.' },
        ],
      },
    ],
  },

  // ═══ GROUP 3: HEALTH & REST ═══
  {
    title: 'Health & Rest',
    sections: [
      {
        title: 'Resting',
        type: 'list',
        items: [
          { name: 'Short Rest', desc: 'At least 1 hour of downtime. Can spend Hit Dice to regain HP (roll the die + CON modifier per die). No other strenuous activity.' },
          { name: 'Long Rest', desc: 'At least 8 hours, including 6 hours of sleep and up to 2 hours of light activity. Regain all HP and spend Hit Dice equal to half your total (minimum 1). Can only benefit from one long rest per 24 hours. Must have at least 1 HP to start.' },
        ],
      },
      {
        title: 'Dropping to 0 HP & Death',
        type: 'list',
        items: [
          { name: 'Falling Unconscious', desc: 'If damage reduces you to 0 HP, you fall unconscious and are subject to death saving throws.' },
          { name: 'Death Saving Throws', desc: 'At the start of each turn at 0 HP, roll a d20. 10 or higher = success. Below 10 = failure. Three successes = stabilized. Three failures = death. Successes and failures reset when you regain HP.' },
          { name: 'Rolling a 1', desc: 'Counts as two death save failures.' },
          { name: 'Rolling a 20', desc: 'You regain 1 HP and become conscious.' },
          { name: 'Damage at 0 HP', desc: 'Taking damage while at 0 HP causes a death save failure. A critical hit causes two failures. If damage equals or exceeds your HP maximum, instant death.' },
          { name: 'Instant Death', desc: 'If damage reduces you to 0 HP and the remaining damage equals or exceeds your HP maximum, you die instantly.' },
          { name: 'Stabilizing', desc: 'A stable creature at 0 HP is unconscious but no longer makes death saves. Regains 1 HP after 1d4 hours. Taking damage destabilizes. A DC 10 Wisdom (Medicine) check or any healing stabilizes.' },
        ],
      },
    ],
  },

  // ═══ GROUP 4: MOVEMENT & ENVIRONMENT ═══
  {
    title: 'Movement & Environment',
    sections: [
      {
        title: 'Movement',
        type: 'list',
        items: [
          { name: 'Difficult Terrain', desc: 'Every foot of movement in difficult terrain costs 1 extra foot. Applies to crawling and climbing in difficult terrain as well.' },
          { name: 'Climbing & Swimming', desc: 'Each foot of climbing or swimming costs 1 extra foot of movement (2 extra in difficult terrain) unless the creature has a climbing or swimming speed.' },
          { name: 'Long Jump', desc: 'Cover a distance up to your Strength score in feet (with 10-foot running start) or half that from standing. Each foot cleared costs 1 foot of movement.' },
          { name: 'High Jump', desc: 'Jump 3 + STR modifier feet (with 10-foot running start) or half that from standing. Each foot cleared costs 1 foot of movement.' },
          { name: 'Falling', desc: 'Take 1d6 bludgeoning damage per 10 feet fallen, to a maximum of 20d6. Land prone.' },
          { name: 'Crawling', desc: 'Every foot of crawling costs 1 extra foot of movement.' },
        ],
      },
      {
        title: 'Travel Pace',
        type: 'table',
        tableHeaders: ['Pace', 'Per Minute', 'Per Hour', 'Per Day', 'Effect'],
        tableRows: [
          { Pace: 'Fast', 'Per Minute': '400 ft.', 'Per Hour': '4 miles', 'Per Day': '30 miles', Effect: '\u22125 penalty to passive Perception' },
          { Pace: 'Normal', 'Per Minute': '300 ft.', 'Per Hour': '3 miles', 'Per Day': '24 miles', Effect: '\u2014' },
          { Pace: 'Slow', 'Per Minute': '200 ft.', 'Per Hour': '2 miles', 'Per Day': '18 miles', Effect: 'Able to use Stealth' },
        ],
      },
      {
        title: 'Light & Vision',
        type: 'list',
        items: [
          { name: 'Bright Light', desc: 'Most creatures see normally. Even gloomy days provide bright light, as do torches, lanterns, fires, and other sources within a specific radius.' },
          { name: 'Dim Light', desc: 'Creates a lightly obscured area. Creatures have disadvantage on Wisdom (Perception) checks relying on sight. Includes boundaries of light sources, twilight, and a full moon.' },
          { name: 'Darkness', desc: 'Creates a heavily obscured area. Equivalent to the Blinded condition. Outdoors at night (even moonlit), or within unlit dungeons and underground.' },
          { name: 'Darkvision', desc: 'Can see in dim light within range as if it were bright light, and in darkness as if dim light (colors appear as shades of gray).' },
          { name: 'Blindsight', desc: 'Perceive surroundings without relying on sight, within a specific radius.' },
          { name: 'Truesight', desc: 'See in normal and magical darkness, see invisible creatures, detect visual illusions, perceive shapechangers\u2019 true form, and see into the Ethereal Plane, all within range.' },
          { name: 'Tremorsense', desc: 'Detect and pinpoint the origin of vibrations within a specific radius while in contact with the same ground or substance.' },
        ],
      },
      {
        title: 'Suffocating',
        type: 'list',
        items: [
          { name: 'Holding Breath', desc: 'A creature can hold its breath for 1 + CON modifier minutes (minimum 30 seconds).' },
          { name: 'Running Out of Air', desc: 'When a creature runs out of breath or is choking, it can survive for a number of rounds equal to its CON modifier (minimum 1 round). At the start of its next turn after that, it drops to 0 HP and is dying.' },
        ],
      },
      {
        title: 'Carrying Capacity',
        type: 'list',
        items: [
          { name: 'Carry', desc: 'Your carrying capacity is your Strength score \u00d7 15 lbs.' },
          { name: 'Push, Drag, Lift', desc: 'Up to twice your carrying capacity (Strength \u00d7 30 lbs). While exceeding carry capacity, speed drops to 5 feet.' },
          { name: 'Size Modifiers', desc: 'Tiny creatures halve these weights. Large creatures double them. Huge creatures quadruple. Gargantuan \u00d78.' },
          { name: 'Encumbrance (Variant)', desc: 'Carrying weight over STR \u00d7 5 lbs: speed drops by 10 feet. Over STR \u00d7 10 lbs: speed drops by 20 feet and disadvantage on ability checks, attack rolls, and STR/DEX/CON saving throws.' },
        ],
      },
    ],
  },

  // ═══ GROUP 5: CONDITIONS ═══
  {
    title: 'Conditions',
    sections: [
      {
        title: 'Conditions',
        type: 'conditions',
        items: [
          { name: 'Blinded', desc: "Can't see. Automatically fails any ability check that requires sight. Attack rolls against have advantage, own attack rolls have disadvantage." },
          { name: 'Charmed', desc: "Can't attack the charmer or target them with harmful abilities or magical effects. The charmer has advantage on social ability checks against the creature." },
          { name: 'Deafened', desc: "Can't hear. Automatically fails any ability check that requires hearing." },
          { name: 'Frightened', desc: 'Has disadvantage on ability checks and attack rolls while the source of fear is within line of sight. Cannot willingly move closer to the source of fear.' },
          { name: 'Grappled', desc: 'Speed becomes 0 and no benefit from any bonus to speed. Ends if grappler is incapacitated or if an effect moves the creature outside the grappler\u2019s reach.' },
          { name: 'Incapacitated', desc: "Can't take actions or reactions." },
          { name: 'Invisible', desc: "Impossible to see without magic or special senses. Heavily obscured for hiding. Can still be detected by noise/tracks. Attack rolls against have disadvantage, creature's attack rolls have advantage." },
          { name: 'Paralyzed', desc: "Incapacitated. Can't move or speak. Automatically fails STR and DEX saving throws. Attacks against have advantage. Melee attacks that hit are critical hits." },
          { name: 'Petrified', desc: "Transformed to inanimate substance. Weight increases \u00d710. Incapacitated, can't move or speak, unaware of surroundings. Attacks against have advantage. Auto-fail STR and DEX saves. Resistance to all damage. Immune to poison and disease (existing ones suspended)." },
          { name: 'Poisoned', desc: 'Disadvantage on attack rolls and ability checks.' },
          { name: 'Prone', desc: "Only movement option is to crawl. Disadvantage on attack rolls. Attack against has advantage if within 5 feet, otherwise disadvantage. Standing up costs half your movement." },
          { name: 'Restrained', desc: "Speed becomes 0. Attack rolls against have advantage, creature's attack rolls have disadvantage. Disadvantage on DEX saving throws." },
          { name: 'Stunned', desc: "Incapacitated. Can't move. Can speak only falteringly. Automatically fails STR and DEX saves. Attacks against have advantage." },
          { name: 'Unconscious', desc: "Incapacitated. Can't move or speak. Unaware of surroundings. Drops what it's holding, falls prone. Auto-fails STR and DEX saves. Attacks against have advantage. Melee hits within 5 feet are critical hits." },
        ],
      },
      {
        title: 'Exhaustion',
        type: 'table',
        tableHeaders: ['Level', 'Effect'],
        tableRows: [
          { Level: '1', Effect: 'Disadvantage on ability checks' },
          { Level: '2', Effect: 'Speed halved' },
          { Level: '3', Effect: 'Disadvantage on attack rolls and saving throws' },
          { Level: '4', Effect: 'HP maximum halved' },
          { Level: '5', Effect: 'Speed reduced to 0' },
          { Level: '6', Effect: 'Death' },
        ],
      },
    ],
  },

  // ═══ GROUP 6: REFERENCE TABLES ═══
  {
    title: 'Reference Tables',
    sections: [
      {
        title: 'Difficulty Classes',
        type: 'table',
        tableHeaders: ['Task Difficulty', 'DC'],
        tableRows: [
          { 'Task Difficulty': 'Very easy', DC: '5' },
          { 'Task Difficulty': 'Easy', DC: '10' },
          { 'Task Difficulty': 'Medium', DC: '15' },
          { 'Task Difficulty': 'Hard', DC: '20' },
          { 'Task Difficulty': 'Very hard', DC: '25' },
          { 'Task Difficulty': 'Nearly impossible', DC: '30' },
        ],
      },
      {
        title: 'Skills by Ability Score',
        type: 'list',
        items: [
          { name: 'Strength', desc: 'Athletics' },
          { name: 'Dexterity', desc: 'Acrobatics, Sleight of Hand, Stealth' },
          { name: 'Constitution', desc: '(No skills)' },
          { name: 'Intelligence', desc: 'Arcana, History, Investigation, Nature, Religion' },
          { name: 'Wisdom', desc: 'Animal Handling, Insight, Medicine, Perception, Survival' },
          { name: 'Charisma', desc: 'Deception, Intimidation, Performance, Persuasion' },
        ],
      },
      {
        title: 'Encounter Difficulty',
        type: 'custom',
        content: 'encounter-difficulty',
      },
      {
        title: 'Damage Severity by Level',
        type: 'table',
        tableHeaders: ['Character Level', 'Setback', 'Dangerous', 'Deadly'],
        tableRows: [
          { 'Character Level': '1\u20134', Setback: '1d10', Dangerous: '2d10', Deadly: '4d10' },
          { 'Character Level': '5\u201310', Setback: '2d10', Dangerous: '4d10', Deadly: '10d10' },
          { 'Character Level': '11\u201316', Setback: '4d10', Dangerous: '10d10', Deadly: '18d10' },
          { 'Character Level': '17\u201320', Setback: '10d10', Dangerous: '18d10', Deadly: '24d10' },
        ],
      },
      {
        title: 'Object AC',
        type: 'table',
        tableHeaders: ['Substance', 'AC'],
        tableRows: [
          { Substance: 'Cloth, paper, rope', AC: '11' },
          { Substance: 'Crystal, glass, ice', AC: '13' },
          { Substance: 'Wood, bone', AC: '15' },
          { Substance: 'Stone', AC: '17' },
          { Substance: 'Iron, steel', AC: '19' },
          { Substance: 'Mithral', AC: '21' },
          { Substance: 'Adamantine', AC: '23' },
        ],
      },
      {
        title: 'Costs & Services',
        type: 'custom',
        content: 'costs-services',
      },
    ],
  },
];

// ─── Encounter Difficulty XP Table ───────────────────────────────────────────

const ENCOUNTER_XP: { level: number; easy: number; medium: number; hard: number; deadly: number }[] = [
  { level: 1, easy: 25, medium: 50, hard: 75, deadly: 100 },
  { level: 2, easy: 50, medium: 100, hard: 150, deadly: 200 },
  { level: 3, easy: 75, medium: 150, hard: 225, deadly: 400 },
  { level: 4, easy: 125, medium: 250, hard: 375, deadly: 500 },
  { level: 5, easy: 250, medium: 500, hard: 750, deadly: 1100 },
  { level: 6, easy: 300, medium: 600, hard: 900, deadly: 1400 },
  { level: 7, easy: 350, medium: 750, hard: 1100, deadly: 1700 },
  { level: 8, easy: 450, medium: 900, hard: 1400, deadly: 2100 },
  { level: 9, easy: 550, medium: 1100, hard: 1600, deadly: 2400 },
  { level: 10, easy: 600, medium: 1200, hard: 1900, deadly: 2800 },
  { level: 11, easy: 800, medium: 1600, hard: 2400, deadly: 3600 },
  { level: 12, easy: 1000, medium: 2000, hard: 3000, deadly: 4500 },
  { level: 13, easy: 1100, medium: 2200, hard: 3400, deadly: 5100 },
  { level: 14, easy: 1250, medium: 2500, hard: 3800, deadly: 5700 },
  { level: 15, easy: 1400, medium: 2800, hard: 4300, deadly: 6400 },
  { level: 16, easy: 1600, medium: 3200, hard: 4800, deadly: 7200 },
  { level: 17, easy: 2000, medium: 3900, hard: 5900, deadly: 8800 },
  { level: 18, easy: 2100, medium: 4200, hard: 6300, deadly: 9500 },
  { level: 19, easy: 2400, medium: 4900, hard: 7300, deadly: 10900 },
  { level: 20, easy: 2800, medium: 5700, hard: 8500, deadly: 12700 },
];

const ENCOUNTER_MULTIPLIERS: { monsters: string; multiplier: string }[] = [
  { monsters: '1', multiplier: '\u00d71' },
  { monsters: '2', multiplier: '\u00d71.5' },
  { monsters: '3\u20136', multiplier: '\u00d72' },
  { monsters: '7\u201310', multiplier: '\u00d72.5' },
  { monsters: '11\u201314', multiplier: '\u00d73' },
  { monsters: '15+', multiplier: '\u00d74' },
];

// ─── Costs & Services Data ───────────────────────────────────────────────────

const FOOD_DRINK = [
  { item: 'Ale (gallon)', cost: '2 sp' },
  { item: 'Ale (mug)', cost: '4 cp' },
  { item: 'Banquet (per person)', cost: '10 gp' },
  { item: 'Bread, loaf', cost: '2 cp' },
  { item: 'Cheese, hunk', cost: '1 sp' },
  { item: 'Meat, chunk', cost: '3 sp' },
  { item: 'Wine, common (pitcher)', cost: '2 sp' },
  { item: 'Wine, fine (bottle)', cost: '10 gp' },
];

const LODGING = [
  { quality: 'Squalid', cost: '7 cp / night' },
  { quality: 'Poor', cost: '1 sp / night' },
  { quality: 'Modest', cost: '5 sp / night' },
  { quality: 'Comfortable', cost: '8 sp / night' },
  { quality: 'Wealthy', cost: '2 gp / night' },
  { quality: 'Aristocratic', cost: '4 gp / night' },
];

const SERVICES = [
  { service: 'Coach cab (between towns)', cost: '3 cp / mile' },
  { service: 'Coach cab (within a city)', cost: '1 cp' },
  { service: 'Hireling, skilled', cost: '2 gp / day' },
  { service: 'Hireling, untrained', cost: '2 sp / day' },
  { service: 'Messenger', cost: '2 cp / mile' },
  { service: 'Road/gate toll', cost: '1 cp' },
  { service: 'Ship\u2019s passage', cost: '1 sp / mile' },
];

const LIFESTYLE = [
  { lifestyle: 'Wretched', cost: '\u2014' },
  { lifestyle: 'Squalid', cost: '1 sp / day' },
  { lifestyle: 'Poor', cost: '2 sp / day' },
  { lifestyle: 'Modest', cost: '1 gp / day' },
  { lifestyle: 'Comfortable', cost: '2 gp / day' },
  { lifestyle: 'Wealthy', cost: '4 gp / day' },
  { lifestyle: 'Aristocratic', cost: '10 gp+ / day' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAllText(group: ReferenceGroup): string {
  const parts = [group.title];
  for (const section of group.sections) {
    parts.push(section.title);
    if (section.items) {
      for (const item of section.items) {
        parts.push(item.name, item.desc);
      }
    }
    if (section.tableRows) {
      for (const row of section.tableRows) {
        parts.push(...Object.values(row));
      }
    }
    if (section.subsections) {
      for (const sub of section.subsections) {
        parts.push(sub.title);
        for (const item of sub.items) {
          parts.push(item.name, item.desc);
        }
      }
    }
  }
  return parts.join(' ').toLowerCase();
}

function getSectionText(section: ReferenceSection): string {
  const parts = [section.title];
  if (section.items) {
    for (const item of section.items) {
      parts.push(item.name, item.desc);
    }
  }
  if (section.tableRows) {
    for (const row of section.tableRows) {
      parts.push(...Object.values(row));
    }
  }
  return parts.join(' ').toLowerCase();
}

function highlightText(text: string, search: string): React.ReactNode {
  if (!search) return text;
  const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-gold/40 text-foreground font-bold rounded px-0.5">
        {part}
      </mark>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

// ─── Components ──────────────────────────────────────────────────────────────

function ReferenceListSection({
  items,
  search,
}: {
  items: ReferenceItem[];
  search: string;
}) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.name} className="text-sm leading-relaxed">
          <span className="font-bold text-accent">{highlightText(item.name, search)}.</span>{' '}
          <span className="text-foreground/85">{highlightText(item.desc, search)}</span>
        </li>
      ))}
    </ul>
  );
}

function ReferenceTableSection({
  headers,
  rows,
  search,
}: {
  headers: string[];
  rows: TableRow[];
  search: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border">
            {headers.map((h) => (
              <th
                key={h}
                className="text-left font-display text-accent py-2 px-3 text-xs uppercase tracking-wide"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="even:bg-amber-900/5 border-b border-border/40">
              {headers.map((h) => (
                <td key={h} className="py-1.5 px-3">
                  {highlightText(row[h] ?? '', search)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConditionsSection({
  items,
  search,
}: {
  items: ReferenceItem[];
  search: string;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {items.map((item) => (
        <div key={item.name} className="card-parchment rounded p-3">
          <h4 className="font-display text-accent text-sm mb-1">
            {highlightText(item.name, search)}
          </h4>
          <p className="text-xs text-foreground/80 leading-relaxed">
            {highlightText(item.desc, search)}
          </p>
        </div>
      ))}
    </div>
  );
}

function EncounterDifficultySection({ search }: { search: string }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted italic">
        XP thresholds per character. Multiply total party XP budget by encounter multiplier.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left font-display text-accent py-2 px-2 text-xs uppercase tracking-wide">Lvl</th>
              <th className="text-left font-display text-accent py-2 px-2 text-xs uppercase tracking-wide">Easy</th>
              <th className="text-left font-display text-accent py-2 px-2 text-xs uppercase tracking-wide">Medium</th>
              <th className="text-left font-display text-accent py-2 px-2 text-xs uppercase tracking-wide">Hard</th>
              <th className="text-left font-display text-accent py-2 px-2 text-xs uppercase tracking-wide">Deadly</th>
            </tr>
          </thead>
          <tbody>
            {ENCOUNTER_XP.map((row) => (
              <tr key={row.level} className="even:bg-amber-900/5 border-b border-border/40">
                <td className="py-1 px-2 font-bold text-accent">{highlightText(String(row.level), search)}</td>
                <td className="py-1 px-2">{highlightText(String(row.easy), search)}</td>
                <td className="py-1 px-2">{highlightText(String(row.medium), search)}</td>
                <td className="py-1 px-2">{highlightText(String(row.hard), search)}</td>
                <td className="py-1 px-2">{highlightText(String(row.deadly), search)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4 className="font-display text-accent text-sm mt-4">Encounter Multipliers</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left font-display text-accent py-2 px-3 text-xs uppercase tracking-wide"># Monsters</th>
              <th className="text-left font-display text-accent py-2 px-3 text-xs uppercase tracking-wide">Multiplier</th>
            </tr>
          </thead>
          <tbody>
            {ENCOUNTER_MULTIPLIERS.map((row) => (
              <tr key={row.monsters} className="even:bg-amber-900/5 border-b border-border/40">
                <td className="py-1.5 px-3">{highlightText(row.monsters, search)}</td>
                <td className="py-1.5 px-3">{highlightText(row.multiplier, search)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CostsServicesSection({ search }: { search: string }) {
  return (
    <div className="space-y-5">
      <div>
        <h4 className="font-display text-accent text-sm mb-2">Food & Drink</h4>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left font-display text-accent py-1.5 px-3 text-xs uppercase tracking-wide">Item</th>
              <th className="text-left font-display text-accent py-1.5 px-3 text-xs uppercase tracking-wide">Cost</th>
            </tr>
          </thead>
          <tbody>
            {FOOD_DRINK.map((r) => (
              <tr key={r.item} className="even:bg-amber-900/5 border-b border-border/40">
                <td className="py-1 px-3">{highlightText(r.item, search)}</td>
                <td className="py-1 px-3">{highlightText(r.cost, search)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h4 className="font-display text-accent text-sm mb-2">Lodging</h4>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left font-display text-accent py-1.5 px-3 text-xs uppercase tracking-wide">Quality</th>
              <th className="text-left font-display text-accent py-1.5 px-3 text-xs uppercase tracking-wide">Cost</th>
            </tr>
          </thead>
          <tbody>
            {LODGING.map((r) => (
              <tr key={r.quality} className="even:bg-amber-900/5 border-b border-border/40">
                <td className="py-1 px-3">{highlightText(r.quality, search)}</td>
                <td className="py-1 px-3">{highlightText(r.cost, search)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h4 className="font-display text-accent text-sm mb-2">Services</h4>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left font-display text-accent py-1.5 px-3 text-xs uppercase tracking-wide">Service</th>
              <th className="text-left font-display text-accent py-1.5 px-3 text-xs uppercase tracking-wide">Cost</th>
            </tr>
          </thead>
          <tbody>
            {SERVICES.map((r) => (
              <tr key={r.service} className="even:bg-amber-900/5 border-b border-border/40">
                <td className="py-1 px-3">{highlightText(r.service, search)}</td>
                <td className="py-1 px-3">{highlightText(r.cost, search)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h4 className="font-display text-accent text-sm mb-2">Lifestyle Expenses</h4>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left font-display text-accent py-1.5 px-3 text-xs uppercase tracking-wide">Lifestyle</th>
              <th className="text-left font-display text-accent py-1.5 px-3 text-xs uppercase tracking-wide">Cost</th>
            </tr>
          </thead>
          <tbody>
            {LIFESTYLE.map((r) => (
              <tr key={r.lifestyle} className="even:bg-amber-900/5 border-b border-border/40">
                <td className="py-1 px-3">{highlightText(r.lifestyle, search)}</td>
                <td className="py-1 px-3">{highlightText(r.cost, search)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RefSection({
  section,
  expanded,
  onToggle,
  search,
}: {
  section: ReferenceSection;
  expanded: boolean;
  onToggle: () => void;
  search: string;
}) {
  return (
    <div className="card-parchment rounded p-4">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left group"
      >
        <h3 className="font-display text-accent text-base">
          {highlightText(section.title, search)}
        </h3>
        <span className="text-muted group-hover:text-accent transition-colors text-sm ml-2 shrink-0">
          {expanded ? '\u25B2' : '\u25BC'}
        </span>
      </button>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-border/40">
          {section.type === 'list' && section.items && (
            <ReferenceListSection items={section.items} search={search} />
          )}
          {section.type === 'table' && section.tableHeaders && section.tableRows && (
            <ReferenceTableSection
              headers={section.tableHeaders}
              rows={section.tableRows}
              search={search}
            />
          )}
          {section.type === 'conditions' && section.items && (
            <ConditionsSection items={section.items} search={search} />
          )}
          {section.type === 'custom' && section.content === 'encounter-difficulty' && (
            <EncounterDifficultySection search={search} />
          )}
          {section.type === 'custom' && section.content === 'costs-services' && (
            <CostsServicesSection search={search} />
          )}
        </div>
      )}
    </div>
  );
}

function RefGroup({
  group,
  expandedSections,
  onToggleSection,
  search,
}: {
  group: ReferenceGroup;
  expandedSections: Record<string, boolean>;
  onToggleSection: (key: string) => void;
  search: string;
}) {
  return (
    <div>
      <h2 className="font-display text-accent text-xl mb-4 uppercase tracking-wider">
        {highlightText(group.title, search)}
      </h2>
      <div className="space-y-3">
        {group.sections.map((section) => {
          const key = `${group.title}::${section.title}`;
          const isVisible =
            !search ||
            getSectionText(section).includes(search.toLowerCase());
          if (search && !isVisible) return null;
          return (
            <RefSection
              key={key}
              section={section}
              expanded={expandedSections[key] ?? false}
              onToggle={() => onToggleSection(key)}
              search={search}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function QuickReferencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  void id; // available for future navigation links

  const [search, setSearch] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const group of REFERENCE_DATA) {
      for (const section of group.sections) {
        initial[`${group.title}::${section.title}`] = true;
      }
    }
    return initial;
  });

  // When search changes, auto-expand matching sections, collapse non-matching
  const effectiveExpanded = useMemo(() => {
    if (!search) return expandedSections;
    const result: Record<string, boolean> = {};
    for (const group of REFERENCE_DATA) {
      for (const section of group.sections) {
        const key = `${group.title}::${section.title}`;
        const matches = getSectionText(section).includes(search.toLowerCase());
        result[key] = matches;
      }
    }
    return result;
  }, [search, expandedSections]);

  const toggleSection = useCallback((key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const clearSearch = useCallback(() => {
    setSearch('');
  }, []);

  const visibleGroups = useMemo(() => {
    if (!search) return REFERENCE_DATA;
    return REFERENCE_DATA.filter((group) =>
      getAllText(group).includes(search.toLowerCase())
    );
  }, [search]);

  return (
    <div className="max-w-4xl mx-auto pb-16">
      {/* Sticky Search Bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pb-4 pt-2 -mx-1 px-1">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rules, conditions, tables..."
            className="w-full bg-surface-light border border-border rounded-lg px-4 py-2.5 pr-10 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 placeholder:text-muted/60"
          />
          {search && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-accent transition-colors text-lg leading-none"
              title="Clear search"
            >
              \u00d7
            </button>
          )}
        </div>
        {search && (
          <p className="text-xs text-muted mt-1.5 ml-1">
            {visibleGroups.length === 0
              ? 'No results found.'
              : `Showing matches across ${visibleGroups.length} group${visibleGroups.length !== 1 ? 's' : ''}.`}
          </p>
        )}
      </div>

      {/* Content */}
      <div className="space-y-2">
        {visibleGroups.map((group, i) => (
          <Fragment key={group.title}>
            {i > 0 && (
              <div className="divider-ornament text-sm my-6">{'\u25C6'}</div>
            )}
            <RefGroup
              group={group}
              expandedSections={effectiveExpanded}
              onToggleSection={toggleSection}
              search={search}
            />
          </Fragment>
        ))}
      </div>
    </div>
  );
}
