import type { Session } from './types';

export class AuthUnavailableError extends Error { constructor() {super('身份服务暂不可用，请重试'); this.name='AuthUnavailableError';} }
export function checkAuthError(error: any) {
  if (error && (error.status === 0 || error.status >= 500 || error.name === 'AuthRetryableFetchError')) throw new AuthUnavailableError();
}

/** The candidate is untrusted until both identity and claims verify for this exact token. */
export async function verifySessionCredential(
  client: { auth: { getUser: (token: string) => Promise<any>; getClaims: (token: string) => Promise<any> } },
  candidate: { access_token: string; refresh_token?: string; user?: { id: string }; aal?: string },
  maxAge: number,
): Promise<Session | null> {
  const token = candidate.access_token;
  if (!token) return null;
  const { data: userData, error: userError } = await client.auth.getUser(token);
  checkAuthError(userError);
  if (userError || !userData?.user) return null;
  const { data: claimsData, error: claimsError } = await client.auth.getClaims(token);
  checkAuthError(claimsError);
  const claims = claimsData?.claims;
  const user = userData.user;
  const now = Math.floor(Date.now() / 1000);
  if (claimsError || !claims || claims.sub !== user.id ||
      (candidate.user && candidate.user.id !== user.id) ||
      !Number.isFinite(claims.iat) || !Number.isFinite(claims.exp) ||
      claims.exp <= now || claims.iat > now + 60 || now - claims.iat > maxAge) return null;
  const aal = claims.aal === 'aal2' ? 'aal2' : 'aal1';
  return {
    access_token: token,
    refresh_token: candidate.refresh_token || '',
    expires_at: claims.exp,
    expires_in: Math.max(0, claims.exp - now),
    created_at: claims.iat,
    user: { ...user, email: user.email || '', app_metadata: { ...user.app_metadata, aal } },
    aal,
  };
}

export async function refreshVerifiedSession(client: any, refreshToken: string, maxAge: number, persist: (session:Session)=>Promise<void>): Promise<Session|null> {
  const {data,error}=await client.auth.refreshSession({refresh_token:refreshToken});
  checkAuthError(error);
  if(error||!data?.session)return null;
  const verified=await verifySessionCredential(client,data.session,maxAge);
  if(!verified)return null;
  await persist(verified);
  return verified;
}
