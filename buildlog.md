# Sideboard Build Log

A running technical record of what's actually in the codebase, what's stubbed, and what's still on the spec but unbuilt. Append to the Changelog at the bottom on every commit.

The canonical product spec is `sideboard-spec-v2.md`. This file is the implementation snapshot — what does the code actually do today.

---

## Stack Snapshot

- **Runtime:** Next.js 16.1.7 (App Router), React 19.2, TypeScript 5
- **Styling:** Tailwind CSS v4, Google Fonts (Cinzel Decorative, IM Fell English SC, Crimson Text, Geist Mono)
- **State:** Zustand (`shelf-store` only); no global app store. Per-page data fetched via the `useCampaignData` hook over `createSupabaseStore<T>` table wrappers
- **Backend:** Supabase (Postgres + Auth + Storage). Google OAuth only. RLS enforced on every table via `campaign_id → campaigns.user_id = auth.uid()`
- **AI:** `@anthropic-ai/sdk` v0.80. Streaming endpoints live: `/api/builder` (Fable 5) and `/api/ai/character-advisor` (Sonnet 4.6). Other planned AI endpoints are unbuilt
- **PDF:** `pdfjs-dist` v4.10 server-side for D&D Beyond import; `jsPDF` v4.2 for character-sheet export
- **Deploy:** Vercel, custom domain `dmsideboard.com` (with `sideboard.vercel.app` fallback per spec)

---

## What's Built (by area)

### Auth & Foundation
- Google OAuth via Supabase SSR (`@supabase/ssr` v0.9). Flow: `/login` → `/auth/callback` → root
- Session refresh middleware at `src/middleware.ts` → `src/lib/supabase/middleware.ts:updateSession`. Runs on all paths except static asset extensions
- Three Supabase clients: `client.ts` (browser), `server.ts` (server components), `middleware.ts` (request refresh)
- Campaign selector at `src/app/page.tsx`: list + create + delete + sign out, full-bleed logo
- Root layout (`src/app/layout.tsx`) wires four Google Font CSS variables: `--font-logo` (Cinzel Decorative), `--font-heading` (IM Fell English SC), `--font-body` (Crimson Text), `--font-geist-mono`
- Favicons (16/32/ico/apple) and full wordmark logo at `/public/`

### Campaign Layout
- `src/app/campaign/[id]/layout.tsx` is the workbench shell: `<Sidebar>` + scrolling `<main>` + `<LiveShelf>` + global `<SearchModal>` (Cmd+K)
- Sidebar: 13 nav items (Audio is intentionally absent — feature unbuilt). Collapsible (« / »), warm-gold active treatment, dark wood/leather palette
- Section ornaments and decorative gold dividers via `SectionDivider` shared component

### Campaign CRUD
All 8 entity types fully wired with create/read/update/delete:

| Entity | Page | Form/Card |
|---|---|---|
| World Meta | overview | `WorldMetaEditor` (singleton per campaign) |
| Lore | `/lore` | `LoreEntryForm` |
| Plot Arcs | `/plots` | `PlotArcCard` |
| NPCs | `/npcs`, `/npcs/[id]` | `NPCForm`, `NPCCard` |
| Locations | `/locations` | `LocationCard` |
| Factions | `/factions` | `FactionCard` |
| Items | `/items` | `ItemForm` |
| Sessions | `/sessions`, `/sessions/[id]` | `SessionList`, `SceneBuilder`, `EncounterBuilder` |

The `useCampaignData(store, campaignId)` hook returns `{ items, loading, create, update, remove, refresh }` and is the standard data-binding pattern across pages.

The data layer (`src/lib/data/`) exposes 16 typed stores all built from the same `createSupabaseStore<T>` factory (`getAll(filter)`, `getById`, `create`, `update`, `delete`). Every query passes through Supabase RLS, so there's no manual user-scope check in app code.

### Campaign Builder (AI, Fable 5)
The only AI endpoint live in code today.

