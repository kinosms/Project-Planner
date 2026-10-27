import { useEffect, useRef, useState } from 'react'

export async function fetchHistoryPage(cursor, signal) {
  const query = new URLSearchParams({ resource: 'histories' })
  if (cursor !== null) query.set('before', cursor)
  const response = await fetch(`/api/planner?${query}`, { credentials: 'same-origin', cache: 'no-store', signal })
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('접근 인증 또는 서버 배포 설정을 확인해 주세요.')
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || '히스토리를 불러오지 못했습니다.')
  if (!Array.isArray(data.items) || typeof data.hasMore !== 'boolean' ||
      (data.hasMore && (typeof data.nextCursor !== 'string' || !/^[1-9]\d{0,18}$/.test(data.nextCursor)))) throw new Error('서버 응답 형식 오류')
  return data
}

export default function useHistoryPages() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const cursor = useRef(null)
  const request = useRef(null)

  async function loadMore() {
    if (request.current && !request.current.signal.aborted) return
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError('')
    try {
      const data = await fetchHistoryPage(cursor.current, controller.signal)
      if (controller.signal.aborted) return
      setItems(previous => {
        const seen = new Set(previous.map(item => String(item.id)))
        return [...previous, ...data.items.filter(item => !seen.has(String(item.id)))]
      })
      cursor.current = data.nextCursor
      setHasMore(data.hasMore)
    } catch (e) {
      if (!controller.signal.aborted) setError(e.message)
    } finally {
      if (!controller.signal.aborted) {
        request.current = null
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    loadMore()
    return () => request.current?.abort()
  }, [])

  return { items, loading, error, hasMore, loadMore }
}
