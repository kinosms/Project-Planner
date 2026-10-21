import { createClient } from '@supabase/supabase-js'

const fail = (res, status, error) => res.status(status).json({ error })
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
const text = (value, max = 20000) => typeof value === 'string' && value.length <= max
const id = value => Number.isSafeInteger(value) && value > 0
const dates = value => Array.isArray(value) && value.length <= 10000 && value.every(date) && new Set(value).size === value.length
const url = value => {
  if (!text(value, 4096)) return false
  try { return ['https:', 'http:'].includes(new URL(value).protocol) } catch { return false }
}
export function validPayload(p) {
  if (!p || !Number.isSafeInteger(p.revision) || p.revision < 0 ||
    !date(p.rangeStart) || !date(p.rangeEnd) || p.rangeStart > p.rangeEnd ||
    (Date.parse(p.rangeEnd) - Date.parse(p.rangeStart)) / 86400000 > 3660 ||
    !dates(p.customHolidayDates) || !Array.isArray(p.projects) || p.projects.length > 1000) return false
  const projectIds = new Set(), taskIds = new Set()
  let count = 0
  for (const project of p.projects) {
    if (!project || !id(project.id) || projectIds.has(project.id) || !text(project.name) || !Array.isArray(project.tasks)) return false
    projectIds.add(project.id)
    for (const t of project.tasks) {
      if (++count > 10000 || !t || !id(t.id) || taskIds.has(t.id)) return false
      taskIds.add(t.id)
      if (!['work', 'title', 'owner', 'status', 'artifactName'].every(k => t[k] == null || text(t[k]))) return false
      if (!dates(t.dates || []) || !dates(t.redDates || []) || (t.dates || []).some(d => (t.redDates || []).includes(d))) return false
      if (t.artifactUrls != null && (!Array.isArray(t.artifactUrls) || t.artifactUrls.length > 100 || !t.artifactUrls.every(url))) return false
      if (t.artifactUrl && !url(t.artifactUrl)) return false
      if (t.memoDates != null && (typeof t.memoDates !== 'object' || Array.isArray(t.memoDates) ||
        !Object.entries(t.memoDates).every(([d, memo]) => date(d) && text(memo)))) return false
    }
  }
  return true
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  // Fail closed unless an operator explicitly completed the deployment-protection setup.
  // This flag is NOT authentication. Every deployment/API URL must be protected by Vercel.
  if (process.env.PLANNER_ACCESS_MODE !== 'vercel-protected') return fail(res, 503, '서버 접근 보호 설정이 완료되지 않았습니다.')
  if (!['GET', 'PUT'].includes(req.method)) {
    res.setHeader('Allow', 'GET, PUT')
    return fail(res, 405, '허용하지 않는 요청입니다.')
  }
  if (req.method === 'PUT') {
    const allowed = (process.env.PLANNER_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
    if (!req.headers.origin || !allowed.includes(req.headers.origin)) return fail(res, 403, '허용되지 않은 요청 출처입니다.')
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) return fail(res, 415, 'JSON 요청이 필요합니다.')
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return fail(res, 503, '서버 DB 설정이 필요합니다.')
  try {
    let payload = req.body
    if (req.method === 'PUT') {
      if (typeof payload === 'string') payload = JSON.parse(payload)
      if (Buffer.byteLength(JSON.stringify(payload) || '') > 3000000) return fail(res, 413, '저장 데이터가 너무 큽니다.')
      if (!validPayload(payload)) return fail(res, 400, '데이터 형식·날짜·문서 URL을 확인해 주세요. URL은 http/https만 허용됩니다.')
    }
    const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    const { data, error } = req.method === 'GET'
      ? await db.rpc('planner_read')
      : await db.rpc('planner_save', { payload })
    if (error) {
      if (error.message?.includes('PLANNER_CONFLICT')) return fail(res, 409, '다른 창에서 데이터가 변경됐습니다. 로컬 백업 후 다시 불러와 주세요.')
      console.error('Planner DB request failed', { code: error.code })
      return fail(res, 500, 'DB 처리에 실패했습니다. 로컬 작업은 유지됩니다.')
    }
    return res.status(200).json(data)
  } catch {
    return fail(res, 400, '요청을 처리하지 못했습니다. 로컬 백업 후 서버 상태를 확인해 주세요.')
  }
}
