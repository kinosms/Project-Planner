const validDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v
const validId = v => Number.isSafeInteger(v) && v > 0
const validText = v => typeof v === 'string' && v.length <= 20000
const validUrl = v => {
  if (typeof v !== 'string' || v.length > 4096) return false
  try { return ['http:', 'https:'].includes(new URL(v).protocol) } catch { return false }
}
function dateError(list, label) {
  if (!Array.isArray(list) || list.length > 10000) return `${label}: 날짜 목록 형식을 확인해 주세요.`
  if (!list.every(validDate)) return `${label}: 날짜는 실제 존재하는 YYYY-MM-DD 형식이어야 합니다.`
  if (new Set(list).size !== list.length) return `${label}: 중복 날짜가 있습니다.`
  return null
}
export function payloadError(p) {
  if (!p || !Number.isSafeInteger(p.revision) || p.revision < 0) return '저장 버전 정보가 올바르지 않습니다. 먼저 작업을 백업해 주세요.'
  if (!validDate(p.rangeStart) || !validDate(p.rangeEnd) || p.rangeStart > p.rangeEnd || (Date.parse(p.rangeEnd)-Date.parse(p.rangeStart))/86400000 > 3660) return '일정 표시 범위가 올바르지 않거나 10년을 초과합니다.'
  const holidayError = dateError(p.customHolidayDates, '휴일')
  if (holidayError) return holidayError
  if (!Array.isArray(p.projects) || p.projects.length > 1000) return '프로젝트 목록 형식 또는 개수를 확인해 주세요.'
  const projects = new Set(), tasks = new Set()
  let count = 0
  for (const [pi, project] of p.projects.entries()) {
    const label = `프로젝트 ${pi+1}${typeof project?.name === 'string' && project.name ? ` (${project.name.slice(0,60)})` : ''}`
    if (!project || !validId(project.id) || projects.has(project.id)) return `${label}: 프로젝트 ID가 잘못되었거나 중복됩니다.`
    projects.add(project.id)
    if (!validText(project.name) || !Array.isArray(project.tasks)) return `${label}: 이름 또는 업무 목록 형식을 확인해 주세요.`
    for (const [ti,t] of project.tasks.entries()) {
      const where = `${label} → 업무 ${ti+1}`
      if (++count > 10000) return '전체 업무 수가 10,000개를 초과합니다.'
      if (!t || !validId(t.id) || tasks.has(t.id)) return `${where}: 업무 ID가 잘못되었거나 중복됩니다. 작업을 백업한 뒤 ID 복구가 필요합니다.`
      tasks.add(t.id)
      for (const key of ['work','title','owner','status','artifactName']) if (t[key] != null && !validText(t[key])) return `${where}: ${key} 값이 문자열이 아니거나 너무 깁니다.`
      for (const key of ['dates','redDates']) {
        const error = dateError(t[key] || [], `${where} ${key}`)
        if (error) return error
      }
      if (t.artifactUrls != null) {
        if (!Array.isArray(t.artifactUrls) || t.artifactUrls.length > 100) return `${where}: 문서 링크는 최대 100개까지 가능합니다.`
        const bad=t.artifactUrls.findIndex(v => !validUrl(v))
        if (bad !== -1) return `${where}: 문서 링크 ${bad+1}을 확인해 주세요. https:// 또는 http://로 시작하는 주소가 필요합니다.`
      }
      if (t.artifactUrl && !validUrl(t.artifactUrl)) return `${where}: 대표 문서 링크 형식이 잘못되었습니다. https:// 또는 http:// 주소를 입력해 주세요.`
      if (t.memoDates != null && (typeof t.memoDates !== 'object' || Array.isArray(t.memoDates) || !Object.entries(t.memoDates).every(([d,m]) => validDate(d) && validText(m)))) return `${where}: 메모의 날짜 또는 내용 형식을 확인해 주세요.`
    }
  }
  return null
}
