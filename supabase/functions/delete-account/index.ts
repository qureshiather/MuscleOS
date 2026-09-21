import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { revokeAppleIdentity } from '../_shared/apple.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: 'Server misconfigured' }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: 'Unauthorized' }, 401);
  if (user.is_anonymous) {
    return json({ error: 'Anonymous users have no account to delete' }, 403);
  }

  let appleAuthorizationCode: string | undefined;
  try {
    const body = (await req.json()) as { appleAuthorizationCode?: unknown };
    if (typeof body.appleAuthorizationCode === 'string' && body.appleAuthorizationCode.length > 0) {
      appleAuthorizationCode = body.appleAuthorizationCode;
    }
  } catch {
    // Empty body is fine.
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: fullUser } = await admin.auth.admin.getUserById(user.id);
  const storedRefresh =
    typeof fullUser.user?.app_metadata?.apple_refresh_token === 'string'
      ? fullUser.user.app_metadata.apple_refresh_token
      : undefined;
  const hasApple =
    Boolean(storedRefresh) ||
    Boolean(appleAuthorizationCode) ||
    Boolean(fullUser.user?.identities?.some((identity) => identity.provider === 'apple'));

  if (hasApple) {
    try {
      await revokeAppleIdentity({
        refreshToken: storedRefresh,
        authorizationCode: appleAuthorizationCode,
      });
    } catch (error) {
      console.error('Apple revoke threw', error);
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return json({ error: deleteError.message }, 500);
  return json({ ok: true });
});
