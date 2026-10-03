// Renders each parsed fixture with its D&D Beyond character JSON laid over
// it (lib/import/ddb-json), to PCsheets/fixtures/out/<name>.overlay.pdf.
// JSONs are matched to fixtures by character name.
//
//   npx tsx scripts/overlay-fixtures.ts [dir-with-beyond-json]   (default: docs/jsonfiles)

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import path from 'path';
import { applyDdbJson } from '@/lib/import/ddb-json';
import type { ParsedCharacter } from '@/lib/import/ddb-parser';
import { renderCharacterPdf } from '@/lib/pdf/character-export';
import type { PlayerCharacter } from '@/types';

const OUT = path.join(process.cwd(), 'PCsheets/fixtures/out');
const JSON_DIR = path.resolve(process.argv[2] ?? 'docs/jsonfiles');
if (!existsSync(JSON_DIR)) {
  console.log(`No JSON directory at ${JSON_DIR}`);
  process.exit(0);
}

const jsons = readdirSync(JSON_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ file: f, raw: JSON.parse(readFileSync(path.join(JSON_DIR, f), 'utf8')) as { data?: { name?: string } } }));

for (const file of readdirSync(OUT).filter((f) => f.endsWith('.json')).sort()) {
  const { character } = JSON.parse(readFileSync(path.join(OUT, file), 'utf8')) as { character: ParsedCharacter };
  const match = jsons.find((j) => String(j.raw.data?.name ?? '').trim().toLowerCase() === character.name.trim().toLowerCase());
  if (!match) continue;
  const { character: overlaid, notices } = applyDdbJson(character, match.raw);
  const outName = file.replace(/\.json$/, '.overlay.pdf');
  writeFileSync(path.join(OUT, outName), Buffer.from(renderCharacterPdf(overlaid as PlayerCharacter)));
  console.log(`${file} + ${match.file} → out/${outName}`);
  for (const n of notices) console.log(`  ${n}`);
}
