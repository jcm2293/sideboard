# Sideboard — Spec & Implementation Guide v2

## What is Sideboard?

Sideboard is a browser-based campaign management tool for tabletop RPG dungeon masters running D&D 5e (2024 rules). It's designed around the insight that DM tools today optimize for world-building (which is fun but slow) and neglect the live-session experience (which is where friction kills immersion). Sideboard treats prep and play as two phases of the same workflow: you build deep on the left, you pull fast on the right.

The name comes from Magic: The Gathering — a sideboard is the auxiliary toolkit you swap cards in and out of between games. That's exactly what the right panel does during a session.

The app is live at dmsideboard.com.

---

## Target Users

Primary: The developer (Jake) and 2-3 friends running D&D 5e campaigns. Secondary: Eventually the broader TTRPG community, potentially as a paid product. All users are DMs. There is no player-facing component.

---

## Design Philosophy

**Prep is deep, play is fast.** The left sidebar is for building and editing. The right panel (Live Shelf) is for glancing and grabbing during sessions. These are different UX modes but not different app modes — the transition is spatial, not a toggle.

**The DM is the author.** AI assists in a pinch (generate an NPC, draft a recap, answer a lore question, help build a campaign). It does not generate campaigns or storylines without DM input. The DM's world meta and session history are the AI's context — it writes in your voice, not its own.

**Everything is searchable and linkable.** Any entity can be found instantly by name or tag. Parent-child relationships are lightweight — optional foreign keys, not a graph database.

**The character sheet is a reference card, not a worksheet.** Players don't write on it during play. It's the thing you glance at when you need a number. Live state (current HP, spell slots used, conditions) lives in a notebook, not on the digital sheet.

**Audio is a first-class feature.** Ambient mood music and triggered sound effects are one of the highest-impact, lowest-effort ways to improve immersion at the table.

**The atmosphere matters.** The visual design should feel like working inside a beautifully bound DM screen — parchment, maroon and gold, medieval serif typography. Functional first, but unmistakably D&D.

---

## Tech Stack

**Frontend:** Next.js 14+ (App Router), React with TypeScript, Tailwind CSS, Zustand for client state, Web Audio API for audio. Deployed on Vercel.

**Backend:** Supabase (Postgres + Auth + Storage). Google OAuth only for authentication. Row-level security policies scoped to user → campaign ownership.

**AI:**
- **Campaign Builder uses Claude Opus 4.7** (`claude-opus-4-7`) — writing quality is essential for collaborative world-building.
- All other AI features (session log processing, quick NPC generation, lore suggestions) use Claude Sonnet 4.6 (`claude-sonnet-4-6`).

**PDF Parsing:** `pdfjs-dist` for D&D Beyond character sheet extraction.

**PDF Export:** `jsPDF` or similar for character sheet generation.

**Domain:** dmsideboard.com (with sideboard.vercel.app as fallback).

**Logo:** Full wordmark logo at /public/logo.png. D20-with-S favicon at /public/favicon.png. Used in login page (full logo, centered) and sidebar header (replacing text).

---

## Visual Design System

### Color Palette
- Background: parchment cream `#F4E4C1`
- Card backgrounds: lighter parchment `#F8F0DC` and `#FDF1DC`
- Sidebar: dark wood/leather brown `#2C1810` and `#1A1210`
- Sidebar text: warm gold `#D4A849` and cream `#C8B07A`
- Primary accent: deep maroon `#58180D`
- Secondary accent: dark gold `#D4A849`, muted gold `#B8860B`
- Body text: dark brown `#1A1210`
- Section ornaments: gold

### Typography
Imported from Google Fonts:
- `--font-display: "Cinzel Decorative"` — used ONLY for the "Sideboard" logo wordmark
- `--font-heading: "IM Fell English SC"` — used for all page titles, section headers, card titles, sidebar nav items, button text. Reads as authentic 17th-century printing type.
- `--font-body: "Crimson Text"` — used for all body text, descriptions, form labels
- `--font-data: system-ui, sans-serif` — used for stat numbers, ability scores, form input values

### Visual Elements
- Subtle parchment texture on main content area (CSS-only via repeating gradients and inset box-shadow)
- Section dividers: thin gold horizontal rule with a centered diamond (◆) or fleur-de-lis ornament
- Cards in the Live Shelf have a slight rotation (0.2-0.5deg, alternating) to feel like pinned notes
- Buttons have subtle embossed feel via gradient and border
- Active sidebar nav items have a 3px gold left border and faint warm background tint
- Stat blocks rendered to match official 5e formatting: cream background `#FDF1DC`, maroon headers, gradient red/orange bars at top and bottom

---

## Information Architecture

### Left Sidebar Navigation

In order from top to bottom:

1. **Overview** — Campaign overview, world meta editor
2. **Builder** — AI-powered Campaign Builder (chat interface)
3. **Lore** — Tagged lore entries
4. **Plot Arcs** — DM secret story structure
5. **NPCs** — Campaign NPC registry
6. **Locations** — Hierarchical locations
7. **Factions** — Organizations and groups
8. **Items** — Equipment, magic items, loot
9. **Spells** — SRD spell library + custom spells
10. **Sessions** — Chronological session list
11. **Bestiary** — Persistent monster/stat block library
12. **Players** — Player character sheets
13. **Quick Reference** — D&D 5e rules reference
14. **Audio** — Ambient music and SFX

