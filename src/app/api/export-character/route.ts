import { NextRequest } from 'next/server';
import type { PlayerCharacter, CustomSpell } from '@/types';
import { renderCharacterPdf } from '@/lib/pdf/character-export';
import { rejectUnauthenticated } from '@/lib/supabase/require-user';

export async function POST(req: NextRequest) {
  const denied = await rejectUnauthenticated();
  if (denied) return denied;

  try {
    // Accept either a bare PlayerCharacter or { character, customSpells }.
    // The wrapper form lets the client pass campaign-scoped custom spells so the
    // PDF can render their full descriptions.
    const body = await req.json();
    const character = (body.character ?? body) as PlayerCharacter;
    const customSpells = (body.customSpells ?? []) as CustomSpell[];

    const pdfOutput = renderCharacterPdf(character, customSpells);
    return new Response(pdfOutput, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${character.name || 'character'}-sheet.pdf"`,
      },
    });
  } catch (err) {
    console.error('PDF export error:', err);
    return new Response(JSON.stringify({ error: 'Failed to generate PDF' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