- API: `src/app/api/builder/route.ts` — `client.beta.messages.stream` with `model: 'claude-fable-5'`, max 64000 tokens (Fable's always-on thinking counts against the cap), server-side refusal fallback (`fallbacks: 'default'` + beta `server-side-fallback-2026-07-01`), SSE-formatted ReadableStream back to the browser. A `stop_reason: 'refusal'` on the final message is surfaced to the client as an SSE error event
- System prompt: `src/lib/builder/system-prompt.ts` (~150 lines). Encodes the Iceberg, Anti-Complexity, Anti-Theme-Saturation rules; the 5 conversation phases; the `:::save:TYPE\n{json}\n:::` proposal protocol with full examples for all 6 types
- Context assembly: `src/lib/builder/context-builder.ts:buildCampaignContext(campaignId)` formats world meta + lore titles + locations + factions + NPCs + plot arcs + sessions into readable text and injects into the system prompt every turn. Also exports `getCampaignStats` for the chat header indicator
- Save-block parser: `src/lib/builder/parse-proposals.ts` exposes `parseProposals` (extract) and `segmentContent` (interleave text and proposal cards in render). Single regex `/:::save:(\w+)\s*\n([\s\S]*?)\n:::/g`, JSON-parses payload, drops malformed blocks
- UI: `src/components/builder/BuilderChat.tsx` renders streamed text via a hand-rolled `MarkdownText` (regex transform → dangerouslySetInnerHTML, no library) and `SaveCard` for each proposal. Save card buttons: Save / Edit & Save / Dismiss. Edits open a modal that auto-textarea/inputs based on field length. Saved state is persisted on `builder_message.proposed_elements[i].saved`

### Sessions
- List + create form (title, session_number with auto-increment default, status, date)
- Session detail (`/sessions/[sessionId]`): summary + prep notes editor, scene list (via `SceneBuilder`), encounter list per scene (via `EncounterBuilder`)
- Encounters reference stat blocks by `stat_block_ids: UUID[]`
- **Not built:** session-log AI processing (recap, key events, revelations, NPC interactions, suggested lore entries). Tables exist (`session_logs`); no AI endpoint or UI

### Bestiary
- Full stat block CRUD with `StatBlockForm` and reusable `StatBlockDisplay` (used in bestiary list and any other surface that needs official-5e-formatted output)
- Helpers in `src/lib/stat-block-utils.ts` (CR-to-XP table, modifier calc)

### Spells
- Bundled SRD data: `src/data/spells.json` (360 KB, 5e-bits export, used statically — no fetch)
- Filter UI on `/spells`: text search, level, school, class, concentration, ritual, source. Match count + clear button
- Custom (homebrew) spells in `custom_spells` table (migration 004), full create form with all fields
- Pin spell to Live Shelf; shelf renders compact card with level/school/casting time/range/duration/description via `SpellDetail`
- Spell migration #004 enabled RLS

### Player Characters
- Data model lives entirely in migration 005 (replaces 001's stub player_characters table). All ability scores, pre-calculated skill/save modifier jsonbs, attack/feature/equipment/resource jsonbs, full spellcasting block (slots + pact slots + prepared spells), currency
- **PDF in:** `src/app/api/parse-character/route.ts`. Reads PDF *form-field annotations* (not text content) — D&D Beyond stores all values as named form fields. Extracts identity, ability scores, skill/save modifiers, attacks (Wpn Name N + atk bonus + damage), proficiencies (regex-split `=== ARMOR ===` style sections), defenses, features (one-line summaries from `FeaturesTraits1..10`), equipment (`Eq Name0..30`), currency, and spells (level boundaries detected via `spellHeader` annotations interleaved in PDF order)
- **PDF out:** `src/app/api/export-character/route.ts`. Two-page jsPDF render: page 1 (combat reference: maroon header band, ability + skill cards, combat stats grid, attacks table, class resources, proficiencies with filled/empty Unicode dots, defenses, two-column features, racial traits, feats, inventory, currency line), page 2 (spells: spellcasting stats, spell-slot boxes, two-column spell list grouped by level with prepared/unprepared dot indicators, pact slots for warlocks)
- Edit view at `/players/[pcId]` (over 80 React state hooks for the full sheet); `pcId === 'new'` is a manual-create flow; `?parsed=true` flag pre-fills from a parse response
- Players card grid at `/players` with `PlayerCard`. Live Shelf compact view via `PCDetail` (class/level/AC/HP/PP + saves on one row + senses + resistances/immunities)
- Recent fixes: parser switched from text-content reading to form-field annotations (`efdf9db`); proficiency parsing switched from naive split to regex section detection (`d7cc783`)

### Quick Reference
- `/reference` — fully static D&D 5e rules content embedded as `REFERENCE_DATA: ReferenceGroup[]`
- Six logical groups: Combat, Spellcasting Rules, Health & Rest, Movement & Environment, Conditions, Reference Tables
- Sticky search bar with auto-expansion of matching sections; supports list/table/conditions/custom section types

### Live Shelf
- Right-side toggleable panel, Zustand-backed (`useShelfStore` in `src/stores/shelf-store.ts`)
- API: `addItem({ id, type, label, data })`, `removeItem(id)`, `toggle/open/close/clear`. Dedups by id
- Detail renderers in `LiveShelf.tsx`: only `SpellDetail` and `PCDetail` are implemented today. NPCs / locations / stat blocks / etc. would render as label-only via the generic `ShelfCard`

### Search
- Cmd+K modal (`SearchModal`) searches NPCs, locations, factions, items, lore by name. Linked to detail pages where they exist (NPCs have `/npcs/[id]`; others link to the list)

### One-time Migration Tooling
- `/export` route exports user data as JSON (predates Supabase wiring)
- `scripts/import-to-supabase.ts` ingests `local-data-export.json` into hosted Supabase using the service-role key. One-shot migration utility, not part of normal app flow

---

## Database

Five migrations in `supabase/migrations/`:

1. `001_initial_schema.sql` — campaigns, world_meta, lore_entries, plot_arcs, locations, factions, npcs, items, sessions, scenes, encounters, stat_blocks, session_logs, player_characters (stub). Enums for lore_category, plot_status, session_status, item_type. RLS commented out
2. `002_builder_messages.sql` — adds `builder_messages` (campaign_id, role, content, proposed_elements jsonb)
3. `003_rls_policies.sql` — enables RLS on every table from 001+002 and writes campaign-ownership policies. Scenes/encounters/session_logs are gated transitively through sessions → campaigns
4. `004_custom_spells.sql` — `custom_spells` table + RLS
5. `005_enhanced_player_characters.sql` — drops the stub from 001 and recreates `player_characters` with the full sheet model (ability scores, jsonb skill/save modifiers, attacks, proficiencies, full spellcasting, class resources, equipment, currency, pdf_url). Has its own RLS policy

Note: 001 originally created `player_characters` with only `armor_class`, `hit_points`, `backstory`. Migration 005 is a destructive recreate. The TypeScript model in `src/types/index.ts:PlayerCharacter` matches 005, not 001.

---

## Not Yet Built (per spec)

- **Audio (Phase 10).** No `/audio` route, no Audio sidebar nav item, no `public/audio/` directory, no `audio-manager.ts`, no SFX board, no `AudioControlBar` in the Live Shelf. Audio is the largest still-unbuilt phase
- **AI endpoints beyond the builder:**
  - `ai/process-log` — recap / key events / revelations / NPC interactions extraction from raw notes
  - `ai/lore-suggestions` — post-session lore-entry proposals
  - `ai/generate-npc` — quick NPC generation
  - `ai/lore-question` — answer questions about the world
  These are the planned Sonnet 4.6 surfaces; none have been implemented
- **Spec deviations to be aware of:**
  - PDF export emits 2 pages (Combat + Spells). The spec describes a 3-page layout (Combat, Inventory, Spells) — current implementation puts inventory on page 1 if it fits
  - Stat block `traits/actions/reactions/legendary_actions` are TEXT in the schema, not jsonb arrays as the spec describes. The form uses the text-with-blank-line-separation format the spec calls for, but parsing into `{name, description}` happens at display time
  - NPC schema (`src/types/index.ts:NPC` and migration 001) uses `description / personality / motivations / secrets / connections` rather than the spec's `backstory / goal / fear / leverage / knowledge / knowledge_free / knowledge_check / quirk / voice_notes`. The Builder save flow flattens the spec's NPC shape into the simpler schema
  - Live Shelf only has detail renderers for `Spell` and `Player Character` — NPCs, stat blocks, locations, etc. would currently render as label-only cards
  - Spec lists `spell-progression.ts` (class+level → spell slots lookup) — not in the codebase. Player edit view treats slots as user-entered

---

## Known Quirks

- `parseSpells` in `parse-character/route.ts` has a long history of attempted approaches preserved in comments. The working code path uses `parseSpellsFromAnnotations` driven by the `spellOrder` array assembled during PDF annotation iteration in `extractFormFields`
- The `MarkdownText` component in `BuilderChat.tsx` uses regex → `dangerouslySetInnerHTML`. Safe because input is a streamed assistant response, but worth noting
- `local-data-export.json` at the project root is a leftover from the pre-Supabase data layer and is consumed by `scripts/import-to-supabase.ts`
- Supabase column names use snake_case throughout; the TS types match exactly so no field-mapping layer is needed

---

## Changelog

Append a dated entry per commit. Keep it tight: what changed, why, file references where useful.

### 2026-07-25 — PDF export: Pact Magic legend for warlocks

- `src/app/api/export-character/route.ts` — the spells page's pact-slot box now renders a legend explaining warlock casting economies: all pact spells cast at the pact slot level, slots return on Short Rest, and bracket markers on spell names ([At Will] invocation / [R] ritual, no slot / [1/LR] free trait casting). Markers ride in the spell-name strings, and `findSpell` already strips trailing brackets so description lookup is unaffected.
- Data: Marten's spells marked (Disguise Self [At Will] via Mask of Many Faces; Tenser's/Speak with Animals [R] via Pact of the Tome; Hellish Rebuke/Darkness [1/LR] via Infernal Legacy); Pact Magic feature summary now states the 2×3rd-level slot rule; Pact Magic Slots + both Infernal Legacy casts added to class resources.

### 2026-07-25 — PDF export: right-column overflow uses full width

- `src/app/api/export-character/route.ts` — when Racial Traits / Feats overflow page 1's right column onto a continuation page, they previously stayed boxed to the right half. The page-break callback now releases the column constraint (x → left margin, width → full page) and `drawFeatureBlock` re-wraps the overflowing feature at the new width. Data-side: trimmed redundant 2024-Human boilerplate traits (Skillful/Versatile/Languages — covered by the numbers and Languages line) from Ren, Donovan, and Tobin; added Sneak Attack (1d6, once per turn) to Ren's class resources.

### 2026-07-25 — PDF export: class-resources column collision

- `src/app/api/export-character/route.ts` — `drawClassResources` right-aligned the recovery text on the same line as the uses column with no width check, so long strings ("Long Rest (regain 1 on Short Rest)") overlapped. Now measures both and wraps the recovery text to its own line on collision. Also "1 uses" → "1 use".

### 2026-07-25 — PDF export: sanitize non-WinAnsi characters

- `src/app/api/export-character/route.ts` — the built-in Times font only covers WinAnsi (CP1252); characters outside it (e.g. `→`) rendered as mojibake (`!'`) and corrupted jsPDF's glyph-width math, stretching the whole line's letter spacing. Added `sanitizeWinAnsi` (transliteration map: arrows → `->`, checkmarks, prime marks, ligatures, NFKD diacritic fallback, `?` as last resort) and `hardenPdfText`, which wraps `doc.text` and `doc.splitTextToSize` once at document creation so every string is sanitized at the entry point rather than at ~40 call sites. Also cleaned the one DB row that contained a `→` (Tobin's Font of Magic).

### 2026-07-25 — Spell lookup: strip DDB bracket markers

- `src/app/api/export-character/route.ts` — `findSpell` now strips trailing bracketed markers (`"Ceremony [R]"` → `"Ceremony"`) before matching against the SRD/custom libraries. D&D Beyond sheets tag ritual spells with `[R]` in the spell name, so every ritual spell on every imported sheet was silently failing description lookup in the PDF export.

### 2026-07-24 — Campaign Builder moved to Claude Fable 5

- `src/app/api/builder/route.ts` — model `claude-opus-4-7` → `claude-fable-5`, switched to `client.beta.messages.stream`. Fable-specific changes: `max_tokens` 4096 → 64000 (thinking is always on and shares the cap — 4096 would truncate replies), opted into server-side refusal fallback (`fallbacks: 'default'`, beta `server-side-fallback-2026-07-01`, passed via spread since SDK 0.80 typings predate the param), and the stream now checks `finalMessage().stop_reason === 'refusal'` and emits an SSE error event so the chat doesn't render an empty reply
- `sideboard-spec-v2.md` — synced the same 5 model references (lines 42, 372, 746, 867, 886) to Fable 5
- Smoke-tested live against the dev server: request accepted, response streamed, org retention config compatible (Fable requires 30-day retention)

### 2026-04-29 — PDF export overhaul (Rowan Ashwell pass)

**Layout reorganization.** The right column under the ability-score grid was wasting vertical space below the Proficiencies block. Racial Traits and Feats moved from the bottom of the page into the right column under Proficiencies — they fill the previously blank area. Class Features now occupy the full page width below the larger of (left, right) columns.

**Top bar trimmed and clarified.** Dropped the three passive-stat boxes from the quick-stats bar (they live in Senses & Defenses now). Six boxes total: Proficiency Bonus, Initiative, Armor Class, Max HP, Hit Dice, Speed — full words, no abbreviations. Label font bumped from 6pt to 7pt now that boxes are wider.

**Senses & Defenses got the passives.** Three lines: Passive Perception, Passive Insight, Passive Investigation — full word "Passive" on each. Auto-calc fallback when the column is null: `10 + abilityMod + (proficient ? PB : expertise ? PB×2 : half-prof ? floor(PB/2) : 0)`, reading from `skill_proficiencies`. Damage Immunities / Condition Immunities labels also expanded from "Damage Imm." / "Condition Imm." to full words.

**Attacks table got a Range column** (5 columns: Name, Atk, Damage, Type, Range). Column widths re-balanced. Blank Range cells stay blank — no "5 ft." default fill.

**Feature formatting rewrite.** New `drawFeatureSection` / `drawFeatureBlock` helpers. Each feature: bold-italic name on its own line, description left-aligned with the name on the next line (no hang indent), ~4pt vertical gap before the next. Applies to Class Features, Racial Traits, and Feats consistently.

**Page-break safety.** Feature blocks are measured before drawing. If a block would overflow the page (`y + blockH > PH - bottomMargin`), the configured `onPageBreak` callback fires. For Class Features, that draws a fresh page with parchment background, page header (subtitle "Continued"), and a "CLASS FEATURES (CONTINUED)" section header so the reader knows the context. Right column overflow uses the same machinery.

**Right-column overflow detection.** If Racial Traits or Feats spill onto a new page, `gridBottomY` (from page 1) is no longer relevant — Class Features starts from `ry` on the current page rather than the cached page-1 ability-grid bottom.

**Arrow text corruption fixed.** The Great Weapon Fighting style's `d4→2, d6→3...` was rendering as `d4!'2, d6!'3...` because U+2192 (Rightwards Arrow) is outside jsPDF's default WinAnsi encoding. Replaced with the word "becomes" — readable across any font. Also caught and fixed two stray `→` in Magus and Heathbound Blade Dance descriptions ("DEX save for half →" → "DEX save for half:").

### 2026-04-29 — Spell stat calc + Heathbound class

**Spell save DC and attack bonus are now calculated, not stored.** They derive deterministically from `proficiency_bonus + abilityModifier(score for spellcasting_ability)`, with optional override columns for the rare magic-item / feature case.

- New `src/lib/character.ts` exposes `abilityModifier`, `abilityScoreFor`, `spellSaveDc`, `spellAttackBonus`, `modString` — single source of truth used by the edit page UI, PDF export, and any future surface that needs these numbers.
- Migration `008_spell_stat_overrides.sql` renames `spell_attack_bonus → spell_attack_bonus_override` and `spell_save_dc → spell_save_dc_override` (preserves existing values; user can toggle them off post-migration to reveal the calculated values).
- `PlayerCharacter` type updated to match. PDF parser stops writing these fields (sets overrides to null on import — calculation handles the standard case). Wizard's `assemble-character` likewise stops setting them.
- Edit page Spellcasting section: Spell Attack and Spell DC are now read-only display tiles that recompute live when the ability dropdown, level, or relevant ability score changes. Below them, an "Override calculated values" toggle reveals two number inputs that write to the override columns; toggling off nulls them.
- PDF export reads via the new helpers, so override wins when set, otherwise calculated.

**The Heathbound (laserllama, witch-themed reskin)** at `src/data/homebrew-classes/heathbound.ts`:
- Mechanically identical to the Magus, but spellcasting ability is **Wisdom** and saving throw proficiencies are **CON / WIS**. All `INT`/`Intelligence`/`Magus`/`Magus level` references in feature text rewritten to `WIS`/`Wisdom`/`Heathbound`/`Heathbound level`. Hexblade weapon's INT/WIS/CHA stat block stays as-is (those are creature ability scores, not the character's casting ability).
- Order of Dragon Knights is replaced by **Ward of the Witch** — the character is the chosen of an ancient fey-touched witch of the deep forest, accompanied by a familiar she has sent. All draconic features renamed and reflavored: Draconic Companion → Witch's Familiar (Small Fey, Neutral; languages Sylvan), Wyrmsoul → Witch's Mark, Greater Companion → Awakened Familiar, Elemental Breath → Hexbreath, Mythic Companion → Mythic Familiar, Grand Dragon Knight → Witch's Chosen (Greater Witchblood stat block), Dragon Knight Spells → Witch-Touched Spells. Companion essence renamed to "The Witch's Element" with **fire as canonical**, other elements (acid, cold, lightning, poison) presented as variants. Familiar form is the player's choice (fox / raven / black cat / owl / hare / stoat) with size scaling at the 7th and 15th level milestones described in flavor text.
- Bonus spells adjusted toward witch theme: 5th-level grant changed `dragon's breath` → `scorching ray`; 9th-level changed `elemental bane` → `fireball`; 17th-level changed `conjure dragon` → `fire storm`. The new bonus spells (command, warding bond, fear, dominate creature, fire storm) added to the Heathbound spell list at appropriate levels so the assembler buckets them correctly.
- Registered in the homebrew classes index and shows up in the Players page Create Manually → Homebrew tab. Verified: Level 7 / Ward of the Witch produces WIS-based DC 14 / Atk +6 with WIS 16, CON+WIS save proficiencies, all 4 visible subclass features at this level, bonus spells folded into the right slot buckets.

### 2026-04-28 — Homebrew class system + Magus

**Architecture.** New data-driven system for homebrew classes. Each class is a TS data file in `src/data/homebrew-classes/` exporting a `ClassDefinition` (level progression, features w/ full mechanics, subclasses, spell list, fighting styles). The character creation flow reads the registry and walks the user through a wizard rather than dumping them in the empty edit form.

- New types: `src/types/homebrew-class.ts` (`ClassDefinition`, `LevelEntry`, `FeatureDefinition`, `SubclassDefinition`)
- Registry: `src/data/homebrew-classes/index.ts` exports `ALL_HOMEBREW_CLASSES` and `findHomebrewClass(id)`
- Spell-progression: extracted `getProgressionByCasterType(type, level, cantripFn?)` from the existing class-name-based path so homebrew classes pass caster type explicitly. Half/third caster paths now thread the cantrip count through (vanilla still gets 0 because Paladin/Ranger don't have a cantrip function).
- Assembly logic: `src/lib/homebrew/assemble-character.ts` — `assembleCharacterFromClass(inputs)` returns a `Partial<PlayerCharacter>` ready for the existing parsed-flow path (sessionStorage → /players/new?parsed=true). Computes PB, HP estimate, save+skill modifiers (with proficiency from class def + chosen skills), proficiency metadata jsonbs, spell slots via the progression helper, spell save DC + attack from PB + spellcasting ability, full class features expanded by character level (with `esoteric_order_feature` markers replaced by the chosen subclass's tier features), and bonus spells from the subclass folded into the right spell-level buckets.

**The Magus (laserllama)** at `src/data/homebrew-classes/magus.ts`:
- All 20 levels of progression
- 17 base class features with full mechanical descriptions (Arcane Armory, Spellstrike, Spellsunder, Arcane Conservation, etc.)
- All 12 subclasses (6 base + 6 expanded): Arcanists, Arcane Archers, Blades, Dragon Knights, Spellbreakers, Warders, Armorers, Conduits, Hexblades, Shades, Spellswords, Travelers — full feature text at 3rd/7th/15th/20th + bonus spells where applicable
- 16 fighting styles (8 base + 8 expanded) as informational `FeatureDefinition[]`
- Full Magus spell list (cantrips through 5th level, ~120 spell names; spells not in our SRD library route to the existing Add Description flow)
- Magus-specific cantrip function exported separately and registered in the cantrip lookup

**Character creation flow.**
- Players page: "Create Manually" button now opens a tabbed modal — Tab 1 ("Official Class") still routes to `/players/new`; Tab 2 ("Homebrew Class") shows `ALL_HOMEBREW_CLASSES` as cards
- New route: `/campaign/[id]/players/new-homebrew?class={id}` — three-step wizard:
  1. Basics (name, player, level, subclass card-picker shown only when `level >= subclass_choice_level`)
  2. Class Choices (skill multi-select with count cap, fighting style text + collapsible style list, cantrip multi-select, spells-known multi-select grouped by spell level)
  3. Manual fields (race, background, ability scores, equipment textarea, currency)
- On submit, assembled character lands in the standard edit view via the same sessionStorage path the PDF parser uses, so the user reviews/saves through the existing form

**Verified for the user's test case** (Level 7 Magus / Order of Blades): half-caster slots 4/3/0/0/0; class features include Arcane Armory, Fighting Style (with user's text injected), Spellcasting, Spellstrike, Arcane Regeneration, Esoteric Order, Extra Attack, Spellsight, Ethereal Step, plus the Blades L3/L7 features (Art of the Dance, Blade Dance, Fluid Steps); bonus spells (compelled duel, zephyr strike at L3 → 1st-level bucket; blur, misty step at L5 → 2nd-level bucket); save proficiencies CON/INT; skill modifiers correct for chosen Arcana + Athletics with PB applied; spell save DC and attack bonus computed from PB + INT mod.

**Bug fixed before commit:** the wizard's `StepBasics` / `StepChoices` / `StepManual` were defined as nested functions inside the parent component's body, giving them new identities every render and forcing React to remount the inputs each keystroke (focus loss). Inlined them as direct JSX gated by `step ===` checks. Also dropped the "The" prefix on the Magus class name so the page title reads "Create a Magus" instead of "Create a The Magus".

### 2026-04-28 — Character sheet refinements (4 issues)

**Skill names visible on edit view.** The `numberInputClass` carries `w-full`, which Tailwind v4 generates after `w-14` in the stylesheet, so appending `w-14` had no effect — the inputs took 100% width and pushed the label out of frame. Added `compactInputClass` / `compactNumberClass` without `w-full` for inline ability-card rows. Layout now: `[Skill Name]  [mod input]  [proficiency dropdown]`.

**Class feature parser preserves mid-turn-relevant mechanics.** Added a three-way classifier (`mechanical` / `passive` / `excluded`) that drives summary length:
- Excluded by name pattern: Ability Score Improvement, Proficiency Bonus, Core <X> Traits, generic section headers — these get dropped.
- Mechanical (preserves up to 3 sentences / ~320 chars): description hits any of ~17 patterns covering usage limits (`X/Long Rest`, `per long rest`), action economy (`1 Action`, `Bonus Action`, `Reaction`), `Once per turn/round`, dice (`1d6`, `d20`), `DC N`, save triggers, `advantage on/against`, `resistance/immunity to`, special speeds, area shapes, slot regeneration, `add/extra ... damage`, `spend N`.
- Passive (one sentence): everything else.

Verified against Bosco's expected list — Genie's Vessel, Genie's Wrath, Magical Cunning, Elemental Gift, Lucky, Agonizing Blast all classify mechanical; Darkvision and Skilled stay passive; ASI and "Core Warlock Traits" excluded.

Bullet split now also handles `•` and `-` in addition to `*`. The after-bullet portion of the title line ("Magical Cunning • 1/Long Rest") gets prepended to the description as `(1/Long Rest)` so the mechanical metadata isn't lost when the name is extracted.

**Spell library upgraded to 2024 SRD + extras.** New `scripts/build-spells-json.ts` fetches Open5e v2 (`srd-2024` + `srd-2014` fallback + Deep Magic) and emits `src/data/spells.json` in the existing 5e-bits shape. Result: **920 spells** (up from ~302). Verified Hex, Find Familiar, Unseen Servant, Frostbite, Eldritch Blast, Counterspell, Alarm, Elementalism are now in the library. Mind Sliver, Blade Ward, Eldritch Burst remain missing — they're Tasha's-only spells WotC didn't open-license; handled by the new Add-Description workflow below. Re-run the script anytime Open5e adds more.

**Add-Description workflow for missing spells.**
- Edit view now loads `customSpells` for the campaign on mount and exposes a `spellInLibrary(name)` check using a normalized (apostrophe/punct-stripped) Set.
- In the spell list, any spell whose name doesn't match SRD or this campaign's custom spells gets a `+ Add Description` button next to it.
- Clicking opens an inline `AddDescriptionModal` with name + level pre-filled (read-only), and editable school / casting time / range / V/S/M / material / duration / concentration / ritual / description / higher levels. Saves to `custom_spells` via `customSpellStore.create`.
- PDF export endpoint now accepts `{ character, customSpells }`. The lookup function (renamed `findSpell`) checks custom first, then SRD. The "Description not in SRD library" parenthetical was deleted — missing spells now render as a minimal name-only card (~11mm tall) on the spells page so a finished sheet looks clean. Backwards-compatible: the export still accepts a bare `PlayerCharacter` body.

**Multiclass flag persisted.** Added `is_multiclass BOOLEAN` column (migration `007_player_multiclass_flag.sql`) and wired through `PlayerCharacter` type, parser response, and edit view's populate/build round-trip. The "verify slots manually" banner now shows on saved multiclass characters too, not only during the post-parse session.

### 2026-04-28 — Character sheet overhaul (3 issues)

**Spell slots are now class+level, not parsed from PDF.**
- New `src/data/spell-progression.ts` exposes `getSpellProgression(class, level, subclass)` returning `{casterType, cantripsKnown, spellSlots, pactSlotLevel, pactSlotCount}`. Tables for full / half / third casters, warlock pact magic, non-casters.
- Also exports `parseClassLine(raw)` which handles single ("Warlock 7"), multiclass ("Warlock 5 / Sorcerer 2"), and parenthesized subclass ("Fighter 3 (Eldritch Knight)"). Picks highest-level class as primary.
- `parse-character/route.ts` now calls the lookup after parsing class/level and overrides `spell_slots`, `pact_slot_level`, `pact_slot_count`. The old in-parser warlock pact heuristic was deleted. The dead exploratory code in `parseSpells` was left in place — its slot output is now ignored.
- Edit view shows a multiclass-detected banner via sessionStorage flag from the parse flow. The banner explains that 5e multiclass slot summing isn't applied automatically.

**Skill / save modifiers now display correctly in the edit view.**
- Root cause: edit view stored saves under `'STR'/'DEX'/...` and skills under display labels (`'Sleight of Hand'`), but the parser writes `{str, dex, ...}` and `{sleight_of_hand, ...}`. The PDF export already used the parser's keys, which is why slots-through-PDF worked but edit-view-display didn't.
- Standardized on lowercase 3-letter ability keys and snake_case skill keys throughout. Added `normalizeSaveKeys`/`normalizeSkillKeys` helpers in the edit view to upgrade legacy records on load.
- New `save_proficiencies` and `skill_proficiencies` jsonb columns (migration `006_proficiency_metadata.sql`). Stored as `'none' | 'half' | 'proficient' | 'expertise'` (saves only use `'none' | 'proficient'`).
- Parser infers proficiency level via the modifier-vs-ability-mod delta against proficiency bonus. Tolerates ±1 ambient bonuses (feats etc.); user can override in the edit view if heuristic miscounts.
- `PlayerCharacter` and `ProficiencyLevel` types updated in `src/types/index.ts`.
- Edit view's Ability Scores & Skills section rewritten: 2/3-column ability cards, save row with editable modifier + None/Proficient pill + calc hint, skill rows with editable modifier + None/Half/Proficient/Expertise dropdown.

**PDF export rebuilt from scratch.**
- `src/app/api/export-character/route.ts` is a full rewrite (~1000 lines).
- **Page 1 (Combat reference):** maroon header band w/ name + class line + player name; quick stats bar with 9 boxes (Prof, Pass Perc, Pass Insight, Pass Inv, Init, AC, HP, Hit Dice, Speed); 2×3 ability score grid where each card has score+mod+save+skills inline; right column stack (attacks table → senses & defenses → class resources → proficiencies); bottom row of class features / racial traits / feats in two columns each.
- **Page 2 (Inventory):** only renders if equipment exists. Inventory table on left ~62%, currency block on right with all 5 coins + total wealth in GP equivalent + lined Notes section.
- **Page 3 (Spells, casters only):** spell-stats bar (Spell Atk / Spell DC / Ability), 9 spell-slot boxes (or single pact-slot box for warlocks), then spell *cards* per level with full SRD descriptions pulled from `src/data/spells.json` by name match (case-insensitive + apostrophe/hyphen normalization). Two-column card layout, automatic page break across 3+ pages when needed.
- Filled / empty proficiency dots are drawn via `doc.circle(x, y, r, 'F'|'S')` rather than Unicode `●/○`. Times-Roman built-in font is used throughout (closest serif fallback to Cinzel/Crimson without font embedding). Diamond ornament on dividers drawn as a 4-vertex path, no glyph dependency.
- Test plan: re-upload Bosco deBoer warlock 7 PDF → verify pact L4×2, edit view modifiers populate, exported PDF has clean ability cards with skills inside, attacks table with header row, proficiency dots rendering as circles, inventory page if items exist, spells page with full descriptions.

### 2026-04-28 — Model version bumps
- `src/app/api/builder/route.ts:12` — Campaign Builder model `claude-opus-4-6` → `claude-opus-4-7`
- `sideboard-spec-v2.md` — synced 5 references (line 42, 372, 746, 867, 886) to Opus 4.7; line 43 Sonnet ID updated `claude-sonnet-4-20250514` → `claude-sonnet-4-6` to match the current Sonnet (no Sonnet endpoints exist in code yet)
- Established this `buildlog.md` as the implementation-status record

### 2026-03-31 — d7cc783 — Proficiency parsing fix
- PDF parser's proficiency section now uses regex section splitting (`=== ARMOR ===` style) instead of naive split — fixes parsing when D&D Beyond adds whitespace or multiline content within a section

### 2026-03-31 — efdf9db — PDF parser: form fields not text
- `parse-character/route.ts` switched from extracting page text to reading PDF form-field annotations. D&D Beyond stores values as named form fields, not flowed text. Also added error display in the UI

### 2026-03-31 — bb8f5b4 — Enhanced character sheet system
- Added migration 005 (full PlayerCharacter schema), the parser route, the export route, the player edit view, the players grid, and the `PCDetail` Live Shelf renderer

### 2026-03-31 — ce2cf5a — Quick Reference + Spells library
- `/reference` page with embedded REFERENCE_DATA and search
- `/spells` page bundling `src/data/spells.json` (SRD) with filter UI
- Migration 004 (`custom_spells` + RLS), pin-to-shelf integration

### 2026-03-31 — 7308f3a — Logo on campaign selector
- Replaced text title on landing page with the wordmark image

### 2026-03-31 — 6e4eb23 — Logo and favicon assets
- Wired logo into login + sidebar header; favicons added to layout metadata

### 2026-03-31 — be157c2 — Auth, data layer, deploy
- Google OAuth via Supabase SSR
- Three Supabase clients (browser/server/middleware)
- Migrations 001–003 (full schema, builder_messages, RLS)
- The `createSupabaseStore<T>` factory and 16 typed stores
- Vercel deploy + production env setup

### 2026-03-31 — 6895cbb — Initial commit
- `create-next-app` scaffolding
