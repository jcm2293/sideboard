# Character sheet export review (Dash Berman, 2 Oct 2026)

Three-way diff of the D&D Beyond export (`PCsheets/Heershingenmosiken_171856598 (1).pdf`), the raw form fields inside it, and the Sideboard export (`Dash_Berman-sheet.pdf`), with a redesign proposal. Mockup of the proposed layout is published as the "Dash Berman Sheet Redesign" artifact.

Headline: the Sideboard sheet is missing most of what makes this character work, and nearly all of it is a parser problem rather than a layout problem. The data is present in the Beyond export's form fields; `parse-character/route.ts` drops it before `export-character/route.ts` ever sees it.

## 1. What the Beyond export has that the Sideboard sheet lost

Ordered by how much a player would miss it at the table.

### 1.1 Invocations are flattened into the parent feature and truncated (critical)

The custom sheet shows one entry, "Eldritch Invocations", whose body is the generic rules text plus `| Agonizing Blast (Eldritch Blast) • br-2024 You can add your Cha.` and then stops. Lost entirely:

- Thirsting Blade: Extra Attack with the pact weapon. This is the character's main action.
- Pact of the Blade: attack with Cha, bonus-action conjure/bond, choose necrotic/psychic/radiant damage.
- Mask of Many Faces: Disguise Self at will.
- Pact of the Tome: survives only as a stray "You can use the book as a Spellcasting Focus.." heading (see 1.3).

Cause: `parseFeatures` splits feature blocks on `\n\s*[*•\-]\s+`. Beyond marks sub-features (invocations, subclass choices, feat options) with a leading `|`, e.g. `   | Thirsting Blade • br-2024`. Those lines never start a new block, so they are swallowed into the parent's description, and `buildSummary` then cuts the parent at three sentences / 320 chars.

Fix: treat `^\s*\|\s+Name • meta` as a child feature. Emit it as its own `FeatureEntry` (optionally with `parent: 'Eldritch Invocations'`) and drop the parent when the parent is a container with only boilerplate text (Eldritch Invocations, Warlock Subclass, Fiend Spells). Lines of the form `| Pact of the Blade: Conjure: 1 Bonus Action` and `| 1 / Long Rest • 1 Minute` are metadata for the preceding feature, not features: attach them as `action` and `uses`.

### 1.2 Resources and uses are gone (critical)

The Sideboard sheet has no Class Resources section at all. Beyond encodes every limited-use feature as a metadata line right after it:

| Feature | Beyond line | Should render as |
|---|---|---|
| Magical Cunning | `\| 1 / Long Rest • 1 Minute` | 1 use, long rest |
| Vampiric Bite | `\| 3 / Long Rest • Special` | 3 uses, long rest |
| Fey Touched: Charm Person | spell notes `1/LR` | 1 free cast, long rest |
| Fey Touched: Misty Step | spell notes `1/LR` | 1 free cast, long rest |
| Pact slots | `spellSlotHeader3 = "2 Pact OO"` | 2 slots, short rest |

Cause: `parseClassResources` requires `\|\s*(.+?):` (a name before a colon) on the same line as `N / Long Rest`. Beyond's uses lines have no name; the name is the nearest preceding `*` or `|` heading. Walk back to the last heading instead.

### 1.3 Bullets inside a description start a new "feature"

Pact of the Tome's body contains `• When the book appears, choose 3 cantrips…` and `• You can use the book as a Spellcasting Focus.` The split regex treats these as new features, which produces the garbage heading "You can use the book as a Spellcasting Focus.." with "The book disappears…" as its body.

Fix: only `*` at line start (or `|` per 1.1) begins a feature. A `•` that is indented or follows a line that does not end a sentence is a list bullet inside the description.

### 1.4 Features cut at the wrong point by the three-sentence summary

- Vampiric Bite loses Drain and Strengthen (the two things you do with it) and the 3/LR cap.
- Arcane Eloquence keeps "You gain the following benefits. Cantrip. You learn the Vicious Mockery cantrip." and loses Smooth Talker, the +1d4 to Deception/Intimidation/Persuasion that is the entire reason to take the feat.
- Fey Touched keeps "Ability Score Increase. Increase your Int. , Wis." (noise) and loses Fey Magic (the spells).
- Dark One's Blessing survives only because it is short.

Two problems compound. First, Beyond breaks a feature across `FeaturesTraits3`/`FeaturesTraits4` mid-sentence (and the page-1 Actions box simply truncates at "Dark One's Blessing"); joining the fields with `\n` is fine, but any split on that boundary loses the tail. Second, the summariser is sentence-count based. For "mechanical" features the player needs the full text; the spec's "one-line summary" rule was written for ribbon features. Recommendation: keep full text for anything classified mechanical, drop the sentence cap, and move the long text to a Features page (section 3) rather than page 1. If you keep a cap, cap by characters after stripping the boilerplate opener sentences ("You gain the following benefits.", "Ability Score Increase…").

### 1.5 Noise that leaks through, and noise that is correctly excluded

Leaks (should be excluded):

