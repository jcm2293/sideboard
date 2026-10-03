# Character sheet export v3: spec and implementation prompt

This is the prompt for the implementation session. It supersedes the "PDF Export" section of `sideboard-spec-v2.md` and builds on the findings in `docs/character-sheet-review-2026-10-02.md`. Six D&D Beyond exports are in `PCsheets/fixtures/` and are the acceptance tests (section 8).

## 0. Principles

- The sheet is a reference card organised by what the player is doing when they look at it: the DM asks for a roll (left rail), it is my turn (right column), something happened to me (vitals strip), I need the rules text (later pages).
- The parser is lossless and structured. It never summarises. The renderer decides what to show and how much.
- The Beyond export supplies the character's *selections* (which subclass, which spells, which masteries, computed modifiers). A class reference table supplies the *rules* (uses per level, dice, recovery, canonical text) because the export omits or truncates them inconsistently per class. Where both have a number, the export wins.
- Drop anything already expressed elsewhere on the sheet (ASI entries, "Speed" as a feature, page references) and anything with no play value (Creature Type, Size, Standard Actions list).
- One layout, every class. Blocks appear or collapse based on data; nothing is class-specific in the renderer except the reference table lookups.

## 1. What the six fixtures showed

| Character | Classes | Caster shape | Slot headers in PDF | Resource shapes seen | Export quirks |
|---|---|---|---|---|---|
| Dash | Warlock 5 (Fiend) | Pact | `2 Pact OO` on 3rd only | Pact slots, Magical Cunning 1/LR, Vampiric Bite 3/LR, Fey Touched free casts | Invocations as `\|` children; Misty Step twice; 8 homebrew spells not in SRD; page-1 Actions truncated |
| Lucien | Bard 5 (Glamour) | Full, known | `4 Slots OOOO` / `3` / `2` | Bardic Inspiration `4 / Short Rest` with die in text (1d6→d8), Beguiling Magic 1/LR + `Regain Use: No Action`, Lucky `Luck Points: 3 / Long Rest`, Resourceful (Heroic Inspiration) | Finger Guns (homebrew cantrip) appears as a weapon *and* a spell; Charm Person twice (known + always prepared); Jack of All Trades shows as `half` proficiency; no equipment |
| Grandpa Dan | Monk 5 (Sun Soul) | None | none | `Focus Points: 5 / Short Rest`, Uncanny Metabolism 1/LR, Deflect Attacks reaction, Lucky | Unarmed Strike listed twice plus Flurry of Blows as weapons; Martial Arts die only in body text (`roll 1d8`); Grapple/Shove DC uses Dex |
| Amber Slam | Paladin 5 (Castigation) | Half, prepared | 1st and 2nd only, no cantrips | `Lay On Hands: Healing Pool: 25 / Long Rest` (a pool, not uses), Channel Divinity `2 / Long Rest`, Divine Smite free 1/LR | Divine Smite twice, Find Steed twice; Weapon Mastery heading appears twice (generic + selections); two fighting-style feats |
| samplemulti | Wizard 5 / Rogue 3 (Evoker, Thief) | Full (wizard only), prepared | 1st and 2nd only | Arcane Recovery 1/LR, Sneak Attack `Special` with die only in text (`extra 2d6`), Cunning Action, Fast Hands ×3 | Two `=== X FEATURES ===` sections; class line `Wizard 5 / Rogue 3`; HD `5d6 + 3d8`; 3rd-level slot header absent because no 3rd-level spell is prepared; species spells (Elven Lineage) duplicated free/slot; Immunities - Magical Sleep; 21 items with duplicates |
| Zhela | Barbarian 5 (Storm Herald) | None | none | **Rage has no text, no uses, and no Actions entry** | Weapon Mastery heading appears three times; 28 inventory lines with Handaxe ×4, Bedroll ×3, Rations ×3; `Defenses` is the literal string `None`; Enhanced Unarmed Strike as a weapon |

Two conclusions drive the rest of this document. First, slot counts and class resources cannot come from the PDF: Beyond prints a slot header only for levels that have a spell listed, and omits some core features entirely. Second, the `|` child-line grammar is rich and consistent across all six exports, so parsing it properly recovers most of what the current sheet loses.

## 2. Data model

Add to `src/types/index.ts`. Keep existing fields for compatibility; the renderer prefers the new ones when present.

