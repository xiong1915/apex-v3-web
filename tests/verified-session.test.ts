import test from 'node:test';
import assert from 'node:assert/strict';
import { verifySessionCredential, refreshVerifiedSession } from '../lib/auth/verified-session';

const now = Math.floor(Date.now() / 1000);
function client(userId = 'admin', sub = 'admin', aal = 'aal1', error: unknown = null) {
  return { auth: {
    getUser: async (token: string) => ({ data: { user: { id: userId, app_metadata: { aal: 'aal2' } } }, error }),
    getClaims: async (token: string) => ({ data: { claims: { sub, aal, iat: now, exp: now + 600 } }, error }),
  } };
}
test('identity and MFA must be verified against the selected token', async () => {
  const c = client();
  const tokens: string[] = [];
  const getUser = c.auth.getUser;
  const getClaims = c.auth.getClaims;
  c.auth.getUser = token => { tokens.push(token); return getUser(token); };
  c.auth.getClaims = token => { tokens.push(token); return getClaims(token); };
  const result = await verifySessionCredential(c, { access_token: 'selected-token', user: { id: 'admin' } }, 2592000);
  assert.equal(result?.aal, 'aal1');
  assert.deepEqual(tokens, ['selected-token', 'selected-token']);
});
test('reject mixed session owner, JWT subject and verified identity', async () => {
  for (const [userId, sub, sessionId] of [['admin','other','admin'],['admin','admin','other'],['other','admin','admin']]) {
    assert.equal(await verifySessionCredential(client(userId, sub), { access_token: 'token', user: { id: sessionId } }, 2592000), null);
  }
});
test('failed verification cannot inherit MFA from metadata or session fields', async () => {
  assert.equal(await verifySessionCredential(client('admin','admin','aal2', new Error('invalid')), {access_token:'token', user:{id:'admin'}, aal:'aal2'}, 2592000), null);
});
test('two refresh rotations persist both credentials and never reuse revoked refresh token', async () => {
  const c:any=client('admin','admin','aal2');
  let refresh='refresh-0',access='expired-0',generation=0;
  c.auth.refreshSession=async({refresh_token}:{refresh_token:string})=>{
    assert.equal(refresh_token,refresh);
    generation++;
    return {data:{session:{access_token:`access-${generation}`,refresh_token:`refresh-${generation}`,user:{id:'admin'}}},error:null};
  };
  const persist=async(session:any)=>{access=session.access_token;refresh=session.refresh_token;};
  assert.ok(await refreshVerifiedSession(c,refresh,2592000,persist));
  assert.equal(access,'access-1');assert.equal(refresh,'refresh-1');
  assert.ok(await refreshVerifiedSession(c,refresh,2592000,persist));
  assert.equal(access,'access-2');assert.equal(refresh,'refresh-2');
});