### Right Panel — The Live Shelf

A toggleable sliding panel on the right side. The DM's workbench during a session. Holds dynamically populated cards: current scene, pinned NPCs, active stat blocks, player quick-reference cards, pinned spells, AI Assist button, scratchpad, and a compact audio control bar at the bottom.

Cards in the shelf support drag-to-reorder, collapse/expand, pin/unpin, and quick-search to pull any campaign entity onto the shelf.

---

## Data Model

All tables include `id: uuid`, `created_at: timestamp`, `updated_at: timestamp` unless otherwise noted. All campaign-scoped tables have `campaign_id: uuid` foreign key with RLS policies checking `campaign.user_id = auth.uid()`.

### Campaign
```
campaign {
  id, user_id, name, description
}
```

### World Meta
```
world_meta {
  id, campaign_id, tone, tech_level, themes, magic_system,
  custom_fields (jsonb)
}
```
Singleton per campaign.

### Lore Entry
```
lore_entry {
  id, campaign_id, title,
  category (history|geography|culture|religion|magic|politics|other),
  content (text), tags (text[])
}
```

### Plot Arc
```
plot_arc {
  id, campaign_id, title, description, dm_secrets,
  status (active|resolved|abandoned), sort_order
}
```

### NPC
```
npc {
  id, campaign_id, name, role,
  backstory (one line), goal, fear, leverage,
  knowledge, knowledge_free, knowledge_check,
  quirk, voice_notes,
  status (alive|dead|unknown), met_by_players (bool),
  faction_id (FK, optional), location_id (FK, optional),
  notes
}
```

### Location
```
location {
  id, campaign_id, parent_location_id (FK, optional, for hierarchy),
  name, description, notable_features, region, tags
}
```

### Faction
```
faction {
  id, campaign_id, name, description, goals, alignment, notes
}
```

### Item
```
item {
  id, campaign_id, name, description,
  value_gp (decimal, optional),
  is_weapon (bool), damage_dice (optional), damage_type (optional),
  special_effects (text, optional),
  is_quest_item (bool),
  held_by_npc_id (FK, optional), found_at_location_id (FK, optional),
  notes
}
```

### Session
```
session {
  id, campaign_id, session_number, title, date,
  status (planning|upcoming|completed), prep_notes
}
```

### Scene
```
scene {
  id, session_id, title, description, dm_notes,
  location_id (FK, optional), sort_order
}
```

### Scene-NPC Join
```
scene_npc { scene_id, npc_id }
```

### Encounter
```
encounter {
  id, session_id, name, description, difficulty,
  lair_actions, map_image_url (optional), notes
}
```

### Encounter-StatBlock Join
```
encounter_stat_block { encounter_id, stat_block_id, quantity }
```

### Stat Block (Bestiary)
```
stat_block {
  id, campaign_id, name,
  size, type, alignment,
  ac (int), ac_type (optional),
  hp (string, e.g. "45 (6d8+18)"),
  speed,
  str, dex, con, int_score, wis, cha,
  saving_throws (text, optional),
  skills (text, optional),
  damage_resistances, damage_immunities, condition_immunities,
  senses, languages,
  cr (string, e.g. "5", "1/2"),
  traits (jsonb [{name, description}]),
  actions (jsonb [{name, description}]),
  reactions (jsonb, optional),
  legendary_actions (jsonb, optional),
  notes
}
```

### Session Log
```
session_log {
  id, session_id (unique),
  raw_notes, ai_recap, key_events, revelations, npc_interactions
}
```

### Player Character (Enhanced)
```
player_character {
  id, campaign_id,
  
  -- IDENTITY
  name, player_name,
  class_name, subclass (optional), level,
  
  -- COMBAT
  armor_class (int), ac_source (optional),
  initiative_modifier (int),
  speeds (jsonb, e.g. {"walking": "30 ft.", "climbing": "20 ft."}),
  hp_max (int), hit_dice_total (string), proficiency_bonus (int),
  
  -- PASSIVES & SENSES
  passive_perception (int), passive_insight (int, optional),
  passive_investigation (int, optional),
  senses (text, optional),
  
  -- ABILITY SCORES (raw — modifiers calculated frontend)
  str_score, dex_score, con_score, int_score, wis_score, cha_score,
  
  -- PRE-CALCULATED MODIFIERS (final values including all bonuses)
  skill_modifiers (jsonb {"athletics": 1, "acrobatics": 5, ...}),
  save_modifiers (jsonb {"str": 1, "dex": 2, ...}),
  
  -- PROFICIENCY METADATA (for edit view clarity, not used in calc)
  save_proficiencies (jsonb {"str": "none", "dex": "proficient", ...}),
  skill_proficiencies (jsonb {"athletics": "none", "stealth": "expertise", ...}),
  -- Values: "none" | "half" | "proficient" | "expertise"
  
  -- ATTACKS
  attacks (jsonb [{name, atk_bonus, damage, damage_type, range, notes}]),
  
  -- DEFENSES
  damage_resistances (text), damage_immunities (text),
  condition_immunities (text),
  
  -- PROFICIENCIES
  armor_proficiencies (jsonb {light, medium, heavy, shields: bool}),
  weapon_proficiencies (jsonb {simple, martial: bool}),
  languages (text), tool_proficiencies (text),
  
  -- SPELLCASTING
  is_spellcaster (bool),
  spell_attack_bonus (int, optional), spell_save_dc (int, optional),
  spellcasting_ability (string, optional),
  spell_slots (jsonb {"1": 4, "2": 3, ...}, optional),
  pact_slot_level (int, optional), pact_slot_count (int, optional),
  spells (jsonb {"0": ["Vicious Mockery"], "1": ["Charm Person"], ...}),
  is_prepared_caster (bool),
  prepared_spells (jsonb [spell names], optional),
  
  -- CLASS RESOURCES
  class_resources (jsonb [{name, uses, die (optional), recovery}]),
  
  -- FEATURES (one-line summaries, NOT full rules text)
  class_features (jsonb [{name, summary}]),
  racial_traits (jsonb [{name, summary}]),
  feats (jsonb [{name, summary}]),
  
  -- INVENTORY
  equipment (jsonb [{name, qty, weight, notes}]),
  
  -- CURRENCY
  cp, sp, ep, gp, pp (int, default 0),
  
  -- SOURCE
  pdf_url (optional)
}
```

