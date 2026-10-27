import test from 'node:test'
import assert from 'node:assert/strict'
import { readHistoryPage } from '../src/lib/historyPage.js'
import { fetchHistoryPage } from '../src/useHistoryPages.js'

function database(rows, error = null) {
 return { from(table) {
  assert.equal(table, 'planner_histories')
  let before, limit
  const query = {
   select() { return query },
   order(field, options) { assert.equal(field, 'id'); assert.equal(options.ascending, false); return query },
   limit(n) { limit = n; return query },
   lt(field, value) { assert.equal(field, 'id'); before = Number(value); return query },
   then(resolve) { return Promise.resolve({ data: rows.filter(r => before === undefined || r.id < before).sort((a,b) => b.id-a.id).slice(0,limit), error }).then(resolve) },
  }
  return query
 } }
}

test('45 records load as 20, 20, 5; new insert does not duplicate the next page', async () => {
 const rows = Array.from({ length: 45 }, (_,i) => ({ id: i+1, project_name: '프로젝트' }))
 const db = database(rows)
 const first = (await readHistoryPage(db)).body
 assert.equal(first.items.length, 20); assert.equal(first.nextCursor, '26')
 rows.push({ id: 46 })
 const second = (await readHistoryPage(db, first.nextCursor)).body
 assert.equal(second.items.length, 20); assert.equal(second.nextCursor, '6')
 const last = (await readHistoryPage(db, second.nextCursor)).body
 assert.equal(last.items.length, 5); assert.equal(last.hasMore, false); assert.equal(last.nextCursor, null)
 assert.equal(new Set([...first.items,...second.items,...last.items].map(r => r.id)).size, 45)
})
test('empty list and exactly 20 records finish without another request', async () => {
 for (const n of [0,20]) {
  const { body } = await readHistoryPage(database(Array.from({ length:n },(_,i) => ({ id:i+1 }))))
  assert.equal(body.items.length, n); assert.equal(body.hasMore, false)
 }
})
test('invalid cursor and database errors return controlled errors', async () => {
 for (const value of ['0','-1','1,or(id.gt.0)','abc',['1']]) assert.equal((await readHistoryPage(database([]),value)).status,400)
 assert.equal((await readHistoryPage(database([], { message:'internal detail' }))).status,500)
})
test('history client uses isolated endpoint and supports server errors and authentication HTML', async () => {
 const original = globalThis.fetch
 try {
  globalThis.fetch = async (url, options) => {
   assert.equal(url, '/api/planner?resource=histories&before=26')
   assert.equal(options.credentials, 'same-origin')
   return { ok:true, headers:{ get:()=> 'application/json' }, json:async()=> ({ items:[], hasMore:false, nextCursor:null }) }
  }
  assert.equal((await fetchHistoryPage('26')).hasMore,false)
  globalThis.fetch = async () => ({ ok:false, headers:{ get:()=> 'application/json' }, json:async()=> ({ error:'다시 시도해 주세요' }) })
  await assert.rejects(fetchHistoryPage(null), /다시 시도/)
  globalThis.fetch = async () => ({ headers:{ get:()=> 'text/html' } })
  await assert.rejects(fetchHistoryPage(null), /접근 인증/)
 } finally { globalThis.fetch=original }
})
