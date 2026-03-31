/**
 * Import local-data-export.json into hosted Supabase.
 *
 * Usage:
 *   npx tsx scripts/import-to-supabase.ts <auth-user-id>
 *
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars,
 * or reads from .env.local automatically.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const userId = process.argv[2];
if (!userId) {
  console.error('Usage: npx tsx scripts/import-to-supabase.ts <auth-user-id>');
  console.error('Get your user ID from Supabase dashboard → Authentication → Users');
  process.exit(1);
}

const exportPath = resolve(process.cwd(), 'local-data-export.json');
if (!existsSync(exportPath)) {
  console.error(`Export file not found: ${exportPath}`);
  console.error('Run the export from http://localhost:3000/export first');
  process.exit(1);
}

const data = JSON.parse(readFileSync(exportPath, 'utf-8'));

// Service role client bypasses RLS
const supabase = createClient(supabaseUrl, serviceRoleKey);

// Insert order respects foreign key dependencies
const INSERT_ORDER = [
  'campaigns',
  'world_meta',
  'stat_blocks',
  'locations',
  'factions',
  'npcs',
  'items',
  'lore_entries',
  'plot_arcs',
  'sessions',
  'scenes',
  'encounters',
  'session_logs',
  'player_characters',
  'builder_messages',
];

async function importTable(table: string) {
  const rows = data[table];
  if (!rows || rows.length === 0) {
    console.log(`  ${table}: 0 rows (skipping)`);
    return;
  }

  // Set user_id on campaigns
  const prepared = rows.map((row: Record<string, unknown>) => {
    if (table === 'campaigns') {
      return { ...row, user_id: userId };
    }
    return row;
  });

  // For locations, insert parent locations first (parent_id = null), then children
  if (table === 'locations') {
    const parents = prepared.filter((r: Record<string, unknown>) => !r.parent_id);
    const children = prepared.filter((r: Record<string, unknown>) => r.parent_id);

    if (parents.length > 0) {
      const { error } = await supabase.from(table).upsert(parents, { onConflict: 'id' });
      if (error) {
        console.error(`  ${table} (parents): ERROR - ${error.message}`);
        return;
      }
    }
    if (children.length > 0) {
      const { error } = await supabase.from(table).upsert(children, { onConflict: 'id' });
      if (error) {
        console.error(`  ${table} (children): ERROR - ${error.message}`);
        return;
      }
    }
    console.log(`  ${table}: ${prepared.length} rows imported (${parents.length} parents, ${children.length} children)`);
    return;
  }

  const { error } = await supabase.from(table).upsert(prepared, { onConflict: 'id' });
  if (error) {
    console.error(`  ${table}: ERROR - ${error.message}`);
  } else {
    console.log(`  ${table}: ${prepared.length} rows imported`);
  }
}

async function main() {
  console.log(`Importing to ${supabaseUrl}`);
  console.log(`User ID: ${userId}`);
  console.log('');

  for (const table of INSERT_ORDER) {
    await importTable(table);
  }

  console.log('\nDone!');
}

main().catch(console.error);
