import { normalizeProjects } from './lib/plannerColors.js'
export async function plannerRequest(method, payload) {
  const response = await fetch('/api/planner', {
    method, credentials: 'same-origin', cache: 'no-store',
    headers: payload ? { 'Content-Type': 'application/json' } : undefined,
    body: payload ? JSON.stringify({ ...payload, projects: normalizeProjects(payload.projects) }) : undefined,
  })
  const type = response.headers.get('content-type') || ''
  if (!type.includes('application/json')) {
    throw new Error('접근 인증 또는 서버 배포 설정을 확인해 주세요.')
  }
  const data = await response.json()
  if (!response.ok) {
    const error = new Error(data.error || `요청 실패 (${response.status})`)
    error.status = response.status
    throw error
  }
  if (!Array.isArray(data.projects) || !Array.isArray(data.histories) ||
      !Number.isSafeInteger(data.revision)) throw new Error('서버 응답 형식 오류')
  data.projects = normalizeProjects(data.projects).map(project => ({
    ...project,
    tasks: project.tasks.map(task => {
      const raw = task.artifactUrl || ''
      let urls = []
      try {
        const parsed = raw.startsWith('[') ? JSON.parse(raw) : null
        urls = Array.isArray(parsed)
          ? parsed.map(item => typeof item === 'string' ? item : item?.url).filter(Boolean)
          : raw ? [raw] : []
      } catch { urls = raw ? [raw] : [] }
      return { ...task, artifactUrls: urls, artifactUrl: urls[0] || '' }
    }),
  }))
  return data
}
