// Parses every D&D Beyond export in PCsheets/fixtures/ and writes the result
// to PCsheets/fixtures/out/<name>.json. The JSON is committed, so parser
// changes show up as diffs.
//
//   npx tsx scripts/parse-fixtures.ts

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import path from 'path';
import { extractFormFields } from '@/lib/import/pdf-form-fields';
import { parseDdbCharacter } from '@/lib/import/ddb-parser';

const FIXTURES = path.join(process.cwd(), 'PCsheets/fixtures');
const OUT = path.join(FIXTURES, 'out');

async function main() {
  mkdirSync(OUT, { recursive: true });
  const pdfs = readdirSync(FIXTURES)
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .sort();

  for (const file of pdfs) {
    const formFields = await extractFormFields(new Uint8Array(readFileSync(path.join(FIXTURES, file))));
    const parsed = parseDdbCharacter(formFields);
    const outName = file.replace(/\.pdf$/i, '.json');
    writeFileSync(path.join(OUT, outName), JSON.stringify(parsed, null, 2) + '\n');
    console.log(`${file} → out/${outName}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
