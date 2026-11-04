import { useLayoutEffect, useRef } from 'react'

export default function TaskDetailInput({ value, taskId, onHeightChange, onKeyDown, ...props }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const element = ref.current
    const resize = () => {
      element.style.height = '0px'
      const height = Math.max(29, element.scrollHeight)
      element.style.height = `${height}px`
      onHeightChange(taskId, height + 1)
    }
    resize()
    let width = element.getBoundingClientRect().width
    const observer = new ResizeObserver(() => {
      const nextWidth = element.getBoundingClientRect().width
      if (nextWidth !== width) {
        width = nextWidth
        resize()
      }
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [value, taskId, onHeightChange])
  return <textarea {...props} ref={ref} value={value} rows={1}
    className="table-input task-detail-input" aria-label="상세내용"
    onKeyDown={event => {
      if (event.key !== 'Enter') onKeyDown?.(event)
    }} />
}

