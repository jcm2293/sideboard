// Builds finished character sheets straight from D&D Beyond exports, without
// the app: each PDF in docs/pdfs is parsed, overlaid with the character JSON
// in docs/jsonfiles that has the same Beyond character ID (the number in the
// PDF's file name), and rendered. Both folders are local (gitignored).
//
// docs/pdfs/overrides.json, if present, patches fields per character name
// for things missing from Beyond: { "Yolanda": { "armor_class": 14, "ac_source": "armor" } }
//
//   npx tsx scripts/build-sheets.ts [output dir]   (default: ~/Desktop/Sideboard sheets)

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { extractFormFields } from '@/lib/import/pdf-form-fields';
import { parseDdbCharacter, type ParsedCharacter } from '@/lib/import/ddb-parser';
import { applyDdbJson } from '@/lib/import/ddb-json';
import { renderCharacterPdf } from '@/lib/pdf/character-export';
import type { PlayerCharacter } from '@/types';

const PDFS = 'docs/pdfs';
const JSONS = 'docs/jsonfiles';
const OUT = path.resolve(process.argv[2] ?? path.join(os.homedir(), 'Desktop', 'Sideboard sheets'));
const OVERRIDES = path.join(PDFS, 'overrides.json');

type Beyond = { data?: { id?: number; name?: string } };

(async () => {
  if (!existsSync(PDFS)) {
    console.log(`No ${PDFS} folder.`);
    return;
  }
  mkdirSync(OUT, { recursive: true });
  const jsons: Beyond[] = existsSync(JSONS)
    ? readdirSync(JSONS)
        .filter((f) => f.endsWith('.json'))
        .map((f) => JSON.parse(readFileSync(path.join(JSONS, f), 'utf8')) as Beyond)
    : [];
  const overrides: Record<string, Partial<ParsedCharacter>> = existsSync(OVERRIDES)
    ? JSON.parse(readFileSync(OVERRIDES, 'utf8'))
    : {};

  for (const pdf of readdirSync(PDFS).filter((f) => f.toLowerCase().endsWith('.pdf'))) {
    const id = pdf.match(/_(\d+)/)?.[1];
    let { character } = parseDdbCharacter(await extractFormFields(new Uint8Array(readFileSync(path.join(PDFS, pdf)))));
    const name = character.name.trim();
    const json =
      jsons.find((j) => id && String(j.data?.id) === id) ??
      jsons.find((j) => String(j.data?.name ?? '').trim().toLowerCase() === name.toLowerCase());
    const notes: string[] = [];
    if (json) {
      const over = applyDdbJson(character, json);
      character = over.character;
      notes.push(...over.notices);
    }
    // Beyond prints the exporting account as the player; it isn't the player.
    if (/^heershingenmosiken$/i.test(character.player_name ?? '')) character = { ...character, player_name: '' };
    if (overrides[name]) {
      character = { ...character, ...overrides[name] };
      notes.push(`overrides: ${Object.keys(overrides[name]).join(', ')}`);
    }
    const file = path.join(OUT, `${name}.pdf`);
    writeFileSync(file, Buffer.from(renderCharacterPdf(character as PlayerCharacter)));
    console.log(`${pdf} ${json ? '+ JSON' : '(no JSON)'} → ${file}`);
    for (const n of notes) console.log(`   ${n}`);
  }
})();
