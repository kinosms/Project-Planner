import { Buffer } from 'node:buffer'
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto'
import { ORIGIN, SESSION_COOKIE, FLOW_COOKIE, authConfig, authReady, cookieValue, makeCookie, verifyAdminToken, canEditRequest, sameOrigin } from '../server/adminAuth.js'
const callback = `${ORIGIN}/api/auth?action=callback`
const redirect = (res, url) => { res.statusCode = 303; res.setHeader('Location', url); return res.end() }
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

export function createAuthHandler({ verify = verifyAdminToken, authenticate = canEditRequest, fetcher = fetch } = {}) {
return async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  const action = req.query?.action
  if (action === 'session' && req.method === 'GET') return res.status(200).json({ canEdit: await authenticate(req), authConfigured: authReady() })
  if (action === 'logout' && req.method === 'POST') {
    if (!sameOrigin(req)) return res.status(403).json({ error: '허용되지 않은 요청 출처입니다.' })
    res.setHeader('Set-Cookie', [makeCookie(SESSION_COOKIE, '', 0), makeCookie(FLOW_COOKIE, '', 0)])
    return res.status(200).json({ canEdit: false })
  }
  if (!['login', 'callback'].includes(action) || req.method !== 'GET') {
    res.setHeader('Allow', action === 'logout' ? 'POST' : 'GET')
    return res.status(405).json({ error: '허용하지 않는 요청입니다.' })
  }
  if (!authReady()) return res.status(503).json({ error: '관리자 로그인 연결 설정이 필요합니다. 조회는 계속 이용할 수 있습니다.' })
  const { clientId } = authConfig()
  if (action === 'login') {
    const state = randomBytes(32).toString('base64url')
    const nonce = randomBytes(32).toString('base64url')
    const verifier = randomBytes(32).toString('base64url')
    const flow = Buffer.from(JSON.stringify({ state, nonce, verifier, expires: Date.now() + 600000 })).toString('base64url')
    res.setHeader('Set-Cookie', makeCookie(FLOW_COOKIE, flow, 600))
    const params = new URLSearchParams({ client_id: clientId, redirect_uri: callback, response_type: 'code', scope: 'openid', state, nonce,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' })
    return redirect(res, `https://vercel.com/oauth/authorize?${params}`)
  }
  // Consume the flow on every callback. No token or authorization code is logged.
  res.setHeader('Set-Cookie', [makeCookie(FLOW_COOKIE, '', 0), makeCookie(SESSION_COOKIE, '', 0)])
  try {
    const raw = cookieValue(req, FLOW_COOKIE)
    if (!raw || raw.length > 2048) throw new Error('Invalid flow')
    const flow = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
    if (!equal(req.query?.state, flow.state) || !Number.isFinite(flow.expires) || flow.expires < Date.now() ||
        flow.expires > Date.now() + 600000 || typeof flow.verifier !== 'string' || typeof req.query?.code !== 'string') throw new Error('Invalid flow')
    const response = await fetcher('https://api.vercel.com/login/oauth/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, code: req.query.code, redirect_uri: callback, code_verifier: flow.verifier }),
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) throw new Error('Exchange failed')
    const tokens = await response.json()
    const identity = await verify(tokens.id_token)
    if (!equal(identity.nonce, flow.nonce)) throw new Error('Invalid nonce')
    res.setHeader('Set-Cookie', [makeCookie(FLOW_COOKIE, '', 0), makeCookie(SESSION_COOKIE, tokens.id_token, Math.min(identity.exp - Date.now() / 1000, 28800))])
    return redirect(res, '/')
  } catch {
    return redirect(res, '/?auth=denied')
  }
}

}
export default createAuthHandler()
