import { extractFormFields } from '@/lib/import/pdf-form-fields';
import { parseDdbCharacter } from '@/lib/import/ddb-parser';
import { rejectUnauthenticated } from '@/lib/supabase/require-user';

export async function POST(request: Request) {
  const denied = await rejectUnauthenticated();
  if (denied) return denied;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return Response.json({ error: 'File must be a PDF' }, { status: 400 });
    }

    const formFields = await extractFormFields(new Uint8Array(await file.arrayBuffer()));
    const { character, notices } = parseDdbCharacter(formFields);

    return Response.json({ character, notices });
  } catch (error) {
    console.error('PDF parse error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error parsing PDF';
    return Response.json({ error: message }, { status: 500 });
  }
}
