const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
const APPLE_REVOKE_URL = 'https://appleid.apple.com/auth/revoke';

type AppleSecrets = {
  teamId: string;
  clientId: string;
  keyId: string;
  privateKey: string;
};

function readAppleSecrets(): AppleSecrets | null {
  const teamId = Deno.env.get('APPLE_TEAM_ID')?.trim();
  const clientId = Deno.env.get('APPLE_CLIENT_ID')?.trim();
  const keyId = Deno.env.get('APPLE_KEY_ID')?.trim();
  const privateKey = Deno.env.get('APPLE_PRIVATE_KEY')?.replace(/\\n/g, '\n').trim();
  if (!teamId || !clientId || !keyId || !privateKey) return null;
  return { teamId, clientId, keyId, privateKey };
}

async function createClientSecret(secrets: AppleSecrets): Promise<string> {
  const jose = await import('npm:jose@5.9.6');
  const key = await jose.importPKCS8(secrets.privateKey, 'ES256');
  return new jose.SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: secrets.keyId })
    .setIssuer(secrets.teamId)
    .setIssuedAt()
    .setExpirationTime('5m')
    .setAudience('https://appleid.apple.com')
    .setSubject(secrets.clientId)
    .sign(key);
}

function formBody(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

export async function exchangeAppleAuthorizationCode(
  authorizationCode: string
): Promise<string | null> {
  const secrets = readAppleSecrets();
  if (!secrets) return null;
  const clientSecret = await createClientSecret(secrets);
  const res = await fetch(APPLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody({
      client_id: secrets.clientId,
      client_secret: clientSecret,
      code: authorizationCode,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    console.error('Apple token exchange failed', res.status, await res.text());
    return null;
  }
  const json = (await res.json()) as { refresh_token?: string };
  return json.refresh_token ?? null;
}

export async function revokeAppleRefreshToken(refreshToken: string): Promise<void> {
  const secrets = readAppleSecrets();
  if (!secrets) return;
  const clientSecret = await createClientSecret(secrets);
  const res = await fetch(APPLE_REVOKE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody({
      client_id: secrets.clientId,
      client_secret: clientSecret,
      token: refreshToken,
      token_type_hint: 'refresh_token',
    }),
  });
  if (!res.ok) {
    console.error('Apple token revoke failed', res.status, await res.text());
  }
}

/** Best-effort Sign in with Apple revoke. Missing secrets or a stale code must not block deletion. */
export async function revokeAppleIdentity(opts: {
  refreshToken?: string;
  authorizationCode?: string;
}): Promise<void> {
  let refreshToken = opts.refreshToken;
  if (!refreshToken && opts.authorizationCode) {
    refreshToken = (await exchangeAppleAuthorizationCode(opts.authorizationCode)) ?? undefined;
  }
  if (!refreshToken) return;
  await revokeAppleRefreshToken(refreshToken);
}
