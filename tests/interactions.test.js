import test from 'node:test'
import assert from 'node:assert/strict'
import { bindPlannerInteractions } from '../src/lib/plannerInteractions.js'
test('switching windows or hiding a tab clears stuck modifier, drag and paint state', () => {
  const win = new EventTarget(), doc = new EventTarget()
  let state
  const stuck = () => { state = {shift: true, dragging: true, painting: true} }
  const cleanup = bindPlannerInteractions(win, doc, {
    reset: () => { state = {shift: false, dragging: false, painting: false} },
    endPointer: () => { state.dragging = false; state.painting = false },
    syncShift: e => { state.shift = !!e.shiftKey },
  })
  for (const type of ['blur', 'focus', 'pointercancel']) {
    stuck(); win.dispatchEvent(new Event(type))
    assert.deepEqual(state, {shift: false, dragging: false, painting: false})
  }
  stuck(); doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'))
  assert.deepEqual(state, {shift: false, dragging: false, painting: false})
  stuck(); win.dispatchEvent(new Event('pointerup'))
  assert.deepEqual(state, {shift: true, dragging: false, painting: false})
  win.dispatchEvent(new Event('pointermove'))
  assert.equal(state.shift, false)
  cleanup(); stuck(); win.dispatchEvent(new Event('blur'))
  assert.equal(state.dragging, true)
})
