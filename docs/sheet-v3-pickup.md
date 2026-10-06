# Character sheet v3: pickup notes

Paused 2026-10-06. Read this, then `docs/character-sheet-spec-v3.md` (the spec, amended by Jake) and the 2026-10-02 entries in `buildlog.md` (what each commit did and why).

## Where things stand

| | State |
|---|---|
| Branch | `sheet-v3`, 13 commits ahead of `main`. `main` (production) is untouched. |
| Pushed | Everything through `30b721b`. `76efd3e` (prepared-caster fix) and the commit adding this doc are **local only**. |
| Preview | https://sideboard-g63sxfuv4-jcm2293s-projects.vercel.app (build of `30b721b`). Each push builds a new preview URL. |
| Production | dmsideboard.com deploys from `main` only. The live site will change only after a merge. |
| Database | Migration `009_character_sheet_v3.sql` is applied to production Supabase (additive, nullable). The live code ignores the new columns. |
| Checks | `scripts/check-fixtures.ts`: 81/81. `tsc` clean. Lint is clean in every file this work touched, apart from 2 old warnings in the edit page. |

## Pipeline

```
Beyond PDF ──extractFormFields──▶ ddb-parser ──▶ ParsedCharacter ──▶ edit page ──▶ Supabase
                                                   ▲      (re-upload: character-merge)      │
Beyond JSON (optional) ──ddb-json overlay──────────┘                                       ▼
                                   renderCharacterPdf: page-combat → page-features → page-spells
                                                       → description cards → inventory page
```

| Spec §9 phase | Status |
|---|---|
| 0 Extract parser/renderer, fixture scripts | Done |
| 1 Types, migration, class reference | Done |
| 2 Structured parser | Done |
| 3 Renderer: page 1, Features, Spells, Inventory, fonts | Page 1 done. Features done. Spells: strip, slot bubbles, and index done; **cards are still the old renderer** (deduped, with fixed headers). **Inventory page is still the old one.** **Fonts not started** (Times stands in; all text is measured, so a font swap reflows). |
| 4 Import-UI notices (§7) | Minimal: parse notices show as "Import notes" on the edit page. Nothing more designed yet. |
| Extra: Beyond JSON overlay | Done. The upload dialog has PDF (required) and JSON (optional) fields. |

## Next, in order

1. **Re-upload "doesn't allow JSON."** Likely cause: the browser saved the JSON with no extension (`docs/jsonfiles/yolanda` sits next to `yolanda.json`), and the dialog's JSON field has `accept=".json,application/json"`, which greys such files out. Fix: drop the accept filter on that field; the route already rejects non-JSON content with a notice (`src/app/campaign/[id]/players/page.tsx`). Then confirm on a preview that Re-upload with a JSON works.
2. **Push** `76efd3e` and later commits, then test on the new preview:
   - a PDF-only upload;
   - PDF + JSON;
   - a re-upload into an existing character, then export.

   If Google login fails on the preview, check that the Vercel Preview environment has the Supabase variables and that Supabase's allowed redirect URLs include the preview domain.
3. **Open a PR and merge to `main`** to go live (confirm with Jake first).
4. **Put the five characters into the app** (Amber Slam, Dash, Grandpa Dan, Lucien, Yolanda). Either upload them as new characters or re-upload them into the existing ones. This writes to live data, so confirm first. Yolanda's armor is missing in Beyond: add it there (AC 14), or set it on the edit page.
5. **Finish phase 3:**
   - Card redesign to the mockup: cream card, chips, the "higher-level slot" line resolved for pact casters. Fix the flow too: a card that doesn't fit currently starts a new page even when the other column has room.
   - The §5.4 Inventory page.
   - Embedded Cinzel and Crimson Pro fonts: `addFileToVFS` with base64 modules under `src/data/fonts/`.
6. **Phase 4:** the §7 notices as designed UI (Pact of the Blade bond warning, Rage auto-created, duplicate lines merged).

## Known smaller issues

- **From column, domain spells:** a domain spell whose source is the class shows "Cleric", not "Life Domain, always prepared" (`fromLabel` in `page-spells.ts`).
- **Lowercasing:** "Up to six creatures…" stays capitalized because `COMMON_START` in `lib/feature-summary.ts` lacks "Up".
- **Vampiric Bite:** Drain/Strengthen share one paragraph in the export text, so "Strengthen." isn't bolded on the Features page.
- **Activation summaries** (Flurry of Blows and the like) are stored but not editable; only feature summaries have an edit field.
- **Weak seeded clauses:** "Smooth Talker · roll 1d4 and add…" drops its trigger, and the Arcane Eloquence heading reads "Cantrip, Smooth Talker". Add table shorts or edit the summaries.
- **Radiant Sun Bolt:** the PDF's snippet gives 1d8; the JSON's full XGtE text adds Dex (1d8+5). The row follows whichever text is loaded, and Jake hasn't ruled.
- **Dash's shortsword** is +5 on Beyond because it isn't bonded as the pact weapon. That's a Beyond-side fix (mockup callout).
- **Old lint, unrelated files:** react-hooks rules in the locations, sessions, spells and homebrew wizard pages and `use-campaign-data`; 2 unused-import warnings in the edit page.

## Spec drift to reconcile

- §8 still describes the old behavior in three places:
  - the barbarian's inventory on its own page (§5.1 now places it inline by measurement);
  - "Fast Hands ×3" (the §5.1 naming rule now collapses it to one line);
  - Radiant Sun Bolt only under Action (it is now an attack row too, and kept in Your turn).