```ts
export interface ClassLevel { class_name: string; level: number; subclass: string }

export interface FeatureEntry {
  name: string;
  summary: string;              // the one-line clause shown in "Your turn" and feature headings. Seeded by the parser (first sentence, cut at a clause boundary, max ~90 chars, never mid-word or with a trailing ellipsis), overridden by the class reference table's `short` text for known features, editable by the DM on the edit page.
  full_text?: string;           // complete description, paragraphs joined with \n\n
  kind?: 'mechanical' | 'passive' | 'ribbon' | 'container';
  group?: string;               // "Warlock", "Rogue", "Dhampir", "Feats"
  parent?: string;              // "Eldritch Invocations" for Thirsting Blade
  action?: 'action' | 'bonus' | 'reaction' | 'special' | 'none';
  uses?: { count: number; per: 'short' | 'long' | 'turn' | 'day'; pool?: boolean; die?: string };
  source_ref?: string;          // "PHB-2024 153" — never printed on the player sheet
  options?: string[];           // chosen sub-options: ["Sea"], ["Greatsword (Graze)", "Whip (Slow)"]
}

export interface SpellEntry {
  name: string; level: number;
  source: string;               // raw Beyond source string
  origin: 'class' | 'subclass' | 'feat' | 'species' | 'invocation' | 'item' | 'other';
  always_prepared: boolean;     // spellPrepared === 'P'
  costs_slot: boolean;          // derived, see 3.6
  free_uses?: { count: number; per: 'long' | 'short' };
  ritual: boolean; concentration: boolean;
  save_or_atk: string; casting_time: string; range: string; components: string; duration: string;
  notes: string; page_ref: string;
}

export interface ClassResource {
  name: string; uses: number; recovery: string;   // existing
  die?: string;                 // "d8"
  pool?: boolean;               // true → uses is a point total (Lay On Hands 25), render a write-in box not bubbles
  source?: 'pdf' | 'table';
}

export interface AttackEntry {
  name: string; atk_bonus: string; damage: string; damage_type: string;
  range?: string; notes?: string;
  kind?: 'weapon' | 'unarmed' | 'spell' | 'rider';   // rider = Sneak Attack, Rage damage, Martial Arts die
  tags?: string[];              // ["pact weapon", "3 / long rest", "homebrew", "Vex"]
}

// PlayerCharacter additions
species: string;                // RACE field
background: string;             // BACKGROUND field
classes: ClassLevel[];          // parsed from "Wizard 5 / Rogue 3"
spell_details: Record<string, SpellEntry>;
weapon_masteries: { weapon: string; mastery: string }[];
grapple_shove_dc: number;       // 8 + PB + max(Str, Dex if monk) mod
feature_dc: { label: string; value: number } | null;  // Spell DC / Focus DC / Channel Divinity DC
```

New columns need a Supabase migration under `supabase/` (JSONB for `classes`, `spell_details`, `weapon_masteries`; text for `species`, `background`; int for `grapple_shove_dc`; JSONB for `feature_dc`). Every new field is optional: characters built by the homebrew wizard (`assemble-character.ts`) and characters already in the database will not have them, and the renderer must fall back to the existing fields when they are absent. Do not change the homebrew wizard in this pass.

## 3. Parser rules (`parse-character/route.ts`)

### 3.1 Identity

- `species` ← `RACE`. `background` ← `BACKGROUND`. Beyond also sets `RACE2/3`, `BACKGROUND2/3` (page headers); ignore.
- `classes` ← split `CLASS  LEVEL` on `/`, each `Name N`. Subclass per class comes from the `* <Class> Subclass` feature's `|` child (`| Evoker`, `| Thief`, `| Path of the Storm Herald (XGtE)`); strip a trailing `(SOURCE)`.
- `hit_dice_total` ← `Total` verbatim (`5d6 + 3d8` is correct as printed).
- `Defenses` may be the literal `None`; treat as empty.
- Read proficiency directly from `<Skill>Prof` and `<Abl>Prof` fields when present (`AthleticsProf`, `WisProf`, `SleightOfHandProf`); fall back to delta inference only when absent. Keep the `half` inference for Jack of All Trades (bard: Int 19, Arcana +5).
- `speeds` already parses `35 ft. (Walking), 35 ft. (Climbing)`; render all of them.
- `grapple_shove_dc` = 8 + PB + Str mod, or Dex mod if the character has Martial Arts and Dex > Str.