- `Pact Magic. (PHB-2024 153)` with no body. The `(PHB-2024 153)` page ref is prepended to the description before the empty-description check, so `!description.trim()` never fires. Test emptiness before prefixing meta.
- `Warlock Subclass. | Fiend Patron`, `Fiend Spells.` (explanatory text), `Core Warlock Traits` (already excluded, good).
- `Bejeweled Conclave Spy Ability Score Increase. (AU 21) | Increase two scores (+2 / +1) •`. Add `/ability\s+score\s+increase/i` to `EXCLUDED_NAME_PATTERNS`.
- Species ribbons: Creature Type, Size, Languages (generic RtHW text), Speed, Darkvision. Speed and Darkvision already appear in the vitals and senses blocks; printing them again as features is duplication.
- The source tag `(PHB-2024 161)` on every feature. Useful to the DM, noise to the player. Drop from the player PDF or render as a small muted suffix on the Features page only.

### 1.6 Attack notes dropped

Beyond's `Wpn Notes 1` for the shortsword is `Martial, Finesse, Light, Vex, Vengeful Blade: 2d8 Necrotic, Booming Blade: 1d8 Thunder, 2d8 Thunder`. The parser reads it into `notes` but the attacks table has no notes column and an always-empty Range column. Swap Range for a Notes line under the name, and fill Range from the spell rows for cantrip attacks (Eldritch Blast 120 ft, Blood Bolt 90 ft).

Also add Vampiric Bite as an attack row when the species trait exists: +7, 1d4+2 piercing, with the 3/LR empower note. Beyond does not list it as an attack either, but it is the vampire's signature move and a player will look for it in the attacks table.

### 1.7 Per-spell metadata is ignored, so homebrew spells render as empty boxes

Eight of the 25 spells (Blood Bolt, Vengeful Blade, Toll the Dead, Booming Blade, Binding Pledge, Blood Sacrifice, Sanguine Secrets, Shadow Drain) are not in `spells.json`, so their cards are a title in an empty rectangle. The Beyond export carries, for every spell: `spellPrepared`, `spellSource`, `spellSaveHit`, `spellCastingTime`, `spellRange`, `spellComponents`, `spellDuration`, `spellNotes`, `spellPage`. None of it is parsed.

Fix: store spells as entries, not name lists.

```ts
interface SpellEntry {
  name: string;
  level: number;
  source: string;        // "Warlock", "Fiend Spells (Always Prepared)", "Fey Touched", "Eldritch Invocations", "Arcane Eloquence"
  always_prepared: boolean;   // spellPrepared === 'P'
  save_or_atk: string;   // "+8", "WIS 16", "--"
  casting_time: string;  // "1A", "1BA", "1R", "1m"
  range: string;
  components: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;       // "[R]" suffix on name
  free_uses: string | null;   // "1/LR" from notes
  notes: string;
  page_ref: string;
}
```

Keep `spells: Record<string, string[]>` for backward compatibility and add `spell_details: Record<string, SpellEntry>`. The export then renders a card header for every spell from `spell_details`, falling back to SRD text for the body when it exists.

`source` also answers the question the current italic legend paragraph is trying to explain in prose: does this spell cost a pact slot? Map it to a chip: Warlock → slot; "Always Prepared" → slot; "Fey Touched" with `1/LR` → free once; "Eldritch Invocations" with Disguise Self → at will; `[R]` → ritual.

### 1.8 Misty Step appears twice

Beyond lists it as row 16 (Fey Touched free cast, notes `1/LR`) and row 17 (Fey Touched, always prepared). The custom sheet prints two identical cards. Dedupe by name and merge the metadata into one entry with both a `free_uses` and a slot chip.

### 1.9 Smaller gaps

- Species and background appear nowhere on the custom sheet. Beyond has `RACE` = Dhampir, `BACKGROUND` = Bejeweled Conclave Spy. Put them in the header band's second line.
- Climb speed dropped. `Speed` = `35 ft. (Walking), 35 ft. (Climbing)`; `parseSpeed` captures both, `drawQuickStatsBar` prints only walking.
- Proficiency flags are inferred from modifier deltas when Beyond provides them directly: `AthleticsProf`, `DeceptionProf`, `IntimidationProf`, `PersuasionProf`, `WisProf`, `ChaProf` are set. Read them first, infer only as fallback.
- Speed shows "35 ft." in the vitals but the class line says Level 5 with no XP or milestone marker. Fine to leave out.

### 1.10 A data problem on the Beyond side, not the parser

The shortsword shows +5 / 1d6+5 because it is not flagged as the bonded pact weapon in Beyond, so it rolls Strength without proficiency. Bonded, it is Cha + proficiency + 1 = +9, 1d6+6. The parser can only copy what Beyond computes; fix it in Beyond before re-export. Worth a one-line warning in the import UI when `class_name` is Warlock, a Pact of the Blade invocation is present, and no weapon attack uses the Cha modifier.

## 2. What is cut off in the Beyond export itself

