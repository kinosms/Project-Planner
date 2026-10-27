import test from 'node:test'
import assert from 'node:assert/strict'
import handler, { createPlannerHandler } from '../api/planner.js'
import { ORIGIN } from '../server/adminAuth.js'
const response = () => ({ headers: {}, setHeader(k,v) { this.headers[k]=v }, status(n) { this.statusCode=n; return this }, json(body) { this.body=body; return this } })
const payload = { revision:0, projects:[], rangeStart:'2026-10-01', rangeEnd:'2026-10-31', customHolidayDates:[] }

test('legacy deployment mode and fabricated identity headers never authorize anonymous writes', async () => {
 process.env.PLANNER_ACCESS_MODE='vercel-protected'
 for (const headers of [{}, { 'x-vercel-id':'owner', 'x-vercel-user-email':'geronimo.sung@kakaocorp.com' }, { cookie:'__Host-planner_admin=forged' }]) {
  const res=response()
  await handler({ method:'PUT', headers:{ ...headers, origin:ORIGIN, 'content-type':'application/json' }, body:payload },res)
  assert.equal(res.statusCode,403)
 }
})
test('anonymous GET is public, other methods fail before DB access', async () => {
 const rpcCalls=[]
 const run=createPlannerHandler({ authenticate:async()=>false, connect:()=>({ rpc:async(name)=>{ rpcCalls.push(name); return { data:{ projects:[], histories:[], revision:1 }, error:null } } }) })
 process.env.SUPABASE_URL='https://example.supabase.co'; process.env.SUPABASE_SECRET_KEY='test-only'
 const res=response(); await run({ method:'GET', headers:{} },res)
 assert.equal(res.statusCode,200); assert.equal(res.body.canEdit,false); assert.deepEqual(rpcCalls,['planner_read'])
 for (const method of ['POST','DELETE','PATCH']) { const r=response(); await run({method,headers:{}},r); assert.equal(r.statusCode,405) }
 assert.deepEqual(rpcCalls,['planner_read'])
})
test('only a verified administrator from the canonical origin can save', async () => {
 let calls=0
 const run=createPlannerHandler({ authenticate:async()=>true, connect:()=>({ rpc:async(name)=>{ assert.equal(name,'planner_save'); calls++; return { data:{ projects:[], histories:[], revision:1 }, error:null } } }) })
 for (const origin of [undefined,'https://evil.example','null']) {
  const res=response(); await run({ method:'PUT', headers:{ origin,'content-type':'application/json' },body:payload },res); assert.equal(res.statusCode,403)
 }
 assert.equal(calls,0)
 const res=response(); await run({method:'PUT',headers:{origin:ORIGIN,'content-type':'application/json'},body:payload},res)
 assert.equal(res.statusCode,200); assert.equal(res.body.canEdit,true); assert.equal(calls,1)
})
