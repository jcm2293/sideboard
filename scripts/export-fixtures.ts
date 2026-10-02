// Renders every parsed fixture (PCsheets/fixtures/out/<name>.json, from
// scripts/parse-fixtures.ts) to PCsheets/fixtures/out/<name>.pdf, so the
// character-sheet renderer can be checked without the UI.
//
//   npx tsx scripts/export-fixtures.ts

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import path from 'path';
import { renderCharacterPdf } from '@/lib/pdf/character-export';
import type { PlayerCharacter } from '@/types';

const OUT = path.join(process.cwd(), 'PCsheets/fixtures/out');

for (const file of readdirSync(OUT).filter((f) => f.endsWith('.json')).sort()) {
  const { character } = JSON.parse(readFileSync(path.join(OUT, file), 'utf8')) as { character: PlayerCharacter };
  const pdf = renderCharacterPdf(character);
  const outName = file.replace(/\.json$/, '.pdf');
  writeFileSync(path.join(OUT, outName), Buffer.from(pdf));
  console.log(`${file} → out/${outName} (${Math.round(pdf.byteLength / 1024)} KB)`);
}