- Page 1 Actions box (`Actions1` + `Actions2`) truncates at "Dark One's Blessing" with no description. Beyond only has two Actions fields and drops the overflow. Everything in Actions also appears in `FeaturesTraits1..5`, which paginates onto page 3 ("Additional Features & Traits"), so FeaturesTraits is the source of truth. Use Actions only as a classifier: it has already sorted features into `=== ACTIONS ===`, `=== BONUS ACTIONS ===`, `=== REACTIONS ===`, `=== SPECIAL ===`, which is exactly the grouping the "Your turn" block in section 3 needs.
- `Wpn Notes 1` overflows its cell (rendered at ~4pt). The field value is complete.
- FeaturesTraits fields break mid-sentence at page boundaries ("…specified in the Fiend" / "Spells table, you thereafter…"). Harmless if you join with a space and only split on real headings.
- The "Standard Actions" list (Attack, Magic, Dash, Disengage…) is boilerplate; exclude.

## 3. Redesign

Design principle: organise page 1 by what the player is doing when they look at it, in order of frequency.

1. The DM asks for a roll → saves, skills, passives. Left rail.
2. It is my turn → attacks with computed numbers, action economy, slots and uses. Right column, the bulk of the page.
3. Something happens to me → AC, HP, resistances, senses. Vitals strip at the top.
4. I need the rules text → later pages, full text, grouped.

### Page 1: Combat reference (see mockup)

- Header band: name; second line `Dhampir · Warlock 5, Fiend Patron · Bejeweled Conclave Spy · played by Jake`; right side: page role and export date.
- Vitals strip, seven cells: AC (with source), HP max (with hit dice), Initiative, Speed (walk · climb), Proficiency, Spell DC (with attack and ability), Passive Perception (with darkvision). Spell DC belongs on page 1 for a caster; today it is only on the spells page.
- Left rail (~200px of 816): six compact ability tiles (mod large, score small, save on a third line with a proficiency dot), then one alphabetical skills list with proficiency dots, ability tags, and the Smooth Talker `+1d4` inline on the three affected skills. Alphabetical beats grouped-by-ability at the table because the DM names the skill, not the ability. Then Defenses & senses, then Proficiencies as four one-liners.
- Right column: Attacks & cantrips table with a notes line under each name and a chip for pact weapon / uses / homebrew. Then **Your turn**, four groups (Action, Bonus action, Reaction, Always on) populated from Beyond's Actions sections plus spell casting times. Then **Resources** with uses as empty circles and the recovery period. Then Inventory inline when it fits (≤ ~8 rows); only break out an inventory page beyond that. Drop the 40 blank notes lines; the spec already says players use a notebook.

On the "reference card, not worksheet" rule in the spec: I would make one exception for pact slots and feature uses. Six small circles cost nothing, and a printed sheet with checkable bubbles is the one place a pen is faster than a notebook. If you hold the line on the spec, render the counts as `2 / short rest` text instead; everything else in the layout is unchanged.

### Page 2: Features

Full text, two columns, grouped: Class features and invocations, Species traits, Feats. Each heading carries its tags inline: `Vampiric Bite · 3 / long rest · replaces an unarmed strike`. Exclude ribbons (Creature Type, Size, Languages, Core Traits, ASI, empty container headings). No page refs, or a muted `PHB 161` suffix at most.

### Page 3+: Spells

- Stats bar and slot bubbles as now.
- A **spell index table** before the cards: name with chips (slot / free 1/LR / at will / ritual, plus a `C` for concentration), time, range, hit or DC, duration, source. One screen, every option, no reading. The current legend paragraph goes away because the chips encode it.
- Cards after the index, full width for spells with SRD text. For spells without SRD text, render the header line from `spell_details` and leave a short ruled area rather than an empty box, or omit the card and rely on the index row.
- Dedupe Misty Step.

### Typography and system

- Embed real fonts. jsPDF supports `addFileToVFS` + `addFont` with a base64 TTF. Cinzel (headings) and Crimson Pro (body) are OFL and on Google Fonts; two weights each is about 300 KB in the bundle. Times is doing more damage to the "beautiful" goal than any layout choice. The spec already names these faces.
- Type scale: 26 / 19 / 11 (Cinzel, tracked, uppercase labels) and 11.5 / 10 (Crimson Pro body and notes). Tabular numerals for every modifier column.
- Keep the maroon band and section rules; use gold only for chips, the header's top rule, and the diamond ornament. Today maroon carries every level of hierarchy, so nothing stands out.
- Alternate row shading on all tables (attacks has it; skills and inventory should too).
- Proficiency dots and bubbles as drawn circles, as now.

## 4. Implementation order

1. Parser: child features (`|`), uses metadata, in-description bullets, empty-description check before meta prefix, ASI exclusion. One afternoon; fixes 1.1–1.5.
2. Parser: `spell_details` from per-spell fields, dedupe, `source` → chip mapping. Fixes 1.7–1.8.
3. Export: header second line, vitals strip, attacks notes line and bite row, Your turn block from Actions sections, Resources block, inventory inline. Page 1 mockup.
4. Export: Features page with full text; spell index table; fonts.

Items 1 and 2 are pure wins with no design decisions. Item 3 is where the layout questions in section 3 need your call.
