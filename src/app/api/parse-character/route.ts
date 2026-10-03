import { extractFormFields } from '@/lib/import/pdf-form-fields';
import { parseDdbCharacter } from '@/lib/import/ddb-parser';
import { applyDdbJson } from '@/lib/import/ddb-json';
import { rejectUnauthenticated } from '@/lib/supabase/require-user';

/**
 * The D&D Beyond PDF (`file`, required) is the character. The Beyond
 * character JSON (`json`, optional) is an overlay: full rules text and
 * computed uses for what the PDF already has.
 */
export async function POST(request: Request) {
  const denied = await rejectUnauthenticated();
  if (denied) return denied;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const json = formData.get('json') as File | null;

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return Response.json({ error: 'File must be a PDF' }, { status: 400 });
    }

    const formFields = await extractFormFields(new Uint8Array(await file.arrayBuffer()));
    let { character, notices } = parseDdbCharacter(formFields);

    if (json) {
      let raw: unknown = null;
      try {
        raw = JSON.parse(await json.text());
      } catch {
        notices = [...notices, `${json.name} is not valid JSON; it was ignored.`];
      }
      if (raw != null) {
        const overlaid = applyDdbJson(character, raw);
        character = overlaid.character;
        notices = [...notices, ...overlaid.notices];
      }
    }

    return Response.json({ character, notices });
  } catch (error) {
    console.error('PDF parse error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error parsing PDF';
    return Response.json({ error: message }, { status: 500 });
  }
}