### Custom Spells
```
custom_spell {
  id, campaign_id, name,
  level (int, 0 for cantrip), school,
  casting_time, range,
  components_v (bool), components_s (bool), components_m (bool),
  material_description (text, optional),
  duration, concentration (bool), ritual (bool),
  description (text), higher_levels (text, optional),
  classes (text[])
}
```

### Builder Messages (Campaign Builder Chat History)
```
builder_message {
  id, campaign_id,
  role (user|assistant), content (text),
  proposed_elements (jsonb, optional)
}
```

---

## Feature Specifications

### 1. Authentication & Deployment

Google OAuth only via Supabase. No email/password flows. Login page is just the logo + "Sign in with Google" button.

Required redirect URLs in Google Cloud Console authorized JavaScript origins:
- `https://dmsideboard.com`
- `https://sideboard.vercel.app`
- `http://localhost:3000`

Supabase URL Configuration:
- Site URL: `https://dmsideboard.com`
- Redirect URLs (with /** wildcards): `https://dmsideboard.com/**`, `https://sideboard.vercel.app/**`, `http://localhost:3000/**`

Auth middleware protects all `/campaign/*` routes. RLS policies ensure all queries filter by `campaign.user_id = auth.uid()`.

### 2. Campaign Builder (AI World-Building)

A conversational AI tool at `/campaign/[id]/builder` that helps DMs create campaign worlds through guided dialogue. **Uses Claude Opus 4.7** specifically — this is the only place Opus is used.

**Three core philosophies hard-coded into the system prompt:**

1. **Anti-bloat (the iceberg principle).** AI proposes the shape of the iceberg and the visible tip — not the whole iceberg. Every proposed element passes the test: "would the DM need this in the next 2-3 sessions, OR is this foundational?" Lore entries are 2-4 sentences, not paragraphs.

2. **Anti-complexity.** Propose simple structures with depth potential, not pre-built puzzles. A starting mystery has 2-3 suspects, not 7 factions with interlocking motives. Complexity emerges from player interaction with simple structures.

3. **Anti-theme-saturation.** The campaign theme informs the central conflict and major story beats — NOT the texture of daily life. When generating NPCs, at most 1 in 5 has a quirk connected to the campaign's theme. The other 4 feel like real people from a living world.

**Conversation phases (flexible, not rigid):**
- Phase 1: Seed — DM shares pitch, AI reflects and asks 2-4 clarifying questions
- Phase 2: Geography & power — sketch 3-5 regions and 2-4 factions
- Phase 3: The arc — propose 2-3 possible campaign arcs (one sentence each)
- Phase 4: Session 1 starter — starting location, inciting incident, 3-5 NPCs
- Phase 5: Open questions — explicitly identify what's left vague, encourage leaving things vague

**Inline save cards:** When the AI proposes saveable elements, they render as interactive cards within the chat using `:::save:TYPE` markers in the response. Card types: `location`, `npc`, `faction`, `lore`, `plot_arc`, `world_meta`. Each card has "Save to Campaign", "Edit & Save", and "Dismiss" buttons.

**Context assembly:** Every API call includes the system prompt with the world-building philosophy + the full campaign state (world meta, all lore entry titles + first sentences, all locations, factions, NPCs with roles, plot arcs, session titles + recaps). Format as readable text, not raw JSON.

**Persistence:** Chat history saved to `builder_message` table. Returning to the builder loads existing history and shows a context indicator: "Your campaign has: 4 locations, 3 factions, 5 NPCs, 2 lore entries, 1 plot arc."

**Streaming:** Use streaming API for token-by-token response. Parse `:::save:::` blocks after streaming completes.

### 3. Sessions

**Session Prep View:**
- Session number, date, title
- Planned scenes (ordered list with title, description, pinned location, pinned NPCs, DM notes)
- Planned encounters (with stat blocks attached)
- Optional map image upload (for DM reference, not parsed)

**Session Log View (post-session):**
- Raw notes field (paste from Granola transcript summaries — the app does NOT do audio-to-text)
- Buttons to trigger AI processing on raw notes:
  - Generate recap
  - Extract key events
  - Extract revelations (what the party learned — critical for prep next session)
  - Extract NPC interactions

**Suggested Lore Entries (post-processing):**
After AI processes session notes, a second AI call identifies 2-5 potential new lore entries based on what happened. The AI receives processed session data + existing lore entry titles to avoid duplicates. Each suggestion shows: proposed title, category, draft content (2-3 paragraphs), brief reasoning. Render as collapsible cards below the session log with "Add to Lore" and "Dismiss" buttons.

**Campaign-Level Session Timeline:**
Filterable view of all sessions by NPC appearances, plot arc progression, locations visited, revelations.

### 4. NPCs

NPC fields per the data model. The NPC Compact Card (Live Shelf view) prioritizes mid-session glanceability:
- Name and role (header)
- Quirk (immediately visible)
- Voice notes (visible without expanding)
- What they share freely (visible without expanding)
- Expandable: goal, fear, leverage, knowledge requiring a check, backstory, full notes

### 5. Locations, Factions, Items

Standard CRUD with the data model. Items support optional weapon fields (damage dice, type, special effects) and gold value.

### 6. Bestiary (Stat Blocks)

Persistent stat block library at the campaign level. Stat block form supports all fields (size, type, alignment, AC, HP, speed, all six abilities, saves, skills, resistances, immunities, senses, languages, CR, traits, actions, reactions, legendary actions).

**Form input parsing for jsonb fields:**
Traits, actions, reactions, legendary actions accept simple text input format:
```
Sword. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (1d6+4) slashing damage.

Multiattack. The creature makes two attacks.
```
Each entry separated by blank lines. Parse into `{name, description}` by splitting on the first period. Helper text on each textarea explains the format with examples.

**Stat Block Display Component (`<StatBlockDisplay>`):**
Reusable component used in bestiary list, encounter view, and Live Shelf. Displays in this order, only showing fields with data:

1. **Header:** Name (large bold maroon), then "Size type, alignment" in italics (e.g. "Medium fiend, lawful evil")
2. **Basic Stats:** Armor Class (with type in parens), Hit Points, Speed
3. **Ability Scores:** All six in a horizontal row centered, showing "14 (+2)" format. Modifier formula: `Math.floor((score - 10) / 2)`
4. **Secondary Stats** (only if data exists): Saving Throws, Skills, Damage Resistances, Damage Immunities, Condition Immunities, Senses, Languages, Challenge (with XP). Use the standard CR-to-XP table for the XP calculation.
5. **Feature Sections** (only if entries exist):
   - Traits (no header, each as "Trait Name." in bold italic)
   - Actions (with "Actions" header)
   - Reactions (with "Reactions" header)
   - Legendary Actions (with header + standard preamble: "The [creature] can take 3 legendary actions...")

**Display rules:**
- Thin maroon horizontal rules separating major sections
- Cream/tan background `#FDF1DC`
- Red/orange gradient bars at top and bottom
- Cinzel for creature name, Crimson Text for body
- Compact prop available — collapses ability scores to one line and hides secondary stats for side-by-side display in Live Shelf

**CR-to-XP Table:**
```js
{"0": 10, "1/8": 25, "1/4": 50, "1/2": 100, "1": 200, "2": 450,
 "3": 700, "4": 1100, "5": 1800, "6": 2300, "7": 2900, "8": 3900,
 "9": 5000, "10": 5900, "11": 7200, "12": 8400, "13": 10000,
 "14": 11500, "15": 13000, "16": 15000, "17": 18000, "18": 20000,
 "19": 22000, "20": 25000, "21": 33000, "22": 41000, "23": 50000,
 "24": 62000, "25": 75000, "26": 90000, "27": 105000, "28": 120000,
 "29": 135000, "30": 155000}
```

### 7. Spells Library

**Data Source:** Bundle the complete 5e SRD spell list as a static JSON file at `/src/data/spells.json`. Source: github.com/5e-bits/5e-database (the `5e-SRD-Spells.json` file). Do NOT fetch from API — bundle for offline use and instant load.

**Filter Bar (sticky at top):**
- Text search (name + description)
- Level filter (Cantrip through 9th)
- School filter (8 schools)
- Class filter (8 classes)
- Concentration toggle (Yes/No/All)
- Ritual toggle (Yes/No/All)
- Source filter (All / SRD / Homebrew)
- Show match count: "Showing 23 of 302 spells"
- Clear filters button

**Spell List:** Compact rows showing Name, Level, School, Casting Time, Range, Concentration (C icon), Ritual (R icon). Sortable columns. Click to expand inline showing full spell detail.

**Custom Spells:** "+ Create Spell" button opens a modal with all spell fields. Custom spells are scoped to the campaign and saved to `custom_spell` table. Display alongside SRD spells with a "Homebrew" badge. Custom spells are editable/deletable; SRD spells are read-only.

**Live Shelf Integration:** "Pin to Shelf" button on each spell. Pinned spells show as compact cards: name, level, casting time, range, duration, full description.

**School Color Coding** (subtle left border or pip):
- Abjuration: blue
- Conjuration: amber/gold
- Divination: teal
- Enchantment: pink
- Evocation: red/coral
- Illusion: purple
- Necromancy: gray
- Transmutation: green

### 8. Player Characters

**Philosophy:** The character sheet is a reference card. Players use the exported PDF + a notebook + pen at the table. Nothing is "live tracked" in Sideboard — no current HP edits, no spell slot toggles, no death save tracking. The digital view is purely an editing/staging step between PDF import and PDF export, used by the DM (not the player).

**Workflow:**
1. Player exports their character from D&D Beyond as a PDF
2. DM uploads the PDF in Sideboard
3. Parser extracts data into the structured form
4. DM reviews and edits in the digital view (this is where custom items, level-ups, etc. get added)
5. DM exports a clean utility-focused PDF for the player to use at the table

**PDF Parser:**
Use `pdfjs-dist` server-side. Parse all pages of D&D Beyond exports. Extract:
- Character name, class/level, subclass
- Ability scores
- Skill modifiers (look for the format `+N SkillName ABILITY`) — store final values in `skill_modifiers` jsonb
- Save modifiers (look for `+N AbilityName` in saves section) — store in `save_modifiers` jsonb
- Proficiency level for each skill/save (parse the indicator characters D&D Beyond uses for none/half/proficient/expertise) — store in `*_proficiencies` jsonb. If detection fails, default to "none" and let user fix in edit view.
- AC, initiative, HP max, hit dice, speeds, proficiency bonus, passives, senses
- Attacks (name, atk bonus, damage, type, notes)
- Damage resistances, immunities, condition immunities
- Armor/weapon proficiencies, languages, tools
- Class features, racial traits, feats — **CONDENSE to one-line summaries**, not full rules text. If the parser can't reliably condense, store name + leave summary blank for DM to fill.
- Class resources (bardic inspiration uses, ki points, etc.) — extract from features text
- Equipment, currency
- Spells: detect spellcasting class, ability, save DC, attack bonus. Spell list grouped by level. Detect if prepared caster.

After parsing, show review screen with all extracted fields editable. Highlight fields that couldn't be parsed.

**Spell Slots — Auto-populate from class+level lookup table** (DO NOT parse from PDF):

Create `/src/data/spell-progression.ts` with:

*Full casters (Bard, Cleric, Druid, Sorcerer, Wizard):* Standard table — 2 slots at L1 1st, building up to 4/3/3/3/3/2/2/1/1 at L20. Cantrips known: Bard 2→3→4 (L1/4/10), Cleric 3→4→5, Druid 2→3→4, Sorcerer 4→5→6, Wizard 3→4→5.

*Half casters (Paladin, Ranger):* Slots start at L2. Building to 4/3/3/3/2 at L19+.

*Third casters (Eldritch Knight Fighter, Arcane Trickster Rogue):* Slots start at L3. Building to 4/3/3/1 at L19+.

*Warlock (Pact Magic):* Special — store as `pact_slot_level` and `pact_slot_count`. L1: 1 slot at L1. L2: 2 slots at L1. L3: 2 slots at L2. L5: 2 slots at L3. L7: 2 slots at L4. L9: 2 slots at L5. L11: 3 slots at L5. L17+: 4 slots at L5.

*Non-casters:* No spells.

After parsing, override any spell slot values from the PDF with the lookup table values. Multiclass: use the highest-level class for slots and add a note in edit view that user should manually verify.

**Digital Edit View:**
Form-based editor organized in sections matching the PDF output. NOT a live play tool — the DM uses this to fix parsing errors, add custom items mid-campaign, update after level-up.

For the Ability Scores section, each ability shows:
- Score input (large) with calculated modifier next to it
- Save row: editable modifier number + dropdown [None | Proficient]
- Each skill: skill name, editable modifier number, dropdown [None | Half | Proficient | Expertise]
- The proficiency dropdowns are metadata (not used in calculation) — the modifier values are pre-calculated and stored

Other sections: Combat (AC, init, HP max, speeds, hit dice), Attacks table (name, atk, damage, type, notes), Defenses, Proficiencies (armor/weapon bubbles, languages, tools), Class Resources (name, uses, die, recovery), Class Features (name + one-line summary), Racial Traits, Feats, Inventory, Currency, Spellcasting (toggle, ability, attack bonus, save DC, prepared toggle, slot table, spell list grouped by level with prepared checkboxes for prepared casters).

Buttons at bottom: Save, Export PDF, Re-upload PDF (for level-ups, pre-fills don't auto-save), Delete Character.

**PDF Export — Three Pages:**

**Page 1: Combat Reference**

*Top header band (full width):* Decorative top border (thin maroon line), character name (large Cinzel Bold 20pt), right side: "Class — Subclass — Level", below name: player name italic. Decorative bottom border.

*Quick stats bar:* Horizontal strip with labeled boxes separated by thin vertical lines, parchment background. Boxes for: PROF, PASSIVE PERC, PASSIVE INSIGHT, PASSIVE INV, INIT, AC, HP, HIT DICE, SPEED. Small uppercase gray label above value (12pt bold maroon).

*Ability Scores section (left ~40% of page):* Six bordered boxes in a 2-column × 3-row grid (STR/DEX, CON/INT, WIS/CHA). Each box:
- Header: ability name in maroon centered, large modifier (e.g. "+1") prominent, raw score smaller below
- Thin horizontal divider
- "Save: +1" line (right-aligned modifier)
- Skills under that ability listed below (skill name left, modifier right)
- Cards with thin maroon borders, parchment background, slight padding
- WIS box must fit 5 skills; CHA must fit 4

*Right side, top to bottom:*
- ATTACKS table (4 columns: Name, Atk, Damage, Type) with maroon header row, alternating parchment rows
- SENSES & DEFENSES block (only show lines with data)
- CLASS RESOURCES block (each as a row: name | uses+die | recovery)
- PROFICIENCIES block: Armor row with filled/empty bubbles (● Light  ○ Medium  ○ Heavy  ○ Shields), Weapons row (● Simple  ○ Martial), Languages, Tools

*Below all of the above (full width):*
- CLASS FEATURES — two-column layout, each as "Feature Name. One-sentence summary."
- RACIAL / SPECIES TRAITS — same format
- FEATS — same format

If page 1 has space, inventory can fit at bottom. Otherwise inventory gets its own page.

**Page 2: Inventory (if needed)**

Same character header. INVENTORY table (4 columns: Item, Qty, Weight, Notes) on left ~60%. CURRENCY block on right (CP, SP, EP, GP, PP) plus total wealth in GP equivalent. Empty NOTES section below currency for ad-hoc reminders (the only place a player might write).

**Page 3: Spells (casters only)**

Character header + "Spells" subtitle.

*Spell stats bar:* SPELL ATK, SPELL DC, ABILITY (same styling as quick stats bar).

*Spell Slots:* Header + row of 9 boxes (1st through 9th), each showing slot count. For warlock: single box showing pact slot level + count.

*For each spell level with spells:*
Section header (e.g. "CANTRIPS" or "1ST LEVEL") in Cinzel Bold maroon, centered with thin maroon lines on either side.

*For each spell, render a SPELL CARD:*
```
+--------------------------------------------------+
| ELDRITCH BLAST                          ● Prepared|
| Evocation cantrip                                  |
| Casting Time: 1 Action     Range: 120 ft.          |
| Components: V, S          Duration: Instantaneous  |
|                                                    |
| A beam of crackling energy streaks toward a        |
| creature within range...                           |
|                                                    |
| At Higher Levels: ...                              |
+--------------------------------------------------+
```

Each card: spell name (bold maroon ~12pt), prepared indicator on right (only for prepared casters), level + school italic, 2-column row for Casting Time | Range, 2-column row for Components | Duration, full description, "At Higher Levels" if applicable.

**Pull spell descriptions from `/src/data/spells.json` (the SRD library) by matching spell name (case-insensitive, fuzzy). For homebrew spells not in SRD, render only name and level.**

Spells flow across multiple pages if needed.

**PDF Technical Requirements:**

*Encoding:* All special characters must render correctly. Use:
- Bullet `•` (U+2022)
- Filled circle `●` (U+25CF)
- Empty circle `○` (U+25CB)
- Diamond `◆` (U+25C6) for ornaments

Test the proficiencies section specifically — broken bubble characters were a previous issue.

*Fonts:* Use Cinzel for headers, Crimson Text for body, fall back to Garamond / Times-Roman if custom fonts can't be embedded.

*Layout:*
- Parchment cream background `#F4E4C1`
- Maroon headers `#58180D`, dark brown body `#1A1210`
- Borders: muted gold `#B8860B` or maroon
- Table header: maroon background, cream text
- Alternating row colors: `#EDD6A8` and `#F4E4C1`
- 0.5 inch margins
- Section headers have thin maroon underlines
- Thin gold horizontal rules with centered diamond ornaments between major sections
- Visible borders on tables, not just whitespace

**Players Page:**
Card grid. Each card: character name, player name, class/subclass/level, AC, HP max, passive perception. Buttons: Edit, Export PDF, Re-upload PDF, Pin to Shelf, Delete (with confirmation). Top of page: "Upload Character PDF" and "Create Manually" buttons.

**Live Shelf Card (DM reference):**
Name, class, level, AC, HP max, passive perception, all six save modifiers on one line, senses, resistances/immunities. This is what the DM glances at to answer "what's the bard's WIS save? Does the warlock have fire resistance?"

### 9. Quick Reference

Static D&D 5e rules reference page at the second-to-last spot in the sidebar. Collapsible sections with a sticky search bar that auto-expands and highlights matching sections.

**Six logical groups:**

1. **COMBAT** — Actions in Combat (Attack, Cast Spell, Dash, Disengage, Dodge, Help, Hide, Ready, Search, Use Object, Use Special Ability), Attack Types (Melee, Ranged, Opportunity, Two-Weapon, Grappling, Shoving), Cover (half +2, three-quarters +5, total), Damage Types (all 13 with one-line descriptions)

2. **SPELLCASTING RULES** — Casting Rules (bonus action spells, focus, casting in armor, attack rolls, save DCs, clear path, targeting yourself), Components (V, S, M), Duration & Concentration (instantaneous, concentration rules, combining magical effects)

3. **HEALTH & REST** — Resting (short, long), Dropping to 0 HP (death saves, rolling 1 or 20, damage at 0 HP, instant death, falling unconscious, stabilizing)

4. **MOVEMENT & ENVIRONMENT** — Movement (difficult terrain, climbing/swimming/crawling, long jump, high jump, falling), Travel Pace table, Light & Vision (bright/dim/darkness, vision abilities), Suffocating, Carrying Capacity

5. **CONDITIONS** — All 14 conditions + Exhaustion levels table. Each condition as its own mini-card with name in bold maroon. This section should be visually prominent — DMs reference it constantly.

6. **REFERENCE TABLES** — Difficulty Classes, Skills by Ability Score, Encounter Difficulty (XP per character per level table 1-20 with Easy/Medium/Hard/Deadly), Encounter Multipliers, Damage Severity by Level, Object AC, Costs & Services (food/lodging, services, lifestyle expenses)

Use medieval styling: maroon headers, Crimson Text body, parchment card backgrounds, alternating row shading on tables, section dividers with diamond ornaments between groups.

### 10. Audio

**Ambient Music:**
5-8 mood presets, each with a looping ambient track. Moods: tavern/celebration, tense combat, tranquil forest, mysterious/dungeon, city bustle, ocean/sailing, sacred/temple, dark/foreboding. One-click switching with crossfade. Volume slider. Tracks bundled at `/public/audio/ambient/`.

Filenames: `tavern.mp3`, `combat.mp3`, `forest.mp3`, `dungeon.mp3`, `city.mp3`, `ocean.mp3`, `temple.mp3`, `dark.mp3`.

**Sound Effects:**
12 buttons in a grid. Filenames at `/public/audio/sfx/`:
- `sword-clash.mp3`
- `arrow.mp3`
- `gunshot.mp3`
- `fireball.mp3`
- `door-creak.mp3`
- `thunder.mp3`
- `healing.mp3`
- `dark-magic.mp3`
- `coins.mp3`
- `crowd-gasp.mp3`
- `monster-roar.mp3`
- `glass-shatter.mp3`

Click to play, fire-and-forget. Mixed on top of ambient (does not interrupt).

**Implementation:**
Web Audio API. Ambient: single AudioBufferSourceNode with loop=true, GainNode for volume, crossfade on switch. SFX: fire-and-forget on click. Total bundle ~30-50MB.

**Audio in Live Shelf:**
Compact audio control bar at the bottom of the Live Shelf — mood selector + SFX buttons accessible without leaving the current page. Even when no audio files are loaded, the buttons render in disabled/placeholder state with labels visible.

**Sourcing (manual step):**
- Ambient tracks: Pixabay Music (free, no attribution, well-tagged) is best primary source. OpenGameArt and Incompetech as backups. Tabletop Audio is great quality but licensing for embedded use needs verification.
- SFX clips: Freesound.org is best for short clips. CC0 licensing preferred.

---

## File Structure

```
sideboard/
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root layout, font imports, favicon
│   │   ├── page.tsx                    # Landing/campaign selector
│   │   ├── login/page.tsx              # Single "Sign in with Google" button
│   │   ├── auth/callback/route.ts      # OAuth callback handler
│   │   ├── export/page.tsx             # One-time local data export
│   │   ├── campaign/[id]/
│   │   │   ├── layout.tsx              # Campaign layout with sidebar + shelf
│   │   │   ├── page.tsx                # Overview / world meta
│   │   │   ├── builder/page.tsx        # Campaign Builder chat
│   │   │   ├── lore/page.tsx
│   │   │   ├── plots/page.tsx
│   │   │   ├── npcs/page.tsx
│   │   │   ├── npcs/[npcId]/page.tsx
│   │   │   ├── locations/page.tsx
│   │   │   ├── factions/page.tsx
│   │   │   ├── items/page.tsx
│   │   │   ├── spells/page.tsx
│   │   │   ├── sessions/page.tsx
│   │   │   ├── sessions/[sessionId]/page.tsx
│   │   │   ├── bestiary/page.tsx
│   │   │   ├── players/page.tsx
│   │   │   ├── players/[pcId]/page.tsx # Edit view
│   │   │   ├── reference/page.tsx      # Quick Reference
│   │   │   └── audio/page.tsx
│   │   └── api/
│   │       ├── ai/builder/route.ts            # Campaign Builder (Opus 4.7)
│   │       ├── ai/process-log/route.ts        # Session log AI extraction
│   │       ├── ai/lore-suggestions/route.ts   # Post-session lore suggestions
│   │       ├── ai/generate-npc/route.ts       # Quick NPC generation
│   │       ├── ai/lore-question/route.ts      # Answer questions about world
│   │       ├── parse-character/route.ts       # D&D Beyond PDF parser
│   │       └── export-character/route.ts      # Character PDF export
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── LiveShelf.tsx
│   │   │   ├── ShelfCard.tsx
│   │   │   └── SectionDivider.tsx
│   │   ├── campaign/
│   │   │   ├── WorldMetaEditor.tsx
│   │   │   ├── LoreEntryForm.tsx
│   │   │   ├── PlotArcCard.tsx
│   │   │   ├── NPCCard.tsx
│   │   │   ├── NPCForm.tsx
│   │   │   ├── NPCCompactCard.tsx       # Live Shelf view
│   │   │   ├── LocationCard.tsx
│   │   │   ├── FactionCard.tsx
│   │   │   └── ItemForm.tsx
│   │   ├── builder/
│   │   │   ├── ChatInterface.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── SaveCard.tsx             # Inline save proposal cards
│   │   │   └── ContextIndicator.tsx
│   │   ├── session/
│   │   │   ├── SessionList.tsx
│   │   │   ├── SceneBuilder.tsx
│   │   │   ├── EncounterBuilder.tsx
│   │   │   ├── SessionLog.tsx
│   │   │   └── LoreSuggestionCard.tsx
│   │   ├── bestiary/
│   │   │   ├── StatBlockForm.tsx
│   │   │   └── StatBlockDisplay.tsx     # Reusable display component
│   │   ├── spells/
│   │   │   ├── SpellList.tsx
│   │   │   ├── SpellFilters.tsx
│   │   │   ├── SpellCard.tsx
│   │   │   ├── SpellDetail.tsx
│   │   │   └── CreateSpellModal.tsx
│   │   ├── characters/
│   │   │   ├── CharacterCard.tsx        # Players page grid card
│   │   │   ├── CharacterEditView.tsx
│   │   │   ├── AbilityScoreBlock.tsx
│   │   │   ├── PDFUploader.tsx
│   │   │   └── CharacterShelfCard.tsx   # Live Shelf compact view
│   │   ├── reference/
│   │   │   ├── ReferenceSection.tsx
│   │   │   └── SearchBar.tsx
│   │   ├── audio/
│   │   │   ├── AmbientPlayer.tsx
│   │   │   ├── SFXBoard.tsx
│   │   │   └── AudioControlBar.tsx      # Compact bar in Live Shelf
│   │   └── shared/
│   │       ├── SearchModal.tsx          # Cmd+K global search
│   │       ├── EntityPicker.tsx
│   │       └── ConfirmDialog.tsx
│   ├── data/
│   │   ├── spells.json                  # SRD spell library (bundled)
│   │   ├── spell-progression.ts         # Class+level → spell slots
│   │   └── reference.ts                 # Quick Reference content
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── middleware.ts
│   │   ├── ai/
│   │   │   ├── client.ts
│   │   │   ├── context-builder.ts       # Assembles campaign state for AI
│   │   │   ├── prompts.ts               # System prompts (incl. builder)
│   │   │   └── builder-parser.ts        # Parse :::save::: blocks
│   │   ├── pdf/
│   │   │   ├── dnd-beyond-parser.ts
│   │   │   └── character-export.ts      # PDF generation
│   │   ├── audio/
│   │   │   └── audio-manager.ts         # Web Audio API wrapper
│   │   ├── stat-block.ts                # CR-to-XP, modifier calc helpers
│   │   └── utils.ts
│   ├── stores/
│   │   ├── shelf-store.ts
│   │   └── audio-store.ts
│   └── types/
│       └── index.ts
├── public/
│   ├── logo.png
│   ├── favicon.png
│   ├── favicon.ico
│   ├── apple-touch-icon.png
│   └── audio/
│       ├── ambient/
│       └── sfx/
├── supabase/
│   └── migrations/
├── package.json
└── next.config.js
```

---

## Environment Variables

Required in both `.env.local` and Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`

---

## Build Priorities

If starting fresh, build in this order:

1. **Foundation** — Next.js + Supabase + Vercel + Google OAuth + base navigation shell with logo
2. **Core CRUD** — Campaigns, world meta, lore, plot arcs, NPCs, locations, factions, items
3. **Sessions** — Session list, prep view (scenes + encounters), log view with AI processing
4. **Bestiary** — Stat block form + reusable display component
5. **Live Shelf** — Right panel, pinning, NPC compact cards, stat block side-by-side
6. **Campaign Builder** — Chat interface with Opus 4.7, system prompt, inline save cards
7. **Spells** — Bundle SRD JSON, filter UI, custom spells, pin to shelf
8. **Player Characters** — Data model, PDF parser, edit view, PDF export with all three pages
9. **Quick Reference** — Static content with search
10. **Audio** — Web Audio implementation, mood selector, SFX board
11. **Polish** — Atmosphere pass on styling, font upgrades, parchment textures, decorative elements

---

## Critical Implementation Notes

**Skill modifiers and save modifiers are stored pre-calculated.** No calculation at display time. The proficiency dropdowns in the edit view are metadata only — they don't affect the final modifier value. This matches the philosophy that the character sheet is a reference card.

**Spell slots are looked up from class+level, not parsed from PDF.** D&D Beyond's PDF format for slots is inconsistent. Use the static lookup table.

**Character features get one-line summaries, not full rules text.** The PDF parser should condense. Players don't need rules reminders — they know their class. They need a quick "what can I do" reference.

**The Live Shelf is the differentiator.** Almost every entity in the app should have a "Pin to Shelf" button. The shelf is what makes mid-session retrieval fast.

**The Campaign Builder uses Opus 4.7 specifically.** All other AI features use Sonnet. This is the only place writing quality justifies the cost.

**The PDF export pulls spell descriptions from the SRD library.** Don't re-fetch or re-store. Match by spell name (case-insensitive, fuzzy).

**Special characters in PDFs must use specific Unicode codepoints.** Bullet U+2022, filled circle U+25CF, empty circle U+25CB, diamond U+25C6. Test specifically with the proficiencies section.

**The atmosphere is non-negotiable.** Cinzel Decorative for the logo, IM Fell English SC for headings, Crimson Text for body. Parchment, maroon, gold. Section dividers with diamond ornaments. Cards in the Live Shelf with slight rotation. Stat blocks matching official 5e formatting. The app should feel like a beautifully bound DM screen, not a clean modern SaaS.
