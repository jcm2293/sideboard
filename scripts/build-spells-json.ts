// One-shot: fetch open-licensed spell data from Open5e (2024 SRD + 2014 SRD as fallback
// + Deep Magic for extra coverage) and emit src/data/spells.json in the existing 5e-bits
// shape so the runtime consumers don't need changes.
//
// Run: npx tsx scripts/build-spells-json.ts
//
// Output schema per spell:
//   { index, name, desc[], higher_level[], range, components[], material,
//     ritual, duration, concentration, casting_time, level, school, classes[] }

import { writeFileSync } from 'fs';
import { resolve } from 'path';

const API = 'https://api.open5e.com/v2/spells/';
// Order matters — earlier sources win on dedup.
const SOURCES = ['srd-2024', 'srd-2014', 'deepm', 'deepmx'];

interface Open5eSpell {
  key: string;
  name: string;
  desc: string;
  level: number;
  higher_level: string | null;
  range_text: string;
  range_unit: string;
  ritual: boolean;
  casting_time: string;
  verbal: boolean;
  somatic: boolean;
  material: boolean;
  material_specified: string;
  duration: string;
  concentration: boolean;
  school: { name: string; key: string };
  classes: { name: string; key: string }[];
}

interface OutSpell {
  index: string;
  name: string;
  desc: string[];
  higher_level: string[];
  range: string;
  components: string[];
  material: string;
  ritual: boolean;
  duration: string;
  concentration: boolean;
  casting_time: string;
  level: number;
  school: string;
  classes: string[];
}

function indexOf(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function castingTime(raw: string): string {
  // Open5e v2 uses tokens like "action" / "bonus-action" / "reaction" / "1 minute" / "10 minutes" / "1 hour"
  if (!raw) return '1 action';
  const t = raw.trim().toLowerCase();
  if (t === 'action') return '1 action';
  if (t === 'bonus-action' || t === 'bonus action') return '1 bonus action';
  if (t === 'reaction') return '1 reaction';
  if (/^\d/.test(t)) return t.replace(/-/g, ' ');
  return t.replace(/-/g, ' ');
}

function components(s: Open5eSpell): string[] {
  const out: string[] = [];
  if (s.verbal) out.push('V');
  if (s.somatic) out.push('S');
  if (s.material) out.push('M');
  return out;
}

function transform(s: Open5eSpell): OutSpell {
  return {
    index: indexOf(s.name),
    name: s.name,
    desc: s.desc ? s.desc.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) : [],
    higher_level: s.higher_level ? [s.higher_level.trim()] : [],
    range: s.range_text || '',
    components: components(s),
    material: s.material_specified || '',
    ritual: !!s.ritual,
    duration: s.duration || 'Instantaneous',
    concentration: !!s.concentration,
    casting_time: castingTime(s.casting_time),
    level: s.level,
    school: s.school?.name || '',
    classes: (s.classes || []).map((c) => c.name).sort(),
  };
}

async function fetchAll(documentKey: string): Promise<Open5eSpell[]> {
  const all: Open5eSpell[] = [];
  let url: string | null = `${API}?document__key=${documentKey}&limit=100`;
  while (url) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Open5e ${documentKey}: HTTP ${res.status}`);
    const json: { results: Open5eSpell[]; next: string | null } = await res.json();
    all.push(...json.results);
    url = json.next;
  }
  return all;
}

async function main() {
  const byKey = new Map<string, OutSpell>();

  for (const src of SOURCES) {
    process.stdout.write(`Fetching ${src}... `);
    let raw: Open5eSpell[];
    try {
      raw = await fetchAll(src);
    } catch (e) {
      console.log(`FAILED (${(e as Error).message}) — skipping`);
      continue;
    }
    let added = 0;
    for (const s of raw) {
      const out = transform(s);
      if (!byKey.has(out.index)) {
        byKey.set(out.index, out);
        added++;
      }
    }
    console.log(`${raw.length} fetched, ${added} new (total ${byKey.size})`);
  }

  // Stable sort by name
  const arr = Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name));

  const outPath = resolve(process.cwd(), 'src/data/spells.json');
  writeFileSync(outPath, JSON.stringify(arr));
  console.log(`\nWrote ${arr.length} spells → ${outPath}`);

  // Spot-check the user's specific list
  const checks = ['Hex', 'Find Familiar', 'Unseen Servant', 'Mind Sliver',
    'Alarm', 'Blade Ward', 'Frostbite', 'Eldritch Blast', 'Counterspell',
    'Eldritch Burst', 'Elementalism'];
  console.log('\nSpot-check:');
  const lc = new Map(arr.map((s) => [s.name.toLowerCase(), s]));
  for (const name of checks) {
    const hit = lc.get(name.toLowerCase());
    console.log(`  ${hit ? 'OK' : '  '} ${name}${hit ? '' : ' — missing (will need Add Description)'}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
