import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { exchangeAppleAuthorizationCode } from '../_shared/apple.ts';

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
    return json({ error: 'Anonymous users cannot store an Apple token' }, 403);
  }

  let authorizationCode: string | undefined;
  try {
    const body = (await req.json()) as { authorizationCode?: unknown };
    if (typeof body.authorizationCode === 'string' && body.authorizationCode.length > 0) {
      authorizationCode = body.authorizationCode;
    }
  } catch {
    return json({ error: 'authorizationCode required' }, 400);
  }
  if (!authorizationCode) return json({ error: 'authorizationCode required' }, 400);

  const refreshToken = await exchangeAppleAuthorizationCode(authorizationCode);
  if (!refreshToken) {
    return json({ error: 'Could not exchange Apple authorization code' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: fullUser } = await admin.auth.admin.getUserById(user.id);
  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...(fullUser.user?.app_metadata ?? {}),
      apple_refresh_token: refreshToken,
    },
  });
  if (updateError) return json({ error: updateError.message }, 500);
  return json({ ok: true });
});