### 3.2 Feature grammar

Join `FeaturesTraits1..N` with a single space (not `\n`) at field boundaries, because Beyond breaks mid-sentence across fields. Then split into sections on `^=== (.+?) ===$`. Section names seen: `WARLOCK FEATURES`, `WIZARD FEATURES`, `ROGUE FEATURES`, `DHAMPIR SPECIES TRAITS`, `ELF SPECIES TRAITS`, `FEATS`. Multiclass characters have one `X FEATURES` section per class; `group` is the class name.

Within a section, lines match one of:

| Pattern | Meaning |
|---|---|
| `^\* (Name) • (Ref)` | Feature heading. `Ref` is `PHB-2024 153`, `RtHW 8`, `XGtE`, `br-2024`, `TCMP1 82`, `ERftLW`, or absent. Body is the following lines until the next `*` or `\|` heading. |
| `^\s+\| (Name) • (Ref)` | Child feature of the preceding `*` (invocations, fighting-style feat). Own body follows. |
| `^\s+\| (Name) •\s*$` | Chosen option with its own body (`\| Sea •`, `\| Greatsword (Graze) •`, `\| Drow Lineage •`, `\| Medium •`). Append to parent's `options`; keep the body as the option's text. |
| `^\s+\| (\d+) / (Long\|Short) Rest • (.+)$` | Uses for the preceding feature. Third group is the action: `1 Bonus Action`, `1 Action`, `Special`, `1 Minute`, `No Action`. |
| `^\s+\| (Label): (\d+) / (Long\|Short) Rest • (.+)$` | Named uses: `Luck Points: 3 / Long Rest`, `Focus Points: 5 / Short Rest`. If `Label` contains `Pool` (`Lay On Hands: Healing Pool: 25 / Long Rest`) set `pool: true`. |
| `^\s+\| (Label): (1 Action\|1 Bonus Action\|1 Reaction\|Special\|No Action)$` | An activation of the preceding feature (`\| Flurry of Blows: 1 Bonus Action`, `\| Deflect Attack: 1 Reaction`, `\| Push: Special`). Record as `{label, action}` on the parent; these populate "Your turn". |
| `^\s+\| (1 Action\|1 Bonus Action\|1 Reaction\|Special)$` | Bare action type for the preceding feature. |
| `^\s+\| (Subclass name)$` | Subclass selection (no bullet, no colon). |
| `^\s+\| (Name) \((Mastery)\) •` | Weapon mastery selection. Collect into `weapon_masteries`. |
| `^\s*• ` inside a body | A list bullet. Part of the body, never a new feature. |

Body paragraphs may contain inline bold-style run-ins (`Drain. You regain…`, `Flurry of Blows. You can expend…`). Keep them as paragraphs in `full_text`.

### 3.3 Classification and exclusion

Compute `kind` after parsing, in this order:

1. `container`: name matches `/^Core \w+ Traits$/`, `/^\w+ Subclass$/`, `/^Spellcasting$/`, `/^Pact Magic$/`, `/Spells$/` for subclass spell lists (`Fiend Spells`, `Oath of Castigation Spells`, `Elven Lineage Spells`), `/^Weapon Mastery$/` when it has no `options`. Containers are not rendered; their children and options are lifted to the parent group.
2. Excluded entirely: `/Ability Score Improvement/`, `/Ability Score Increase/`, `/^(Creature Type|Size|Speed|Darkvision|Languages|Age)$/` (these are in vitals, senses, or proficiencies already), `/^Standard Actions$/`.
3. `ribbon`: no `uses`, no `action`, body under 160 chars and no mechanical pattern (existing `MECHANICAL_PATTERNS`). Rendered as a one-line list on the Features page.
4. `mechanical`: everything else. Rendered with `full_text`.

Apply the empty-body test *before* prefixing any metadata, and do not drop an empty-bodied feature if the class reference table (section 4) has an entry for it. That rule is what saves Rage.

Merge duplicate headings by name within a group (Weapon Mastery ×3 on the barbarian): union `options`, keep the longest body.

### 3.4 Actions sections as the action-economy classifier

