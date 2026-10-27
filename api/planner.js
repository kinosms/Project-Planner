import process from 'node:process'
import { Buffer } from 'node:buffer'
import { canEditRequest, authReady, sameOrigin } from '../server/adminAuth.js'
import { readHistoryPage } from '../src/lib/historyPage.js'
import { payloadError } from '../src/lib/plannerValidation.js'
import { createClient } from '@supabase/supabase-js'

const fail = (res, status, error) => res.status(status).json({ error })
export function validPayload(p) { return payloadError(p) === null }

export function createPlannerHandler({ authenticate = canEditRequest, connect = createClient } = {}) {
return async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (!['GET', 'PUT'].includes(req.method)) {
    res.setHeader('Allow', 'GET, PUT')
    return fail(res, 405, '허용하지 않는 요청입니다.')
  }
  const canEdit = await authenticate(req)
  if (req.method === 'PUT') {
    if (!canEdit) return fail(res, 403, '관리자 계정으로 로그인해야 저장할 수 있습니다.')
    if (!sameOrigin(req)) return fail(res, 403, '허용되지 않은 요청 출처입니다.')
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) return fail(res, 415, 'JSON 요청이 필요합니다.')
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return fail(res, 503, '서버 DB 설정이 필요합니다.')
  try {
    let payload = req.body
    if (req.method === 'PUT') {
      if (typeof payload === 'string') payload = JSON.parse(payload)
      if (Buffer.byteLength(JSON.stringify(payload) || '') > 3000000) return fail(res, 413, '저장 데이터가 너무 큽니다.')
      const validationError = payloadError(payload)
      if (validationError) return fail(res, 400, validationError)
    }
    const db = connect(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    if (req.method === 'GET' && req.query?.resource === 'histories') {
      const result = await readHistoryPage(db, req.query.before)
      return res.status(result.status).json(result.body)
    }
    const { data, error } = req.method === 'GET'
      ? await db.rpc('planner_read')
      : await db.rpc('planner_save', { payload })
    if (error) {
      if (error.message?.includes('PLANNER_CONFLICT')) return fail(res, 409, '다른 창에서 데이터가 변경됐습니다. 로컬 백업 후 다시 불러와 주세요.')
      console.error('Planner DB request failed', { code: error.code })
      return fail(res, 500, 'DB 처리에 실패했습니다. 로컬 작업은 유지됩니다.')
    }
    return res.status(200).json({ ...data, canEdit, authConfigured: authReady() })
  } catch {
    return fail(res, 400, '요청을 처리하지 못했습니다. 로컬 백업 후 서버 상태를 확인해 주세요.')
  }
}

}
export default createPlannerHandler()
