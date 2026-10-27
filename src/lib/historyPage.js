export const HISTORY_PAGE_SIZE = 20

export async function readHistoryPage(db, before) {
  if (before !== undefined && (typeof before !== 'string' || !/^[1-9]\d{0,18}$/.test(before))) {
    return { status: 400, body: { error: '히스토리 페이지 정보가 올바르지 않습니다.' } }
  }
  let query = db.from('planner_histories').select('*').order('id', { ascending: false }).limit(HISTORY_PAGE_SIZE + 1)
  if (before !== undefined) query = query.lt('id', before)
  const { data, error } = await query
  if (error) return { status: 500, body: { error: '히스토리를 불러오지 못했습니다. 다시 시도해 주세요.' } }
  const items = data.slice(0, HISTORY_PAGE_SIZE)
  const hasMore = data.length > HISTORY_PAGE_SIZE
  return { status: 200, body: { items, hasMore, nextCursor: hasMore ? String(items.at(-1).id) : null } }
}
