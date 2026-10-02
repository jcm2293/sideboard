import { createClient } from './server';

/**
 * API routes call paid services (Anthropic) and do heavy PDF work, so every
 * handler verifies the caller itself rather than trusting the middleware.
 * Returns a 401 response when nobody is signed in, otherwise null.
 */
export async function rejectUnauthenticated(): Promise<Response | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? null : Response.json({ error: 'Not signed in.' }, { status: 401 });
}
