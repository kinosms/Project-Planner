import test from 'node:test'
import assert from 'node:assert/strict'
import handler from '../api/planner.js'

async function request(mode, method, origin) {
  const original = { ...process.env }
  try {
    if (mode) process.env.PLANNER_ACCESS_MODE = mode
    else delete process.env.PLANNER_ACCESS_MODE
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_SECRET_KEY
    process.env.PLANNER_ALLOWED_ORIGINS = 'https://admin.example.com'
    const res = { headers: {}, setHeader(k,v) { this.headers[k] = v }, status(n) { this.statusCode=n; return this }, json(body) { this.body=body; return this } }
    await handler({ method, headers: { origin, 'content-type': 'application/json' }, body: {} },res)
    return res
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key]
    Object.assign(process.env, original)
  }
}
test('public deployment rejects every write before database access, even with an allowed origin', async () => {
  for (const method of ['PUT','POST','PATCH','DELETE','OPTIONS']) {
    const res = await request('public-readonly', method, 'https://admin.example.com')
    assert.equal(res.statusCode, 405)
    assert.equal(res.headers.Allow, 'GET')
  }
})
test('public GET reaches DB configuration validation', async () => {
  const res=await request('public-readonly','GET')
  assert.equal(res.statusCode,503)
  assert.equal(res.body.error,'서버 DB 설정이 필요합니다.')
})
test('missing or invalid access mode fails closed', async () => {
  for (const mode of [undefined,'public','invalid']) assert.equal((await request(mode,'GET')).statusCode,503)
})
test('admin retains origin validation and rejects unsupported methods', async () => {
  assert.equal((await request('vercel-protected','PUT','https://public.example.com')).statusCode,403)
  assert.equal((await request('vercel-protected','DELETE')).statusCode,405)
})
