export function bindPlannerInteractions(windowTarget, documentTarget, { reset, endPointer, syncShift }) {
  const onVisibilityChange = () => {
    if (documentTarget.hidden) reset()
  }
  const bindings = [
    [windowTarget, 'keydown', syncShift],
    [windowTarget, 'keyup', syncShift],
    [windowTarget, 'pointermove', syncShift],
    [windowTarget, 'blur', reset],
    [windowTarget, 'focus', reset],
    [windowTarget, 'pointerup', endPointer],
    [windowTarget, 'pointercancel', reset],
    [documentTarget, 'visibilitychange', onVisibilityChange],
  ]
  bindings.forEach(([target, type, listener]) => target.addEventListener(type, listener))
  return () => bindings.forEach(([target, type, listener]) => target.removeEventListener(type, listener))
}
