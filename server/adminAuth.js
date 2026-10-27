import process from 'node:process'
import { vercelLogin } from './authConfig.js'
import { createRemoteJWKSet, jwtVerify } from 'jose'

export const ORIGIN = 'https://aiopplanner.cine-clue.com'
export const SESSION_COOKIE = '__Host-planner_admin'
export const FLOW_COOKIE = '__Host-planner_oauth'
const jwks = createRemoteJWKSet(new URL('https://vercel.com/.well-known/jwks'))

export function authConfig() {
  return { clientId: process.env.PLANNER_VERCEL_CLIENT_ID || vercelLogin.clientId, adminId: process.env.PLANNER_ADMIN_VERCEL_ID || vercelLogin.adminId }
}
export function authReady() {
  const { clientId, adminId } = authConfig()
  return Boolean(clientId && adminId)
}
export function cookieValue(req, name) {
  const values = String(req.headers?.cookie || '').split(';').map(part => part.trim()).filter(part => part.startsWith(`${name}=`))
  if (values.length !== 1) return null
  return values[0].slice(name.length + 1)
}
export function makeCookie(name, value, maxAge) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.max(0, Math.floor(maxAge))}`
}
export async function verifyAdminToken(token, keySet = jwks) {
  const { clientId, adminId } = authConfig()
  if (!clientId || !adminId || typeof token !== 'string' || token.length > 3800) throw new Error('Unauthorized')
  const { payload } = await jwtVerify(token, keySet, {
    issuer: 'https://vercel.com', audience: clientId, algorithms: ['RS256', 'ES256'],
    requiredClaims: ['sub', 'exp', 'iat'], maxTokenAge: '8h',
  })
  if (payload.sub !== adminId || (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== clientId)) throw new Error('Unauthorized')
  return payload
}
export async function canEditRequest(req, verifier = verifyAdminToken) {
  const token = cookieValue(req, SESSION_COOKIE)
  if (!token) return false
  try { await verifier(token); return true } catch { return false }
}
export function sameOrigin(req) {
  return req.headers?.origin === ORIGIN
}
