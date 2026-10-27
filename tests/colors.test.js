import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeProjects, paintTaskDate } from '../src/lib/plannerColors.js'
import { plannerRequest } from '../src/plannerApi.js'
const date = '2026-10-29'
const task = { id: 2, dates: [date], redDates: [date], memoDates: { [date]: '메모' } }
test('legacy overlap prefers blue without mutating source', () => {
 const t = normalizeProjects([{ tasks: [task] }])[0].tasks[0]
 assert.deepEqual(t.dates, [date]); assert.deepEqual(t.redDates, [])
 assert.deepEqual(task.redDates, [date])
})
test('repainting and erasing remove old color and keep memo', () => {
 const red = paintTaskDate(task, date, 'red')
 assert.deepEqual(red.dates, [])
 const blue = paintTaskDate(red, date, 'blue')
 assert.deepEqual(blue.redDates, [])
 assert.deepEqual(paintTaskDate(blue, date, 'blue'), blue)
 const empty = paintTaskDate(blue, date, null)
 assert.deepEqual(empty.dates, []); assert.deepEqual(empty.redDates, [])
 assert.deepEqual(empty.memoDates, task.memoDates)
})
test('PUT and GET preserve Oct 29 blue through server upsert ordering', async () => {
 const previous = globalThis.fetch
 let saved
 globalThis.fetch = async (_url, options) => {
  if (options.method === 'PUT') {
   saved = JSON.parse(options.body)
   const t = saved.projects[0].tasks[0]
   const rows = new Map(t.dates.map(d => [d, 'blue']))
   t.redDates.forEach(d => rows.set(d, 'red'))
   assert.equal(rows.get(date), 'blue')
  }
  return { ok: true, headers: { get: () => 'application/json' }, json: async () => ({ projects: saved.projects, histories: [], revision: 1 }) }
 }
 try {
  await plannerRequest('PUT', { projects: [{ tasks: [task] }] })
  const result = await plannerRequest('GET')
  assert.deepEqual(result.projects[0].tasks[0].dates, [date])
  assert.deepEqual(result.projects[0].tasks[0].redDates, [])
 } finally { globalThis.fetch = previous }
})
