import test from 'node:test'
import assert from 'node:assert/strict'
import { SignJWT, generateKeyPair, exportJWK, createLocalJWKSet } from 'jose'
import { verifyAdminToken, canEditRequest, SESSION_COOKIE, FLOW_COOKIE, ORIGIN, cookieValue } from '../server/adminAuth.js'
import { createAuthHandler } from '../api/auth.js'
process.env.PLANNER_VERCEL_CLIENT_ID='cl_test'
process.env.PLANNER_ADMIN_VERCEL_ID='owner-test-id'
const pair=await generateKeyPair('RS256')
const jwk=await exportJWK(pair.publicKey); jwk.kid='test'
const keys=createLocalJWKSet({keys:[jwk]})
const jwt = (sub='owner-test-id', aud='cl_test', exp='1h', issuer='https://vercel.com') => new SignJWT({nonce:'nonce-test'}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer(issuer).setSubject(sub).setAudience(aud).setIssuedAt().setExpirationTime(exp).sign(pair.privateKey)
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(body){this.body=body;return this},end(){return this}})

test('cryptographic verification restricts admin to one Vercel subject, issuer and application', async()=>{
 const valid=await jwt()
 assert.equal((await verifyAdminToken(valid,keys)).sub,'owner-test-id')
 for (const token of [await jwt('other-user'),await jwt('owner-test-id','other-app'),await jwt('owner-test-id','cl_test','-1s'),await jwt('owner-test-id','cl_test','1h','https://evil.example')]) await assert.rejects(verifyAdminToken(token,keys))
 const parts=valid.split('.'); parts[1]=Buffer.from(JSON.stringify({sub:'owner-test-id',exp:9999999999})).toString('base64url')
 await assert.rejects(verifyAdminToken(parts.join('.'),keys))
})
test('missing, duplicate, forged and expired cookies do not grant editing',async()=>{
 assert.equal(await canEditRequest({headers:{}}),false)
 assert.equal(cookieValue({headers:{cookie:`${SESSION_COOKIE}=a; ${SESSION_COOKIE}=b`}},SESSION_COOKIE),null)
 const verify=t=>verifyAdminToken(t,keys)
 assert.equal(await canEditRequest({headers:{cookie:`${SESSION_COOKIE}=${await jwt()}`}},verify),true)
 assert.equal(await canEditRequest({headers:{cookie:`${SESSION_COOKIE}=${await jwt('other-user')}`}},verify),false)
})
test('login uses PKCE, nonce, exact redirect and host-only secure HttpOnly flow cookie',async()=>{
 const res=response(); await createAuthHandler()({method:'GET',headers:{host:'evil.example'},query:{action:'login'}},res)
 const url=new URL(res.headers.Location)
 assert.equal(url.origin,'https://vercel.com'); assert.equal(url.searchParams.get('redirect_uri'),`${ORIGIN}/api/auth?action=callback`)
 assert.equal(url.searchParams.get('code_challenge_method'),'S256'); assert.equal(url.searchParams.get('scope'),'openid')
 assert.match(res.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Lax/)
 assert.ok(url.searchParams.get('nonce')); assert.ok(url.searchParams.get('state'))
})
test('invalid callback state never exchanges a code; denied login clears prior session',async()=>{
 let calls=0; const run=createAuthHandler({fetcher:async()=>{calls++}})
 const res=response(); await run({method:'GET',headers:{},query:{action:'callback',state:'wrong',code:'code'}},res)
 assert.equal(calls,0); assert.equal(res.headers.Location,'/?auth=denied')
 assert.ok(res.headers['Set-Cookie'].every(c=>c.includes('Max-Age=0')))
})
test('matching callback binds nonce before creating a session; no token reaches URL or browser script',async()=>{
 const flow={state:'state-test',nonce:'nonce-test',verifier:'verifier-test',expires:Date.now()+600000}
 const request={method:'GET',headers:{cookie:`${FLOW_COOKIE}=${Buffer.from(JSON.stringify(flow)).toString('base64url')}`},query:{action:'callback',state:'state-test',code:'code-test'}}
 const token=await jwt()
 const run=createAuthHandler({verify:t=>verifyAdminToken(t,keys),fetcher:async(url,options)=>{
  assert.equal(url,'https://api.vercel.com/login/oauth/token'); assert.equal(options.body.get('code_verifier'),'verifier-test')
  return {ok:true,json:async()=>({id_token:token})}
 }})
 const res=response(); await run(request,res)
 assert.equal(res.headers.Location,'/'); assert.match(res.headers['Set-Cookie'][1],/HttpOnly; Secure; SameSite=Lax/)
 flow.nonce='wrong'; request.headers.cookie=`${FLOW_COOKIE}=${Buffer.from(JSON.stringify(flow)).toString('base64url')}`
 const denied=response(); await run(request,denied); assert.equal(denied.headers.Location,'/?auth=denied')
})
test('logout requires same-origin POST and expires both cookies',async()=>{
 const run=createAuthHandler()
 const bad=response(); await run({method:'POST',headers:{origin:'https://evil.example'},query:{action:'logout'}},bad);assert.equal(bad.statusCode,403)
 const res=response(); await run({method:'POST',headers:{origin:ORIGIN},query:{action:'logout'}},res)
 assert.equal(res.statusCode,200); assert.equal(res.body.canEdit,false); assert.ok(res.headers['Set-Cookie'].every(c=>c.includes('Max-Age=0')))
})