`Actions1..N` joined the same way, split on `=== (ACTIONS|BONUS ACTIONS|REACTIONS|SPECIAL) ===`. Each entry is `Name` on its own line, optionally `Name • N / Rest`, followed by an indented body. Use it only to set `action` on the matching feature (match by name, then by prefix before `:`), and to catch activations that exist only here (`Castigate: Shackle Flare`). Never take body text from Actions; it truncates (Dash's "Dark One's Blessing" has no body there).

### 3.5 Attacks

- Read `Wpn Notes N` into `notes`. Parse `Range (20/60)` out of notes into `range`. Mastery words (`Vex`, `Push`, `Nick`, `Graze`, `Slow`, `Sap`, `Topple`, `Cleave`) become tags.
- Dedupe identical rows (monk: Unarmed Strike twice). Drop an unarmed row with `0` damage when any other unarmed row exists (bard, paladin, multi). Keep `Enhanced Unarmed Strike`, `Flurry of Blows` as their own rows.
- When a weapon row's name matches a cantrip in the spell list (`Finger Guns`), mark it `kind: 'spell'` and do not render it twice.
- Add rider rows from the reference table when the feature exists: Sneak Attack (`2d6`, "once per turn, with advantage or an ally adjacent"), Rage damage (`+2`), Martial Arts die, Divine Smite as a slot sink (`2d8 radiant, +1d8 per slot level, +1d8 vs undead/fiend`). Rider dice come from the feature body when present (`extra 2d6`, `roll 1d8`), else from the table by level.
- Add a Vampiric Bite row when the species trait exists (see review 1.6).

### 3.6 Spells

- Build `spell_details` from `spellName/Prepared/Source/SaveHit/CastingTime/Range/Components/Duration/Notes/Page` per index. Level from the preceding `spellHeader`. `[R]` suffix → `ritual`, strip it from the name. `concentration` from duration text. `free_uses` from notes `1/LR` or `1/SR`.
- Dedupe by name. Merge: `always_prepared` OR, `free_uses` from whichever has it; `costs_slot` follows the rule below regardless of how many copies the export listed. Seen on Misty Step, Charm Person, Divine Smite, Find Steed, Faerie Fire, Darkness.
- `origin` from `source`: `Warlock`/`Bard`/`Paladin`/`Wizard` → class; `(Always Prepared)` with a subclass name → subclass; `Fey Touched`/`Magic Initiate` → feat; `Elven Lineage Spells`/`… Lineage` → species; `Eldritch Invocations` → invocation. `Evocation Savant` and `Beguiling Magic` → subclass.
- `costs_slot`: level 0 → false. Source `Eldritch Invocations` and the spell is an at-will invocation (Disguise Self via Mask of Many Faces) → false. Ritual-tagged with source `Eldritch Invocations` (Pact of the Tome) → false (ritual only). Otherwise true. `free_uses` never sets `costs_slot` to false: a feat or species free cast (Fey Touched, Drow lineage) can also be cast with slots, so Charm Person on Dash and Faerie Fire on the multiclass carry both the `free 1/LR` and `slot` chips even when the export lists only the free copy.
- Slots always come from the lookup. Extend `getSpellProgression` to take `classes[]` and compute the 2024 multiclass caster level (sum full casters; half for Paladin and Ranger; a third for Eldritch Knight and Arcane Trickster; check the 2024 PHB multiclassing table for rounding, it changed from 2014). Warlock pact slots stay separate. `samplemulti` must come out as 4/3/2, not the 4/3 the PDF headers suggest.
- `is_spellcaster` is true if the character has any spell, including species spells on a non-caster. A non-caster with only species or feat spells gets no Spells pages; those spells render as a small "Innate spells" block on the Features page.
- `is_prepared_caster` for Cleric, Druid, Paladin, Wizard, Artificer (2024 rules: Bard, Ranger, Sorcerer, Warlock also "prepare" but from a known list; treat only the first group as needing a prepared indicator).

### 3.7 Equipment

Group identical names and sum quantities (Handaxe ×4; Rations 8+10+10 = 28). Keep weight per line. Note attunement candidates (`Enspelled …`, `+1`, named items) with a tag; Beyond does not export attunement state.

## 4. Class reference table (`src/data/class-reference.ts`)

Per class, per level 1–20: resources, rider dice, canonical full text for features the export leaves empty, a `short` one-line clause for every core and commonly-used feature (Rage: `resistance to bludgeoning, piercing, slashing · +2 to Str damage · advantage on Str checks and saves`; Lucky: `spend a point for advantage on your d20, or disadvantage on an attack against you`), and the feature DC label. The table is the authority when the PDF is silent; when the PDF has a number, the PDF wins and the table supplies only what is missing (die, recovery, text). Minimum coverage for the 2024 PHB twelve, plus Artificer:

| Class | Resources (uses by level) | Dice / pools | Feature DC label | Known-empty exports |
|---|---|---|---|---|
| Barbarian | Rage: 2 (L1), 3 (L3), 4 (L6), 5 (L12), 6 (L17) per long rest; regain one on short rest (L7+ Instinctive Pounce etc. as text) | Rage damage +2 (L1), +3 (L9), +4 (L16) | Grapple/Shove DC | **Rage** (text, uses, bonus action) |
| Bard | Bardic Inspiration: Cha mod uses, short rest from L5 (Font of Inspiration) | d6 (L1), d8 (L5), d10 (L10), d12 (L15) | Spell DC | |
| Cleric | Channel Divinity 2 (L2), 3 (L6), 4 (L18), long rest, one regained on short rest | | Spell DC | |
| Druid | Wild Shape 2 (L2), 3 (L6), 4 (L17), long rest, one on short | | Spell DC | |
| Fighter | Second Wind 2/3/4 long rest (one on short); Action Surge 1 (L2), 2 (L17) short rest; Indomitable 1/2/3 long rest; Superiority dice (Battle Master) 4/5/6 short rest | Superiority d8/d10/d12 | Maneuver DC | |
| Monk | Focus Points = level, short rest | Martial Arts d6 (L1), d8 (L5), d10 (L11), d12 (L17) | Focus DC (8 + PB + Wis) | |
| Paladin | Lay On Hands pool = 5 × level, long rest; Channel Divinity 2 (L3), 3 (L11), long rest, one on short; Divine Smite 1 free per long rest | | Spell DC | |
| Ranger | Favored Enemy (Hunter's Mark free casts) 2/3/4/5/6 long rest | | Spell DC | |
| Rogue | | Sneak Attack 1d6 per 2 levels, rounded up | | |
| Sorcerer | Sorcery Points = level (L2+), long rest; Innate Sorcery 2 long rest | | Spell DC | |
| Warlock | Pact slots 1/2/3/4 by level at slot level 1–5; Magical Cunning 1 long rest | | Spell DC | |
| Wizard | Arcane Recovery 1 long rest, total slot levels = half level rounded up | | Spell DC | |
| Artificer | Flash of Genius Int mod long rest | | Spell DC | |

Also encode, per class, the standard Weapon Mastery count so the renderer can label the chosen masteries, and the Extra Attack level so "Attack twice" appears in "Your turn" (Fighter 5, Barbarian 5, Paladin 5, Ranger 5, Monk 5, Warlock via Thirsting Blade, Bladesinger 6, Valor Bard 6).

Reconciliation rule: for each table resource, look for a PDF feature with the same name. Trust is by field type, not by source. A structured `|` uses line is authoritative (Bardic Inspiration `4 / Short Rest` on the fixture, from Cha +4, matches). A number embedded in body prose is not: the bard fixture's body says "Bardic Inspiration dice (1d6)" and "4 times per Long Rest" for a level-5 bard whose die is d8 and whose recovery is short rest, so dice and recovery in prose lose to the table. Use prose dice only when the table has no entry (homebrew subclass features). If the PDF has the feature with no uses, take uses from the table and mark `source: 'table'`. If the PDF lacks the feature entirely (Rage), create it from the table with the canonical text. Never create a table feature the PDF does not at least name, except where the table marks it `core: true` (Rage, Sneak Attack, Martial Arts, Lay On Hands, Bardic Inspiration, Pact Magic).

## 5. Render spec (`export-character/route.ts`)

Visual reference: `docs/sheet-mockup-v3.html` (open in a browser). It is Dash's data laid out as pages 1, the spell index, and the first spell description page. Match its hierarchy and spacing; the HTML is the design, not the implementation.

Letter, 0.5 in margins, parchment system (existing tokens). Embed Cinzel 600/700 and Crimson Pro 400/600 via `addFileToVFS` + `addFont`, stored as base64 string modules under `src/data/fonts/` (OFL; TTFs from the google/fonts GitHub repo). If the TTFs cannot be fetched in the session, leave the font modules as a TODO with the loader in place and keep Times; do not block the rest of the work on fonts. Type scale: 26 / 19 / 11 Cinzel, 11.5 / 10 Crimson Pro. Tabular numerals in every modifier column. Maroon for the band and section rules; gold for chips, the band's top rule, and the diamond ornament only.

### 5.1 Page 1: Combat reference (all classes)

**Band.** Name; line 2: `{species} · {classes joined with " / "}, {subclasses} · {background} · played by {player}`; right: "Combat reference" and export date.

**Vitals strip, seven cells.** AC (sub: source, e.g. "no armor", "Unarmored Defense"); HP max (sub: hit dice string); Initiative; Speed (sub: every speed type, e.g. "walk · climb", "fly 30"); Proficiency; **Feature DC** (label from `feature_dc`: Spell DC with "atk +8 · Cha" sub, or Focus DC, or Channel Divinity DC; the sub-line always carries `grapple/shove DC N`, and for a class with no feature DC the Grapple/Shove DC is the main value); Passive Perception (sub: senses).

**Left rail (~200 px / 46 mm).** Abilities and skills grouped by ability: six stacked blocks, each a header row and that ability's skills beneath with dot, name, modifier. Header row alignment: the ability label (STR) and the modifier (+4) share one baseline, label small-caps at the left, modifier large immediately after it; the score (18) sits right-aligned on that same baseline in muted small type; the save (`● save +7`) is a second line right-aligned beneath the score. Every save shows a circle, filled when proficient and empty otherwise, matching the skills. Con collapses to the header. Append `+1d4` or similar inline when a feature adds a die to specific checks (Arcane Eloquence, Guidance-like features). Then Defenses & senses (resistances, immunities, condition immunities, senses, special movement). Then Proficiencies as four one-liners. Passive Insight and Investigation as a muted line under skills.

**Right column.**

1. *Attacks & cantrips.* Columns: Name (with tags as chips and a notes line beneath), Hit / DC, Damage, Range. Rows ordered: weapons, unarmed, attack cantrips, feature attacks, then a thin "Adds to a hit" sub-table for riders (Sneak Attack, Rage damage, Divine Smite, Hex if active). A feature whose text contains `(ranged|melee) (spell|weapon) attack` and a damage expression or "Martial Arts die" becomes an attack row (Radiant Sun Bolt: +8, 1d8 radiant, 30 ft). Omit a rider that is already folded into a row above it (the Martial Arts die when the Unarmed Strike row already shows 1d8+5). Below the table, one line for chosen weapon masteries: `Masteries · Greatsword Graze · Whip Slow · Handaxe Vex`, each mastery word with its one-line effect in the notes of the matching weapon row when the weapon is present.
2. *Your turn.* Four groups: Action, Bonus action, Reaction, Always on. Populate from `action` on features and activations (3.2, 3.4), spell casting times (`1BA` spells go under Bonus action with a slot chip; `1R` under Reaction), Extra Attack from the table, and species traits with an action. Each item: bold name, the feature's `summary` clause, muted parenthetical for cost (`slot`, `1 Focus`, `concentration`) and source feature in italics when the item is an activation or option. Naming: an option renders as `Parent: Option` (`Storm Aura: Sea`, not `Sea`); a feature with several activations of the same action type renders once under the feature name with one clause, not the activation labels joined with slashes (`Deflect Attacks · reduce the damage by 1d10+10; if reduced to 0, redirect it (1 Focus)`, not `Deflect Attack / Redirect Attack`). No clause ends in an ellipsis; cut at a clause boundary or use the table's `short`. This block is the centre of the page for non-casters; for a monk it reads Flurry of Blows / Patient Defense / Step of the Wind / Unarmed Strike under Bonus action and Deflect Attacks / Slow Fall under Reaction.
3. *Resources.* One line per resource: name, recovery in muted text, and either empty circles (uses ≤ 8), `N` with a short write-in rule (uses > 8 or `pool`, e.g. Lay On Hands 25, Focus Points 5 is still circles), or `d8 × 4` when a die applies. Group short-rest resources before long-rest. Include Heroic Inspiration as one circle when the species or feat grants it (Human Resourceful, Musician).
4. *Inventory* inline whenever the grouped table fits in the remaining right-column space; otherwise a one-line summary ("21 items, 162 lb, see Inventory page") and a separate page. Measure, don't count rows.

If the right column overflows, Inventory moves first, then Resources, to page 2. Never split Attacks or Your turn.

### 5.2 Page 2: Features

Two columns, full text. Groups in order: each class in `classes` order (subclass name in the group header), Species traits, Feats. Within a group, mechanical features first, then a single "Also" paragraph listing ribbons by name with a short clause each. Each mechanical heading carries its tags inline: `Vampiric Bite · 3 / long rest · replaces an unarmed strike`, `Monk's Focus · 5 points / short rest`, `Rage · 3 / long rest · bonus action`. Chosen options render under the parent: Weapon Mastery as `Greatsword: Graze · Whip: Slow · Handaxe: Vex` with one-line definitions; Storm Aura as `Sea` with its text. Innate spells block here for non-casters. No page refs.

### 5.3 Spells

Only when the character has class, subclass, feat, or invocation spells (not species-only).

**Stats strip.** Spell save DC and spell attack at display size, ability, then the slot block: pact slots as large bubbles with "all cast at Nth level · short rest" and Magical Cunning's single bubble; standard casters as one column per slot level that has slots, each with its bubbles (4 / 3 / 2) and the level label; half casters the same with fewer columns. Prepared casters add "Prepared: N of M" when the counts are known.

**Spell index.** One table, grouped by level with a rule-and-label divider: Name with chips (`slot`, `free 1/LR`, `at will`, `ritual`, `always prepared` for subclass spells, `C` for concentration), Time, Range, Hit / DC, Duration, From (origin label: Warlock, Tome, Fiend, Fey Touched, Drow lineage, Evocation Savant). Deduped. Fits one page for any character up to about 30 spells; overflow continues on a second index page before any cards.

**Spell descriptions.** Cards in two columns, same level dividers, same chips. Body from SRD / custom spells. For pact casters resolve the "higher-level slot" paragraph for the pact slot level in italics. Homebrew spells with no library text: header line from `spell_details`, body "No description in the spell library; add it under custom spells." Multi-caster characters (Paladin/Sorcerer) use the combined slot table and one index.

### 5.4 Inventory page

Only when needed. Grouped rows with quantity, weight, and notes; currency block; attuned-candidate tags. No blank notes lines.

## 6. Multiclass specifics

- Header: `Elf · Wizard 5 / Rogue 3, Evoker · Thief · Criminal`.
- Vitals HP sub shows `5d6 + 3d8`.
- Features page has one group per class, in the order Beyond lists them.
- Slots from the combined table (3.6). Spell DC and attack from the single casting class; if two casting classes with different abilities exist, show both in the strip (`Spell DC 14 · Wis` / `Spell DC 13 · Cha`) and tag each spell's origin.
- Extra Attack appears only if a class reaches it; a Fighter 4 / Wizard 4 does not get "Attack twice".
- Proficiency bonus from total level (already what Beyond exports).

## 7. Known Beyond-side data issues to surface in the import UI

- Pact of the Blade present but no weapon rolls Cha → "Bond your pact weapon in Beyond and re-export" (Dash, +5 vs +9).
- Rage missing from export → auto-created from the table; show a notice.
- Duplicate inventory lines consolidated → show the count merged.

## 8. Acceptance checks per fixture (`PCsheets/fixtures/`)

Run the export for each and verify:

**warlock-dash-fiend-5.pdf** — Thirsting Blade, Pact of the Blade, Mask of Many Faces, Pact of the Tome each render as their own feature. Resources: pact slots 2 (3rd, short rest), Magical Cunning 1, Vampiric Bite 3, Charm Person free 1, Misty Step free 1. Smooth Talker `+1d4` on three Cha skills. Misty Step once in the index. Blood Bolt has a complete index row. No `Pact Magic`, no ASI entry, no page refs on page 1. Species "Dhampir" in the band.

**bard-lucien-glamour-5.pdf** — Slots 4 / 3 / 2 with bubbles. Bardic Inspiration `d8 × 4 · short rest` (die from the table since the body says 1d6 at L1 wording; verify against the Font of Inspiration entry). Beguiling Magic 1/LR. Lucky 3. Charm Person once, tagged `always prepared` via Beguiling Magic. Finger Guns appears once (attack cantrip row), not as a weapon duplicate. Unarmed Strike `0 Bludgeoning` row dropped. Heroic Inspiration circle from Resourceful. Arcana shows the half-proficiency `+5`.

**monk-grandpa-dan-sun-soul-5.pdf** — Feature DC cell reads `Focus DC 10` (8 + PB + Wis; his Wis is low and that is the DC his own export prints on Stunning Strike), with `grapple/shove DC 16` on the sub-line. Resources: Focus Points 5 circles, short rest; Uncanny Metabolism 1; Lucky 3. Your turn → Bonus action: Flurry of Blows (1 Focus), Patient Defense, Step of the Wind, Unarmed Strike; Reaction: Deflect Attacks, Slow Fall; Action: Attack twice, Stunning Strike, Radiant Sun Bolt. Attacks: one Unarmed Strike row `+8 · 1d8+5`, Flurry row, Martial Arts die rider. Grapple/Shove DC 16 (Dex) on the sub-line. No spells pages.

**paladin-amber-slam-castigation-5.pdf** — Half-caster strip: 1st ×4, 2nd ×2, no cantrips. Lay On Hands rendered as a 25-point pool with a write-in box, not 25 circles. Channel Divinity 2 with Divine Sense and Incite as activations. Divine Smite once, chips `free 1/LR` and `slot`, plus a Divine Smite rider row in attacks. Find Steed once. Weapon masteries `Warhammer: Push` (ignore the Antimatter Rifle unless it is in inventory). Two fighting-style feats both present under Feats. Oath of Castigation spells tagged `always prepared`.

**multiclass-wizard5-rogue3.pdf** — Band shows both classes and both subclasses. Slots 4 / 3 / 2. HD `5d6 + 3d8`. Features page has Wizard and Rogue groups. Sneak Attack rider `2d6` in attacks with the condition clause. Cunning Action, Steady Aim, Fast Hands ×3 under Bonus action. Arcane Recovery 1/LR. Darkvision 120, immunity to magical sleep, Fey Ancestry. Species spells (Dancing Lights, Faerie Fire, Darkness) deduped and tagged `Drow lineage · free 1/LR`. Inventory grouped: Dagger ×4. Climb speed in vitals.

**barbarian-zhela-storm-herald-5.pdf** — Rage present: `3 / long rest · bonus action`, canonical text from the table, Rage damage `+2` rider. Feature DC cell reads `Grapple/Shove DC 15`. Weapon Mastery once, with `Greatsword: Graze · Whip: Slow · Handaxe: Vex`. Storm Aura: Sea under Bonus action with the lightning DC 13 text. Aggressive under Bonus action. Push (Tavern Brawler) under Always on. Handaxe row carries `Vex` tag and `20/60` range. Inventory page: Handaxe ×4, Rations ×28, Bedroll ×3, 162 lb. No Defenses line (literal `None` suppressed). No spells pages.

## 9. Implementation order

Work in phases and commit after each. Run the fixture script (phase 2) before starting the renderer.

0. Extract the parser out of the route handler into `src/lib/import/ddb-parser.ts` (pure function: form fields in, `ParsedCharacter` out; the route only handles the upload and calls `extractFormFields` + the parser) and the renderer into `src/lib/pdf/character-export.ts`. The routes stay thin. Add `scripts/parse-fixtures.ts` (run with `tsx`) that parses every PDF in `PCsheets/fixtures/` and writes `PCsheets/fixtures/out/<name>.json`; commit the JSON so later changes diff. There is no test framework in the repo; do not add one for this.
1. Types (section 2) and class reference table scaffold with the thirteen classes' resources and Rage/Sneak Attack/Martial Arts/Bardic/Lay On Hands/Focus entries.
2. Parser: feature grammar, classification, Actions classifier, attacks, spells, equipment grouping, multiclass class line and slots. Re-run `parse-fixtures` and check the JSON against the section 8 list before touching the renderer. Also add `scripts/export-fixtures.ts` that renders each fixture JSON to `PCsheets/fixtures/out/<name>.pdf` so the renderer can be checked without the UI.
3. Renderer page 1, then Features page, then Spells (strip, index, cards), then Inventory. Fonts last.
4. Import-UI notices (section 7).