- §3.6 and §5.3 disagree on feat-only casters. The code follows §5.3 (feat spells get Spells pages) and gives species-only casters an Innate spells block.
- The code follows the mockup over the spec text in a few places: "always prepared" in the From column, not a chip; a "then slot" chip for free casts that can also use a slot; and §6's "Evoker · Thief" subclass separator.

## Decisions to remember

- **`summary` is the one-line clause.** The table short (`src/data/feature-shorts.ts`) wins; otherwise it is seeded from the text (`src/lib/feature-summary.ts`: first sentence, clause boundary, about 90 chars, no ellipsis). Shorts compute level and modifier numbers.
  - On re-upload, a summary still equal to its seed for the stored sheet follows the import; one the DM rewrote stays.
  - Pre-v3 paragraph summaries are re-seeded at render time.
- **Re-upload ownership.**
  - The import owns feature structure the edit page doesn't expose: full text, uses, activations, options.
  - JSON-sourced text (`text_source: 'json'`) and spell descriptions survive a later PDF-only re-upload.
- **The JSON is an overlay, never a source of features or spells.**
  - Descriptions are generic rules text; the PDF has resolved numbers, which the summaries keep.
  - Uses come only from `actions[].limitedUse`: a proficiency-based count is the bonus itself, a stat adds its modifier, and reset 1/2 means short/long rest. Feature-definition `limitedUse` is a static table and is ignored.
  - A JSON for another character is ignored.
- **Prepared casters.** Beyond's PDF can mark every spell a 2024 cleric could prepare (Yolanda: 106).
  - The JSON's `classSpells[].prepared`/`alwaysPrepared` flags, plus spells granted by feats, species, or items, set `prepared_spells`.
  - The sheet then shows cantrips, always-prepared, non-class, and prepared spells only (`spellDetailsOf` in `sheet-data.ts`).
  - Without a JSON, a cleric's sheet still lists everything.
- **Player name:** Beyond prints the exporting account ("Heershingenmosiken") as the player. Never let it overwrite a real player name.

## How to work on it

```bash
npx tsx scripts/parse-fixtures.ts     # fixture PDFs → PCsheets/fixtures/out/*.json (committed, so parser changes diff)
npx tsx scripts/check-fixtures.ts     # 81 checks against spec §8 and the summary rules
npx tsx scripts/export-fixtures.ts    # → out/*.pdf (gitignored)
npx tsx scripts/overlay-fixtures.ts   # fixtures + matching Beyond JSON → out/*.overlay.pdf
npx tsx scripts/build-sheets.ts [dir] # docs/pdfs + docs/jsonfiles (+ overrides) → finished sheets, default ~/Desktop/Sideboard sheets
```

- **Proofing:** poppler renders jsPDF's unembedded base-14 fonts badly on macOS (no bold, odd gaps). Use `qlmanage -t -s 1700 -o /tmp/sheet file.pdf`, which renders page 1 only; split other pages out first with `pdfseparate`.
- **Local samples (gitignored):**
  - `docs/pdfs` holds Beyond PDFs; the character ID is in the file name.
  - `docs/jsonfiles` holds the matching character-service JSONs.
  - `docs/pdfs/overrides.json` holds per-character patches (Yolanda: AC 14). The five sheets made on 2026-10-02 can be rebuilt with `build-sheets.ts`.

**Code map**

| Area | Files |
|---|---|
| Parser | `src/lib/import/ddb-parser.ts` |
| JSON overlay | `src/lib/import/ddb-json.ts` |
| Merge | `src/lib/character-merge.ts` |
| Summaries | `src/lib/feature-summary.ts`, `src/data/feature-shorts.ts` |
| Rules tables | `src/data/class-reference.ts`, `weapons.ts` (masteries), `cantrip-damage.ts` |
| Renderer entry, old cards, old inventory page | `src/lib/pdf/character-export.ts` |
| Page 1 | `page-combat.ts` |
| Features | `page-features.ts` |
| Spell strip and index | `page-spells.ts` |
| What page 1 shows (pure) | `sheet-data.ts` |
| Drawing kit | `sheet-kit.ts` |
| Spell lookup | `spell-library.ts` (custom spells, then SRD 5.2, with the SRD's renames) |
| UI | `src/app/campaign/[id]/players/page.tsx` (upload dialog), `src/app/campaign/[id]/players/[pcId]/page.tsx` (edit page, Import notes) |
| Routes | `src/app/api/parse-character`, `src/app/api/export-character` |

**jsPDF gotchas, already handled in `sheet-kit.ts`**

- Letter spacing (`Tc`) persists in the PDF text state, so it is reset after every spaced string.
- `getTextWidth` applies kerning but `text()` draws unkerned, so measure unkerned.
- U+00A0 is mis-measured, so non-breaking spaces glue tokens in layout but are drawn as plain spaces.
- Draw same-style words as one string; per-word draws doubled the file size.

**Beyond data gotchas**

- Character names carry trailing spaces.
- Template tokens (`{{savedc:wis}}`) appear in JSON snippets, not descriptions.
- `classes[].classFeatures` lists all 20 levels, so filter by `requiredLevel`.
- Invocations are `options` in the JSON.
- Two options can share a name ("Charisma"); `componentId` tells them apart.
