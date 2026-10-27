import { payloadError } from './lib/plannerValidation.js'
import { plannerRequest } from './plannerApi'
import { useEffect, useMemo, useState, useRef } from 'react'
import IntegrityCheck from './IntegrityCheck'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  startOfMonth,
  isFriday,
  subDays,
} from 'date-fns'

import './App.css'

function safeUrl(value) {
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined
  } catch { return undefined }
}

function IconLinkSingle() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconLinkDouble() {
  return (
    <svg width="18" height="12" viewBox="0 0 36 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M22 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M26 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function App() {
  const [projects, setProjects] = useState(() => {
    const savedProjects = localStorage.getItem('projectPlannerProjects')
    if (savedProjects) {
      return JSON.parse(savedProjects)
    }
    return []
  })


  const [compactMode, setCompactMode] = useState(false)
  const [hideCompletedProjects, setHideCompletedProjects] = useState(false)
  const [extraMonths, setExtraMonths] = useState(0)

  const [isPainting, setIsPainting] = useState(false)
  const [paintMode, setPaintMode] = useState(null)
  const [isShiftHeld, setIsShiftHeld] = useState(false)
  const [dragging, setDragging] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [urlEditor, setUrlEditor] = useState(null)
  const [scheduleLocked, setScheduleLocked] = useState(true)
  const [page, setPage] = useState('dashboard')
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id || '')
  const [selectedOwner, setSelectedOwner] = useState('')
  const [memoEditor, setMemoEditor] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [dbReady, setDbReady] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const [loadError, setLoadError] = useState('')
  const revisionRef = useRef(null)
  const savingRef = useRef(false)
  const loadingRef = useRef(false)
  const LOCAL_HISTORY_KEY = 'projectPlannerLocalHistory'
  const [localHistory, setLocalHistory] = useState(() => {
    const saved = localStorage.getItem(LOCAL_HISTORY_KEY)
    return saved ? JSON.parse(saved) : []
  })

  const [historyIndex, setHistoryIndex] = useState(() => {

  const saved = localStorage.getItem(LOCAL_HISTORY_KEY)

  const list = saved ? JSON.parse(saved) : []

  return list.length > 0 ? list.length - 1 : -1

})

const [toast, setToast] = useState('')


  const [histories, setHistories] = useState([])

  const isProjectCompleted = project => {

  const tasks = project.tasks || []

  if (tasks.length === 0) return false

  return tasks.every(task => task.status === '완료')

    }

    const visibleProjects = useMemo(() => {

      if (!hideCompletedProjects) return projects

      return projects.filter(project => !isProjectCompleted(project))

    }, [projects, hideCompletedProjects])

  // Leave enough context on both sides to center today, even with no schedules.
  const [calendarViewportWidth, setCalendarViewportWidth] = useState(window.innerWidth)
  useEffect(() => {
    const resize = () => setCalendarViewportWidth(window.innerWidth)
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  // Include whole months for all visible schedules; saved ranges cannot clip them.
  const { rangeStart, rangeEnd } = useMemo(() => {
    const now = new Date()
    const contextDays = Math.ceil(calendarViewportWidth / 32 / 2 * 7 / 5) + 7
    let start = format(startOfMonth(subDays(now, contextDays)), 'yyyy-MM-dd')
    let end = format(endOfMonth(subDays(now, -contextDays)), 'yyyy-MM-dd')
    for (const project of visibleProjects) {
      for (const task of project.tasks || []) {
        for (const date of [...(task.dates || []), ...(task.redDates || [])]) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
              !Number.isFinite(new Date(`${date}T00:00:00`).getTime())) continue
          if (date < start) start = date
          if (date > end) end = date
        }
      }
    }
    start = format(startOfMonth(new Date(`${start}T00:00:00`)), 'yyyy-MM-dd')
    end = format(endOfMonth(new Date(`${end}T00:00:00`)), 'yyyy-MM-dd')
    if (extraMonths > 0) {
      end = format(endOfMonth(addMonths(new Date(`${end}T00:00:00`), extraMonths)), 'yyyy-MM-dd')
    }
    return { rangeStart: start, rangeEnd: end }
  }, [visibleProjects, extraMonths, calendarViewportWidth])

  const days = useMemo(() => {
    return eachDayOfInterval({
      start: new Date(`${rangeStart}T00:00:00`),
      end: new Date(`${rangeEnd}T00:00:00`),
    }).filter(day => {
      const dayOfWeek = day.getDay()
      return dayOfWeek !== 0 && dayOfWeek !== 6
    })
  }, [rangeStart, rangeEnd])

    const flatTasks = visibleProjects.flatMap(project =>

      project.tasks.map(task => ({

        ...task,

        projectId: project.id,

        projectName: project.name,

      }))

    )

  const [highlightTaskId, setHighlightTaskId] = useState(null)

  const validTasks = flatTasks.filter(task =>
    task.projectName?.trim() !== '' ||
    task.title?.trim() !== ''
  )

  const dashboardTasks = validTasks.filter(task => {
    const taskDates = [...(task.dates || []), ...(task.redDates || [])]
    return taskDates.length > 0
  })



  const [customHolidayDates, setCustomHolidayDates] = useState(() => {
    const saved = localStorage.getItem('projectPlannerCustomHolidayDates')
    return saved ? JSON.parse(saved) : []
  })

  const toggleCustomHolidayDate = date => {
    if (!canEdit) return
    if (customHolidayDates.includes(date)) {
      const next = customHolidayDates.filter(d => d !== date)
      setCustomHolidayDates(next)
      localStorage.setItem('projectPlannerCustomHolidayDates', JSON.stringify(next))
      return
    }

    const next = [...customHolidayDates, date].sort()
    setCustomHolidayDates(next)
    localStorage.setItem('projectPlannerCustomHolidayDates', JSON.stringify(next))
  }

  const taskRefs = useRef({})

  const centerToday = (behavior = 'smooth') => {
    const plannerEl = document.querySelector('.planner')
    const cells = document.querySelectorAll('.date-row .day-cell')
    const today = format(new Date(), 'yyyy-MM-dd')
    // Weekends are not rendered: use the next visible weekday.
    const cell = [...cells].find(day => day.dataset.date >= today)
    const info = plannerEl?.querySelector('.info-panel')
    if (!plannerEl || !cell || !info) return
    const plannerRect = plannerEl.getBoundingClientRect()
    const cellRect = cell.getBoundingClientRect()
    const infoWidth = info.getBoundingClientRect().width
    const center = plannerRect.left + plannerEl.clientLeft + infoWidth +
      (plannerEl.clientWidth - infoWidth) / 2
    plannerEl.scrollTo({
      left: Math.max(0, plannerEl.scrollLeft + cellRect.left + cellRect.width / 2 - center),
      behavior,
    })
  }

  const scrollToToday = () => {
    requestAnimationFrame(() => requestAnimationFrame(() => centerToday()))
  }

  // Position on entry and after the initial server load, never on ordinary edits.
  useEffect(() => {
    if (page !== 'planner') return
    const frame = requestAnimationFrame(() => centerToday('instant'))
    return () => cancelAnimationFrame(frame)
  }, [page, dbReady])

  const focusTask = task => {
    setPage('planner')

    setTimeout(() => {
      const rowEl = taskRefs.current[task.id]
      const plannerEl = document.querySelector('.planner')

        if (!rowEl || !plannerEl) return

        const targetDate =
          task.dueDate || task.dates?.[0] || task.redDates?.[0]

        const dayIndex = days.findIndex(
          day => format(day, 'yyyy-MM-dd') === targetDate
        )

        const plannerRect = plannerEl.getBoundingClientRect()
        const rowRect = rowEl.getBoundingClientRect()

        const currentScrollTop = plannerEl.scrollTop
        const rowTopInPlanner =
          rowRect.top - plannerRect.top + currentScrollTop

        const nextTop = Math.max(
          0,
          rowTopInPlanner - plannerEl.clientHeight * 0.4
        )

        const nextLeft =
          dayIndex >= 0
            ? Math.max(
                0,
                dayIndex * 32 - plannerEl.clientWidth * 0.35
              )
            : plannerEl.scrollLeft

        plannerEl.scrollTo({
          top: nextTop,
          left: nextLeft,
          behavior: 'smooth',
        })

      setHighlightTaskId(task.id)

      setTimeout(() => {
        setHighlightTaskId(null)
      },5000)
    }, 300)
  }

  const focusHistory = history => {
    const targetProject = visibleProjects.find(project =>
      project.name === history.project_name
    )
    if (!targetProject) return
    const targetTask = targetProject.tasks.find(task => {
      const sameWork =
        (task.work || '') === (history.task_work || '')
      const sameTitle =
        (task.title || '') === (history.task_title || '')
      return sameWork && sameTitle
    })
    if (!targetTask) return
    focusTask({
      ...targetTask,
      projectId: targetProject.id,
      projectName: targetProject.name,
    })
  }

  

  



  const ownerSuggestions = [
    ...new Set(
      flatTasks
        .map(task => task.owner)
        .filter(owner => owner && owner.trim())
    ),
  ]

  const saveProjects = next => {
    if (!canEdit) return
    setProjects(next)
    localStorage.setItem('projectPlannerProjects', JSON.stringify(next))
  }

  const showToast = message => {
  setToast(message)
  setTimeout(() => setToast(''), 2200)
}

const buildSnapshot = () => ({
  savedAt: new Date().toISOString(),
  projects: JSON.parse(JSON.stringify(projects)),
  rangeStart,
  rangeEnd,
  customHolidayDates: JSON.parse(JSON.stringify(customHolidayDates)),
})

const applySnapshot = snapshot => {
    if (!canEdit) return
  if (!snapshot) return

  setProjects(snapshot.projects || [])
  setCustomHolidayDates(snapshot.customHolidayDates || [])

  localStorage.setItem('projectPlannerProjects', JSON.stringify(snapshot.projects || []))
  localStorage.setItem(
    'projectPlannerCustomHolidayDates',
    JSON.stringify(snapshot.customHolidayDates || [])
  )
}

const moveLocalHistory = direction => {
    if (!canEdit) return
  const nextIndex = historyIndex + direction

  if (nextIndex < 0 || nextIndex >= localHistory.length) return

  setHistoryIndex(nextIndex)
  applySnapshot(localHistory[nextIndex])
  showToast(direction < 0 ? '이전 상태로 이동했습니다' : '다음 상태로 이동했습니다')
}
  

  useEffect(() => {

  const handleBeforeUnload = e => {

    if (!isSaving) return

    e.preventDefault()

    e.returnValue = ''

  }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => window.removeEventListener('beforeunload', handleBeforeUnload)

  }, [isSaving])


  const applyServerState = data => {
    setProjects(data.projects)
    setHistories(data.histories)
    revisionRef.current = data.revision
    localStorage.setItem('projectPlannerProjects', JSON.stringify(data.projects))
    if (data.customHolidayDates !== null) {
      setCustomHolidayDates(data.customHolidayDates)
      localStorage.setItem('projectPlannerCustomHolidayDates', JSON.stringify(data.customHolidayDates))
    }
  }

  const downloadBackup = () => {
    const blob = new Blob([JSON.stringify(buildSnapshot(), null, 2)], { type: 'application/json' })
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = `planner-backup-${Date.now()}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(href), 1000)
  }

  const saveAllToDB = async () => {
    if (!canEdit) return
    if (savingRef.current || !dbReady || revisionRef.current === null) return
    const payload = { revision: revisionRef.current, projects, rangeStart, rangeEnd, customHolidayDates }
    const validationError = payloadError(payload)
    if (validationError) { showToast(validationError); setLoadError(validationError); return }
    if (!confirm('현재 화면 데이터를 DB에 저장할까요?')) return
    savingRef.current = true
    setIsSaving(true)
    try {
      const data = await plannerRequest('PUT', {
        revision: revisionRef.current,
        projects,
        rangeStart,
        rangeEnd,
        customHolidayDates,
      })
      applyServerState(data)
      // DB에서 발급한 ID로 스냅샷을 남깁니다.
      const snapshot = { ...buildSnapshot(), projects: data.projects }
      const nextList = [...localHistory.slice(0, historyIndex + 1), snapshot].slice(-3)
      setLocalHistory(nextList)
      setHistoryIndex(nextList.length - 1)
      localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(nextList))
      showToast('DB 저장 완료')
    } catch (error) {
      // 응답 유실 시 커밋 여부를 알 수 없으므로 자동 재시도하지 않습니다.
      if ([400, 413, 415].includes(error.status)) {
        setLoadError(error.message + ' 현재 작업은 유지됩니다. 해당 항목을 수정한 뒤 다시 저장하세요.')
      } else {
        setDbReady(false)
        setLoadError(error.message + ' 로컬 작업은 유지됩니다. 백업 후 다시 불러와 주세요.')
      }
    } finally {
      savingRef.current = false
      setIsSaving(false)
    }
  }

  const loadFromDB = async () => {
    if (loadingRef.current || savingRef.current) return
    loadingRef.current = true
    setDbReady(false)
    setCanEdit(false)
    setScheduleLocked(true)
    setLoadError('')
    try {
      // 원래 로컬 데이터는 덮어쓰기 전에 별도 보관합니다.
      const backup = {}
      for (const key of ['projectPlannerProjects', LOCAL_HISTORY_KEY,
        'projectPlannerRangeStart', 'projectPlannerRangeEnd', 'projectPlannerCustomHolidayDates']) {
        backup[key] = localStorage.getItem(key)
      }
      localStorage.setItem('projectPlannerBeforeServerLoad', JSON.stringify(backup))
      const data = await plannerRequest('GET')
      const localProjects = JSON.parse(localStorage.getItem('projectPlannerProjects') || '[]')
      setCanEdit(data.canEdit === true)
      if (data.canEdit !== true) setScheduleLocked(true)
      const keepLocal = data.canEdit === true && localProjects.length > 0 &&
        JSON.stringify(localProjects) !== JSON.stringify(data.projects) &&
        !confirm('DB 데이터와 로컬 작업이 다릅니다. 확인: DB 불러오기 / 취소: 로컬 작업 유지. 기존 로컬 사본은 별도 보관됩니다.')
      if (keepLocal) {
        revisionRef.current = data.revision
        setHistories(data.histories)
      } else {
        applyServerState(data)
      }
      setDbReady(true)
    } catch (error) {
      setLoadError(error.message + ' 로컬 데이터는 유지됩니다.')
    } finally {
      loadingRef.current = false
    }
  }

  useEffect(() => {
    loadFromDB()
  }, [])

  useEffect(() => {
    const onKeyDown = e => { if (e.key === 'Shift') setIsShiftHeld(true) }
    const onKeyUp = e => { if (e.key === 'Shift') setIsShiftHeld(false) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const reorderProject = (fromId, toId) => {
    if (fromId === toId) return
    const next = [...projects]
    const fromIdx = next.findIndex(p => p.id === fromId)
    const toIdx = next.findIndex(p => p.id === toId)
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    saveProjects(next)
  }

  const reorderTask = (projectId, fromTaskId, toTaskId) => {
    if (fromTaskId === toTaskId) return
    saveProjects(
      projects.map(project => {
        if (project.id !== projectId) return project
        const tasks = [...project.tasks]
        const fromIdx = tasks.findIndex(t => t.id === fromTaskId)
        const toIdx = tasks.findIndex(t => t.id === toTaskId)
        const [moved] = tasks.splice(fromIdx, 1)
        tasks.splice(toIdx, 0, moved)
        return { ...project, tasks }
      })
    )
  }
  
  const moveNextCell = (e, projectId) => {
    if (e.key !== 'Enter' && e.key !== 'Tab') return
    if (e.nativeEvent.isComposing) return
    const inputs = Array.from(document.querySelectorAll('.table-input'))
    const currentIndex = inputs.indexOf(e.currentTarget)
    const nextInput = inputs[currentIndex + 1]
    if (nextInput) {
      return
    }
    e.preventDefault()
    addTaskToProject(projectId)
    setTimeout(() => {
      const nextInputs = Array.from(document.querySelectorAll('.table-input'))
      const target = nextInputs[currentIndex + 1]
      if (target) {
        target.focus()
        target.select()
      }
    }, 0)
  }

  const addProject = () => {
    const now = Date.now()

    saveProjects([
      ...projects,
      {
        id: now,
        name: '',
        tasks: [
          {
            id: now + 1,
            work: '',
            title: '',
            owner: '',
            status: '대기',
            artifactName: '',
            artifactUrl: '',
            artifactUrls: [],
            dates: [],
            redDates: [],
          },
        ],
      },
    ])
  }

  const toggleRedDate = (projectId, taskId, date) => {
    saveProjects(
      projects.map(project =>
        project.id === projectId
          ? {
              ...project,
              tasks: project.tasks.map(task => {
                if (task.id !== taskId) return task
                const redDates = task.redDates || []
                return {
                  ...task,
                  redDates: redDates.includes(date)
                    ? redDates.filter(d => d !== date)
                    : [...redDates, date],
                }
              }),
            }
          : project
      )
    )
  }

  const isRedDateSelected = (task, date) => {
    return task.redDates?.includes(date)
  }

  const addTaskToProject = projectId => {
    saveProjects(
      projects.map(project =>
        project.id === projectId
          ? {
              ...project,
              tasks: [
                ...project.tasks,
                {
                  id: Date.now(),
                  work: '',
                  title: '',
                  owner: '',
                  status: '대기',
                  artifactName: '',
                  artifactUrl: '',
                  artifactUrls: [],
                  dates: [],
                  redDates: [],
                  memoDates: {},
                },
              ],
            }
          : project
      )
    )
  }

  const updateDateMemo = (projectId, taskId, date) => {
    const currentTask = projects
      .find(project => project.id === projectId)
      ?.tasks.find(task => task.id === taskId)
    setMemoEditor({
      projectId,
      taskId,
      date,
      memo: currentTask?.memoDates?.[date] || '',
    })
  }




    const updateProjectName = (projectId, value) => {
    saveProjects(
      projects.map(project =>
        project.id === projectId ? { ...project, name: value } : project
      )
    )
  }

  const updateTask = (projectId, taskId, key, value) => {
    saveProjects(
      projects.map(project =>
        project.id === projectId
          ? {
              ...project,
              tasks: project.tasks.map(task =>
                task.id === taskId ? { ...task, [key]: value } : task
              ),
            }
          : project
      )
    )
  }

  const updateTaskFields = (projectId, taskId, fields) => {
    saveProjects(
      projects.map(project =>
        project.id === projectId
          ? {
              ...project,
              tasks: project.tasks.map(task =>
                task.id === taskId ? { ...task, ...fields } : task
              ),
            }
          : project
      )
    )
  }

  const deleteTask = (projectId, taskId) => {
    if (!confirm('삭제할까?')) return

    saveProjects(
      projects
        .map(project =>
          project.id === projectId
            ? {
                ...project,
                tasks: project.tasks.filter(task => task.id !== taskId),
              }
            : project
        )
        .filter(project => project.tasks.length > 0)
    )
  }

  const cycleStatus = (projectId, taskId) => {
    const order = ['대기', '진행', '완료']

    saveProjects(
      projects.map(project =>
        project.id === projectId
          ? {
              ...project,
              tasks: project.tasks.map(task => {
                if (task.id !== taskId) return task

                const currentIndex = order.indexOf(task.status)
                const nextIndex = (currentIndex + 1) % order.length

                return {
                  ...task,
                  status: order[nextIndex],
                }
              }),
            }
          : project
      )
    )
  }

  const scrollToCurrentMonth = () => {
    setPage('planner')
    scrollToToday()
  }

  const addOneMonth = () => setExtraMonths(months => months + 1)

  // 일정 편집 실수 방지용입니다. 접근 보호는 Vercel에서 처리합니다.
  const toggleScheduleLock = () => { if (canEdit) setScheduleLocked(locked => !locked) }

  const isDateSelected = (task, date) => {
    return task.dates?.includes(date) || false
  }

  const paintDate = (projectId, taskId, date, mode) => {
    saveProjects(
      projects.map(project =>
        project.id === projectId
          ? {
              ...project,
              tasks: project.tasks.map(task => {
                if (task.id !== taskId) return task

                const prevDates = task.dates || []
                let nextDates = prevDates

                if (mode === 'add') {
                  nextDates = prevDates.includes(date)
                    ? prevDates
                    : [...prevDates, date].sort()
                }

                if (mode === 'remove') {
                  nextDates = prevDates.filter(d => d !== date)
                }

                return {
                  ...task,
                  dates: nextDates,
                }
              }),
            }
          : project
      )
    )
  }

  const toggleDate = (projectId, taskId, task, date) => {
    const alreadySelected = isDateSelected(task, date)
    const mode = alreadySelected ? 'remove' : 'add'

    setIsPainting(true)
    setPaintMode(mode)
    paintDate(projectId, taskId, date, mode)
  }

  const paintOverDate = (projectId, taskId, date) => {
    if (!isPainting || !paintMode) return
    paintDate(projectId, taskId, date, paintMode)
  }

  const endPaint = () => {
    setIsPainting(false)
    setPaintMode(null)
  }

  const monthGroups = useMemo(() => {
    const groups = []

    days.forEach(day => {
      const monthKey = format(day, 'yyyy-MM')
      const label = format(day, 'M월')
      const last = groups[groups.length - 1]

      if (last && last.key === monthKey) {
        last.count += 1
      } else {
        groups.push({
          key: monthKey,
          label,
          count: 1,
        })
      }
    })

    return groups
  }, [days])



  const getWeekNumberInMonth = day => {
    const monthStart = startOfMonth(day)
    const monthStartDay = monthStart.getDay()

    let firstWeekStart = new Date(monthStart)

    // 1일이 월/화/수면 그 주가 1주차
    if (monthStartDay >= 1 && monthStartDay <= 3) {
      firstWeekStart.setDate(monthStart.getDate() - (monthStartDay - 1))
    } else {
      // 1일이 목/금/토/일이면 다음 월요일부터 1주차
      const addDays = monthStartDay === 0 ? 1 : 8 - monthStartDay
      firstWeekStart.setDate(monthStart.getDate() + addDays)
    }

    const diff =
      (day.getTime() - firstWeekStart.getTime()) /
      (1000 * 60 * 60 * 24)

    return Math.floor(diff / 7) + 1
  }

  const weekGroups = useMemo(() => {
    const groups = []

    days.forEach(day => {
      const dayOfWeek = day.getDay()

      const monday = new Date(day)
      monday.setDate(day.getDate() - (dayOfWeek - 1))

      const weekKey = format(monday, 'yyyy-MM-dd')
      const last = groups[groups.length - 1]

      if (last && last.key === weekKey) {
        last.count += 1
        return
      }

      const weekNumber = getWeekNumberInMonth(day)

      groups.push({
        key: weekKey,
        label: `${weekNumber}w`,
        count: 1,
      })
    })

    return groups
  }, [days])







  const todayString = format(new Date(), 'yyyy-MM-dd')

  const getDisplayStatus = task => {
      // 완료는 무조건 수동 상태 유지
      if (task.status === '완료') return '완료'
      const taskDates = [...(task.dates || []), ...(task.redDates || [])].sort()
      if (taskDates.length === 0) {
        return task.status || '대기'
      }
      const startDate = taskDates[0]
      const endDate = taskDates[taskDates.length - 1]
      if (todayString < startDate) return '대기'
      if (todayString >= startDate && todayString <= endDate) {
        return '진행'
      }
      // 끝났지만 완료로 직접 바꾸지 않은 건 일단 진행으로 남김
      return '진행'
    }

  const getTaskProgress = task => {
    if (task.status === '완료') return 100
    const taskDates = [...(task.dates || [])].sort()
    if (taskDates.length === 0) return 0
    const startDate = taskDates[0]
    const endDate = taskDates[taskDates.length - 1]
    if (todayString < startDate) return 0
    if (todayString > endDate) return 100
    const passedDays = taskDates.filter(date => date <= todayString).length
    return Math.round((passedDays / taskDates.length) * 100)
  }
  const isLastFridayOfMonth = day => {
    if (!isFriday(day)) return false
    const monthEnd = endOfMonth(day)
    let cursor = monthEnd
    while (cursor.getDay() !== 5) {
      cursor = subDays(cursor, 1)
    }
    return format(cursor, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
  }

  const total = dashboardTasks.length
  const done = dashboardTasks.filter(
    task => getDisplayStatus(task) === '완료'
  ).length
  const doing = dashboardTasks.filter(
    task => getDisplayStatus(task) === '진행'
  ).length
  const waiting = dashboardTasks.filter(
    task => getDisplayStatus(task) === '대기'
  ).length


  const completionRate = total === 0 ? 0 : Math.round((done / total) * 1000) / 10
  const projectProgressSummary = visibleProjects
    .map(project => {
      const tasks = dashboardTasks.filter(
        task => task.projectId === project.id
      )
      if (!project.name?.trim() || tasks.length === 0) return null
      const progress = Math.round(
        tasks.reduce((sum, task) => {
          return sum + getTaskProgress(task)
        }, 0) / tasks.length
      )
      return {
        name: project.name,
        count: tasks.length,
        progress,
      }
    })
    .filter(Boolean)

const projectSummary =
  projectProgressSummary.length > 0
    ? projectProgressSummary
    : [
        {
          name: '프로젝트 없음',
          count: 0,
          progress: 0,
        },
      ]
    .filter(item => item.name !== '이름없는 프로젝트' && item.count > 0)

  const oneWeekAgo = (() => {
    const d = new Date(todayString)
    d.setDate(d.getDate() - 7)
    return d.toISOString().slice(0, 10)
  })()

  const briefProjectSummary = projectProgressSummary.filter(item => {
    if (item.progress < 100) return true
    const project = visibleProjects.find(p => p.name === item.name)
    if (!project) return false
    const allDates = project.tasks.flatMap(t => [...(t.dates || []), ...(t.redDates || [])])
    const lastDate = allDates.length > 0 ? allDates.sort().at(-1) : null
    if (!lastDate) return false
    return lastDate > oneWeekAgo
  })

  const ownerSummary = Object.entries(
    dashboardTasks.reduce((acc, task) => {
      const owner = task.owner || '미지정'
      acc[owner] = (acc[owner] || 0) + 1
      return acc
    }, {})
  )
    .map(([owner, count]) => ({ owner, count }))
    .sort((a, b) => b.count - a.count)

  useEffect(() => {
    if (!selectedOwner && ownerSummary.length > 0) {
      setSelectedOwner(ownerSummary[0].owner)
    }
  }, [selectedOwner, ownerSummary])

  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id)
    }
  }, [selectedProjectId, projects])





  const urgentTasks = dashboardTasks
  .map(task => {
    const dates = [...(task.redDates || []), ...(task.dates || [])].sort()
    return {
      ...task,
      dueDate: dates[dates.length - 1],
    }
  })
  .filter(task => {
    if (!task.dueDate) return false
    if (task.status !== '진행') return false
    const today = new Date(todayString)
    const due = new Date(task.dueDate)
    today.setHours(0, 0, 0, 0)
    due.setHours(0, 0, 0, 0)
    const diffDays = Math.ceil(
      (due - today) / (1000 * 60 * 60 * 24)
    )
    return diffDays >= 0 && diffDays <= 5
  })
  .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
  .slice(0, 5)

  const [showDailyBrief, setShowDailyBrief] = useState(false)

  useEffect(() => {
    if (page !== 'dashboard') return
    const dismissed = localStorage.getItem('dailyBriefDismissed')
    if (dismissed === todayString) return
    setShowDailyBrief(true)
  }, [page])

  const closeDailyBrief = () => setShowDailyBrief(false)

  const dismissDailyBrief = () => {
    localStorage.setItem('dailyBriefDismissed', todayString)
    setShowDailyBrief(false)
  }

  const handleAppMouseUp = () => {
    endPaint()
    setDragging(null)
    setDragOver(null)
  }

  return (
    <div className={`app ${canEdit ? 'admin-mode' : 'viewer-mode'}`} onMouseUp={handleAppMouseUp}>
      <div role="status" style={{ padding: 8, background: '#eef2ff', color: '#172554' }}>
        {isSaving ? '저장 중입니다. 완료될 때까지 편집을 기다려 주세요.' :
          loadError || (dbReady ? (canEdit ? '관리자 · 편집 가능' : '공개 뷰어 · 조회 전용') : '서버 데이터를 확인하고 있습니다…')}
      </div>
      {loadError && <button onClick={downloadBackup}>현재 작업 백업 다운로드</button>}
      <div inert={isSaving ? true : undefined}>
      <datalist id="owner-suggestions">
        {ownerSuggestions.map(owner => (
          <option key={owner} value={owner} />
        ))}
      </datalist>

      <header className="topbar">
      <div className="header-row">
        <div className="page-tabs">
          <button
            className={page === 'dashboard' ? 'active' : ''}
            onClick={() => setPage('dashboard')}
          >
            대시보드
          </button>

          <button
            className={page === 'planner' ? 'active' : ''}
            onClick={() => {
              setPage('planner')
              scrollToToday()
            }}
          >
            플래너
          </button>
          <button
            className={`planner-mobile-hide ${page === 'history' ? 'active' : ''}`}
            onClick={() => setPage('history')}
          >
            히스토리
          </button>
        </div>
        <h1>
          {page === 'planner'
            ? 'Project Planner'
            : page === 'dashboard'
              ? 'Project Dashboard'
              : page === 'history'
                ? 'Project History'
                : 'Code Integrity'}
        </h1>
      </div>

      <div className="toolbar">
        {page === 'planner' ? (
          <>
            <button className="planner-mobile-hide" data-edit-control="true" onClick={addProject}>
              + 프로젝트
            </button>
            <button
              className="planner-mobile-hide"
              onClick={() => setCompactMode(!compactMode)}
            >
              {compactMode ? '축소형' : '전체형'}
            </button>

            <button
              className="planner-mobile-hide"
              onClick={() => setHideCompletedProjects(prev => !prev)}
            >
              {hideCompletedProjects ? '진행프로젝트' : '전체프로젝트'}
            </button>

            <button
              onClick={scrollToCurrentMonth}
              title="전체 일정 범위를 유지하고 이번 달로 이동"
            >
              이번달
            </button>
            <button className="planner-mobile-hide" onClick={addOneMonth}>
              +1개월
            </button>

            <button className="planner-mobile-hide" data-edit-control="true" onClick={toggleScheduleLock}>
              {scheduleLocked ? '🔒 일정 편집 잠금' : '편집중'}
            </button>

            <button
              className="planner-mobile-hide"
              data-edit-control="true" onClick={saveAllToDB}
              disabled={isSaving || !dbReady}
            >
              {isSaving ? '저장중...' : '저장'}
            </button>
            <button
              className="planner-mobile-hide"
              data-edit-control="true" onClick={() => moveLocalHistory(-1)}
              disabled={historyIndex <= 0}
            >
              ←
            </button>
            <button
              className="planner-mobile-hide"
              data-edit-control="true" onClick={() => moveLocalHistory(1)}
              disabled={historyIndex >= localHistory.length - 1}
            >
              →
            </button>
                      </>
        ) : (
          <>
            <button

              onClick={() => {
                setExtraMonths(0)
              }}
            >
              전체기간
            </button>
            <button
              onClick={scrollToCurrentMonth}
              title="전체 일정 범위를 유지하고 이번 달로 이동"
            >
              이번달
            </button>
            <button
              className="planner-mobile-hide"
              onClick={() => setHideCompletedProjects(prev => !prev)}
            >
              {hideCompletedProjects ? '진행프로젝트' : '전체프로젝트'}
            </button>
          </>
        )}
      </div>
    </header>


      {page === 'planner' ? (
        <div className="planner">
          <div className="planner-inner">
            <div className={compactMode ? 'info-panel compact' : 'info-panel'}>
              <div className="info-sticky-header">
                <div className="table-title">AI OPERATION</div>
                <div className="info-header">
                  <div>프로젝트</div>
                  <div>업무</div>
                  <div>상세내용</div>

                  {!compactMode && (
                    <>
                      <div>참조</div>
                      <div>담당자</div>
                    </>
                  )}

                  <div>상태</div>
                  <div></div>
                </div>
              </div>

              {visibleProjects.map(project => (
                <div
                  className={[
                    'project-group',
                    dragging?.type === 'project' && dragOver?.id === project.id && dragging.id !== project.id
                      ? 'drag-over-project'
                      : '',
                  ].join(' ')}
                  key={project.id}
                  onMouseEnter={() => {
                    if (dragging?.type === 'project') setDragOver({ id: project.id })
                  }}
                  onMouseUp={() => {
                    if (dragging?.type === 'project' && dragOver?.id && dragging.id !== dragOver.id) {
                      reorderProject(dragging.id, dragOver.id)
                    }
                    setDragging(null)
                    setDragOver(null)
                  }}
                >
                  <div
                    className={[
                      'project-cell project-bottom-line',
                      !scheduleLocked && isShiftHeld ? 'shift-draggable' : '',
                      dragging?.type === 'project' && dragging.id === project.id ? 'dragging' : '',
                    ].join(' ')}
                    onMouseDown={e => {
                      if (scheduleLocked || !e.shiftKey) return
                      e.preventDefault()
                      setDragging({ type: 'project', id: project.id })
                      setDragOver({ id: project.id })
                    }}
                  >
                    <input
                      className="table-input"
                      value={project.name}
                      disabled={!canEdit || scheduleLocked}
                      onChange={e => updateProjectName(project.id, e.target.value)}
                      onKeyDown={e => moveNextCell(e, project.id)}
                    />
                    <button
                      data-edit-control="true" className="add-task-btn"
                      disabled={!canEdit || scheduleLocked}
                      onClick={() => addTaskToProject(project.id)}
                      title="업무 추가"
                    >
                      +
                    </button>
                  </div>
                  <div className="project-task-list">
                    {project.tasks.map((task, taskIndex) => {
                      const isLastTaskInProject =
                        taskIndex === project.tasks.length - 1
                      return (
                        <div
                          ref={el => {
                            if (el) taskRefs.current[task.id] = el
                          }}
                          className={[
                            'task-row-fields',
                            highlightTaskId === task.id ? 'task-highlight' : '',
                            isLastTaskInProject ? 'project-bottom-line' : '',
                            !scheduleLocked && isShiftHeld ? 'shift-draggable' : '',
                            dragging?.type === 'task' && dragging.taskId === task.id ? 'dragging' : '',
                            dragging?.type === 'task' && dragging.projectId === project.id && dragOver?.taskId === task.id && dragging.taskId !== task.id ? 'drag-over-task' : '',
                          ].join(' ')}
                          key={task.id}
                          onMouseDown={e => {
                            if (scheduleLocked || !e.shiftKey) return
                            e.preventDefault()
                            setDragging({ type: 'task', projectId: project.id, taskId: task.id })
                            setDragOver({ taskId: task.id })
                          }}
                          onMouseEnter={() => {
                            if (dragging?.type === 'task' && dragging.projectId === project.id) {
                              setDragOver({ taskId: task.id })
                            }
                          }}
                          onMouseUp={() => {
                            if (dragging?.type === 'task' && dragging.projectId === project.id && dragOver?.taskId && dragging.taskId !== dragOver.taskId) {
                              reorderTask(project.id, dragging.taskId, dragOver.taskId)
                            }
                            setDragging(null)
                            setDragOver(null)
                          }}
                        >
                          <input
                            className="table-input"
                            onKeyDown={e => moveNextCell(e, project.id)}
                            value={task.work}
                            disabled={!canEdit || scheduleLocked}
                            onChange={e =>
                              updateTask(project.id, task.id, 'work', e.target.value)
                            }
                          />
                          <input
                            className="table-input"
                            onKeyDown={e => moveNextCell(e, project.id)}
                            value={task.title}
                            disabled={!canEdit || scheduleLocked}
                            onChange={e =>
                              updateTask(project.id, task.id, 'title', e.target.value)
                            }
                          />
                          {!compactMode && (
                            <>
                              <div
                                className={
                                  (task.artifactUrls?.length || task.artifactUrl) ? 'doc-cell linked' : 'doc-cell'
                                }
                              >
                                <input
                                  className="table-input"
                                  onKeyDown={e => moveNextCell(e, project.id)}
                                  value={task.artifactName}
                                  disabled={!canEdit || scheduleLocked}
                                  onChange={e =>
                                    updateTask(
                                      project.id,
                                      task.id,
                                      'artifactName',
                                      e.target.value
                                    )
                                  }
                                />
                                <button
                                  className={[
                                    'url-button',
                                    (task.artifactUrls?.length || task.artifactUrl) ? 'linked' : '',
                                    (task.artifactUrls?.length >= 2) ? 'multi' : '',
                                  ].join(' ')}
                                  onClick={() =>
                                    setUrlEditor({
                                      projectId: project.id,
                                      taskId: task.id,
                                      urls: task.artifactUrls?.length
                                        ? task.artifactUrls
                                        : task.artifactUrl
                                          ? [task.artifactUrl]
                                          : [''],
                                    })
                                  }
                                  title="문서 링크 설정"
                                >
                                  {task.artifactUrls?.length >= 2 ? <IconLinkDouble /> : <IconLinkSingle />}
                                </button>
                              </div>
                              <input
                                className="table-input"
                                list="owner-suggestions"
                                onKeyDown={e => moveNextCell(e, project.id)}
                                value={task.owner}
                                disabled={!canEdit || scheduleLocked}
                                onChange={e =>
                                  updateTask(project.id, task.id, 'owner', e.target.value)
                                }
                              />
                            </>
                          )}
                          <div className="status-cell">
                            <div
                              className={`status-pill status-${getDisplayStatus(task)} ${
                                scheduleLocked ? 'locked' : ''
                              }`}
                              onClick={() => {
                                if (scheduleLocked) return
                                cycleStatus(project.id, task.id)
                              }}
                            >
                              {getDisplayStatus(task)}
                            </div>
                          </div>
                          <button
                            data-edit-control="true" className="delete-btn"
                            disabled={!canEdit || scheduleLocked}
                            onClick={() => deleteTask(project.id, task.id)}
                            title="삭제"
                          >
                            x
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="timeline-panel">
              <div className="timeline-header">
                <div className="month-row">
                  {monthGroups.map(month => (
                    <div
                      className="month-cell"
                      key={month.key}
                      style={{ width: `${month.count * 32}px` }}
                    >
                      {month.label}
                    </div>
                  ))}
                </div>

                <div className="week-row">
                  {weekGroups.map(week => (
                    <div
                      className="week-cell"
                      key={week.key}
                      style={{ width: `${week.count * 32}px` }}
                    >
                      {week.label}
                    </div>
                  ))}
                </div>

                <div className="date-row">
                  {days.map(day => {
                    const dateString = format(day, 'yyyy-MM-dd')
                    const isToday = dateString === todayString

                    return (
                      <div
                        className={[
                          'day-cell',
                          isToday ? 'today' : '',
                          isLastFridayOfMonth(day) ? 'last-friday' : '',
                          customHolidayDates.includes(dateString) ? 'custom-holiday' : '',
                        ].join(' ')}
                        onDoubleClick={() => {
                          if (isLastFridayOfMonth(day)) return
                          toggleCustomHolidayDate(dateString)
                        }}
                        key={day.toISOString()}
                        data-date={dateString}
                      >
                        {format(day, 'd')}
                      </div>
                    )
                  })}
                </div>
              </div>

              {visibleProjects.map(project =>
                project.tasks.map((task, taskIndex) => {
                  const isLastTaskInProject = taskIndex === project.tasks.length - 1
                  return (
                    <div
                      className={[
                        'timeline-row',
                        isLastTaskInProject ? 'project-bottom-line' : '',
                        dragging?.type === 'task' && dragging.taskId === task.id ? 'dragging' : '',
                        dragging?.type === 'task' && dragging.projectId === project.id && dragOver?.taskId === task.id && dragging.taskId !== task.id ? 'drag-over-task' : '',
                        dragging?.type === 'project' && dragOver?.id === project.id && dragging.id !== project.id ? 'drag-over-project-line' : '',
                        dragging?.type === 'project' && dragging.id === project.id ? 'dragging' : '',
                      ].join(' ')}
                      key={`${project.id}-${task.id}`}
                    >
                    {days.map(day => {
                      const date = format(day, 'yyyy-MM-dd')
                      const selected = isDateSelected(task, date)
                      const redSelected = isRedDateSelected(task, date)

                      return (
                        <div
                          key={date}
                          className={[
                            'grid-cell',
                            selected ? 'selected' : '',
                            redSelected ? 'red-selected' : '',
                            date === todayString ? 'today-line' : '',
                            isLastFridayOfMonth(day) ? 'last-friday-line' : '',
                            customHolidayDates.includes(date) ? 'custom-holiday-line' : '',
                            task.memoDates?.[date] ? 'has-memo' : '',
                          ].join(' ')}
                          title={task.memoDates?.[date] || ''}
                          onMouseDown={e => {
                            if (scheduleLocked) return
                            if (e.shiftKey) {
                              e.preventDefault()
                              updateDateMemo(project.id, task.id, date)
                              return
                            }
                            toggleDate(project.id, task.id, task, date)
                          }}
                          onDoubleClick={() => {
                            if (scheduleLocked) return
                            toggleRedDate(project.id, task.id, date)
                          }}
                          onMouseEnter={() => {
                            if (scheduleLocked) return
                            paintOverDate(project.id, task.id, date)
                          }}
                        >
                          {task.memoDates?.[date] && (
                            <span className="cell-memo">
                              <span className="cell-memo-text">{task.memoDates[date]}</span>
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })
              )}
            </div>
          </div>
        </div>
        ) : page === 'dashboard' ? (
        <Dashboard
          total={total}
          doing={doing}
          waiting={waiting}
          done={done}
          completionRate={completionRate}
          projectSummary={projectSummary}
          ownerSummary={ownerSummary}
          urgentTasks={urgentTasks}
          projects={visibleProjects}
          selectedProjectId={selectedProjectId}
          setSelectedProjectId={setSelectedProjectId}
          selectedOwner={selectedOwner}
          setSelectedOwner={setSelectedOwner}
          focusTask={focusTask}
          getTaskProgress={getTaskProgress}
          getDisplayStatus={getDisplayStatus}
          hideCompletedProjects={hideCompletedProjects}
          setHideCompletedProjects={setHideCompletedProjects}
          dashboardTasks={dashboardTasks}
        />
        ) : page === 'integrity' ? (

          <><p role="note">이 화면은 수정 전 코드의 정적 분석 자료입니다. 현재 보안 상태를 자동 점검한 결과가 아닙니다.</p><IntegrityCheck projects={projects} /></>

        ) : window.innerWidth > 768 ? (

         <History
          histories={histories}
          focusHistory={focusHistory}
        />

        ) : null}

      {urlEditor && (
        <div className="modal-backdrop" onClick={() => setUrlEditor(null)}>
          <div className="url-modal" onClick={e => e.stopPropagation()}>
            <h3>문서 URL</h3>

            <div className="url-list">
              {urlEditor.urls.map((url, i) => (
                <div className="url-list-row" key={i}>
                  <input
                    readOnly={!canEdit} className="url-url-input"
                    value={url}
                    placeholder="https://..."
                    autoFocus={i === urlEditor.urls.length - 1}
                    onChange={e => setUrlEditor({
                      ...urlEditor,
                      urls: urlEditor.urls.map((u, idx) => idx === i ? e.target.value : u),
                    })}
                  />
                  <button
                    className="open-url-btn"
                    onClick={() => { if (safeUrl(url)) window.open(safeUrl(url), '_blank', 'noopener,noreferrer') }}
                    title="열기"
                  >↗</button>
                  <button
                    data-edit-control="true" className="delete-url-btn"
                    onClick={() => setUrlEditor({
                      ...urlEditor,
                      urls: urlEditor.urls.filter((_, idx) => idx !== i),
                    })}
                    title="삭제"
                  >×</button>
                </div>
              ))}
            </div>

            <button
              data-edit-control="true" className="add-url-btn"
              onClick={() => setUrlEditor({ ...urlEditor, urls: [...urlEditor.urls, ''] })}
            >
              + URL 추가
            </button>

            <div className="modal-actions">
              <button
                data-edit-control="true"
                onClick={() => {
                  if (!canEdit) return
                  const validUrls = urlEditor.urls.filter(u => u.trim())
                  updateTaskFields(urlEditor.projectId, urlEditor.taskId, {
                    artifactUrls: validUrls,
                    artifactUrl: validUrls[0] || '',
                  })
                  setUrlEditor(null)
                }}
              >
                저장
              </button>
              <button onClick={() => setUrlEditor(null)}>{canEdit ? '취소' : '닫기'}</button>
            </div>
          </div>
        </div>
      )}

      {memoEditor && (
        <div className="modal-backdrop">
          <div className="memo-modal">
            <div className="memo-modal-head">
              <h3>셀 메모</h3>
              <span>{memoEditor.date}</span>
            </div>

            <textarea
              readOnly={!canEdit}
              value={memoEditor.memo}
              onChange={e =>
                setMemoEditor({
                  ...memoEditor,
                  memo: e.target.value,
                })
              }
              placeholder="이 날짜에 남길 메모를 입력하세요"
              autoFocus
            />

            <div className="memo-modal-actions">
              <button
                data-edit-control="true" className="danger"
                onClick={() => {
                  const { projectId, taskId, date } = memoEditor

                  saveProjects(
                    projects.map(project =>
                      project.id === projectId
                        ? {
                            ...project,
                            tasks: project.tasks.map(task => {
                              if (task.id !== taskId) return task

                              const nextMemoDates = { ...(task.memoDates || {}) }
                              delete nextMemoDates[date]

                              return {
                                ...task,
                                memoDates: nextMemoDates,
                              }
                            }),
                          }
                        : project
                    )
                  )

                  setMemoEditor(null)
                }}
              >
                삭제
              </button>

              <div className="memo-modal-right">
                <button onClick={() => setMemoEditor(null)}>{canEdit ? '취소' : '닫기'}</button>

                <button
                  data-edit-control="true" className="primary"
                  onClick={() => {
                    const { projectId, taskId, date, memo } = memoEditor

                    saveProjects(
                      projects.map(project =>
                        project.id === projectId
                          ? {
                              ...project,
                              tasks: project.tasks.map(task => {
                                if (task.id !== taskId) return task

                                const nextMemoDates = { ...(task.memoDates || {}) }
                                const memoText = memo.trim()

                                if (memoText) {
                                  nextMemoDates[date] = memoText
                                } else {
                                  delete nextMemoDates[date]
                                }

                                return {
                                  ...task,
                                  memoDates: nextMemoDates,
                                }
                              }),
                            }
                          : project
                      )
                    )

                    setMemoEditor(null)
                  }}
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDailyBrief && (
        <DailyBrief
          todayString={todayString}
          projectProgressSummary={briefProjectSummary}
          total={total}
          doing={doing}
          done={done}
          waiting={waiting}
          urgentTasks={urgentTasks}
          onClose={closeDailyBrief}
          onDismiss={dismissDailyBrief}
        />
      )}

      {toast && (
        <div className="toast">
          {toast}
        </div>

)}

      </div>
    </div>
  )
}

function DailyBrief({
  todayString,
  projectProgressSummary,
  total,
  doing,
  done,
  waiting,
  urgentTasks,
  onClose,
  onDismiss,
}) {
  const [speaking, setSpeaking] = useState(false)

  const dateLabel = (() => {
    const d = new Date(todayString)
    const weekDays = ['일', '월', '화', '수', '목', '금', '토']
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${weekDays[d.getDay()]}요일`
  })()

  const buildSpeechText = () => {
    const lines = []
    lines.push(`${dateLabel} 업무 브리핑입니다. 안녕하세요!`)

    if (projectProgressSummary.length > 0) {
      lines.push('프로젝트별 진도를 확인해볼게요.')
      projectProgressSummary.forEach(item => {
        let sentence = `${item.name}은 현재 ${item.progress}퍼센트 진행됐어요.`
        if (item.progress === 100) sentence += ' 완료됐네요, 수고하셨습니다!'
        else if (item.progress >= 70) sentence += ' 거의 다 왔어요!'
        else if (item.progress > 0 && item.progress < 30) sentence += ' 초반부예요, 파이팅!'
        lines.push(sentence)
      })
    }

    if (urgentTasks.length > 0) {
      lines.push(`종료가 임박한 업무가 ${urgentTasks.length}개 있어요.`)
      urgentTasks.forEach(t => {
        const diffDays = Math.ceil((new Date(t.dueDate) - new Date(todayString)) / (1000 * 60 * 60 * 24))
        const owner = t.owner || '담당자 미지정'
        const name = t.title || t.work || '이름없는 업무'
        lines.push(`${owner}님의 ${name}, 디데이 ${diffDays}일 남았어요.`)
      })
      lines.push('놓치지 않도록 확인해주세요!')
    } else {
      lines.push('오늘 마감이 임박한 업무는 없어요. 여유롭게 진행하세요!')
    }

    return lines.join(' ')
  }

  const handleSpeak = () => {
    if (!window.speechSynthesis) return
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    const text = buildSpeechText()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'ko-KR'
    utter.rate = 1.05
    utter.onend = () => setSpeaking(false)
    utter.onerror = () => setSpeaking(false)
    setSpeaking(true)
    window.speechSynthesis.speak(utter)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="daily-brief-modal" onClick={e => e.stopPropagation()}>
        <div className="daily-brief-header">
          <div className="daily-brief-date">{dateLabel} 업무 브리핑</div>
          <button
            className={`daily-brief-speak ${speaking ? 'active' : ''}`}
            onClick={handleSpeak}
            title={speaking ? '음성 중지' : '음성으로 듣기'}
          >
            {speaking ? '■' : '▶'}
          </button>
        </div>

        <div className="daily-brief-lines">
          <p>안녕하세요! 오늘도 좋은 하루 되세요 😊</p>

          {projectProgressSummary.length > 0 && (
            <>
              <p>프로젝트별 진도를 확인해볼게요.</p>
              <ul className="daily-brief-list">
                {projectProgressSummary.map(item => (
                  <li key={item.name}>
                    <strong>{item.name}</strong>은 현재{' '}
                    <span className={`brief-progress ${item.progress >= 80 ? 'high' : item.progress >= 40 ? 'mid' : 'low'}`}>
                      {item.progress}%
                    </span>{' '}
                    진행됐어요.
                    {item.progress === 100 && ' 완료됐네요! 수고하셨습니다 🎉'}
                    {item.progress >= 70 && item.progress < 100 && ' 거의 다 왔어요!'}
                    {item.progress > 0 && item.progress < 30 && ' 초반부예요, 파이팅!'}
                  </li>
                ))}
              </ul>
            </>
          )}

          {urgentTasks.length > 0 && (
            <div className="daily-brief-urgent">
              ⚠️ 종료가 임박한 업무가 <strong>{urgentTasks.length}개</strong> 있어요.
              <ul className="daily-brief-list">
                {urgentTasks.map(t => {
                  const diffDays = Math.ceil((new Date(t.dueDate) - new Date(todayString)) / (1000 * 60 * 60 * 24))
                  return (
                    <li key={t.id}>
                      <strong>{t.owner || '미지정'}</strong>님의{' '}
                      <strong>{t.title || t.work || '이름없는 업무'}</strong> —{' '}
                      D-{diffDays}
                    </li>
                  )
                })}
              </ul>
              놓치지 않도록 확인해주세요!
            </div>
          )}

          {urgentTasks.length === 0 && (
            <p>오늘 마감이 임박한 업무는 없어요. 여유롭게 진행하세요 👍</p>
          )}
        </div>

        <div className="daily-brief-actions">
          <button className="daily-brief-dismiss" onClick={onDismiss}>
            오늘 하루 그만보기
          </button>
          <button className="daily-brief-close" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

function DonutChart({ total, doing, waiting, done }) {
  const size = 120
  const r = 42
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r

  const segments = [
    { value: doing,   color: '#3b82f6' },
    { value: waiting, color: '#f59e0b' },
    { value: done,    color: '#84cc16' },
  ]

  let offset = 0
  const paths = total === 0
    ? [{ color: '#e5e7eb', dash: circumference, gap: 0, offset: 0 }]
    : segments.map(seg => {
        const dash = (seg.value / total) * circumference
        const item = { color: seg.color, dash, gap: circumference - dash, offset }
        offset += dash
        return item
      })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {paths.map((p, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={p.color}
          strokeWidth="18"
          strokeDasharray={`${p.dash} ${p.gap}`}
          strokeDashoffset={-p.offset}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      ))}
      <circle cx={cx} cy={cy} r="30" fill="white" />
    </svg>
  )
}

function Dashboard({
  total,
  doing,
  waiting,
  done,
  completionRate,
  projectSummary,
  ownerSummary,
  urgentTasks,
  projects,
  selectedProjectId,
  setSelectedProjectId,
  selectedOwner,
  setSelectedOwner,
  focusTask,
  getTaskProgress,
  getDisplayStatus,
  hideCompletedProjects,
  setHideCompletedProjects,
  dashboardTasks,
}) {

  const dashboardProjectIds = [
    ...new Set(dashboardTasks.map(task => task.projectId)),
  ]

  const dashboardProjects = projects.filter(project =>
    dashboardProjectIds.includes(project.id)
  )

  const selectedProject =
    dashboardProjects.find(project => project.id === selectedProjectId) ||
    dashboardProjects[0]
  const selectedTasks = selectedProject
    ? dashboardTasks.filter(task => task.projectId === selectedProject.id)
    : []
  const projectProgress =
    selectedTasks.length === 0
      ? 0
      : Math.round(
          selectedTasks.reduce((sum, task) => {
            if (task.status === '완료') return sum + 100
            if (task.status === '진행') return sum + 50
            return sum
          }, 0) / selectedTasks.length
        )
  const ownerNames = ownerSummary.map(item => item.owner)
  const activeOwner = selectedOwner || ownerNames[0] || ''

  const ownerTasks = dashboardTasks.filter(
    task => task.owner === activeOwner
  )

  const ownerAvgProgress =
  ownerTasks.length === 0
    ? 0
    : Math.round(
        ownerTasks.reduce((sum, task) => {
          return sum + getTaskProgress(task)
        }, 0) / ownerTasks.length
      )







  return (
    <div className="dashboard">
      <div className="dashboard-cards">
        <div className="dashboard-card simple">
          <span>전체 업무</span>
          <strong>{total}개</strong>
        </div>

        <div className="dashboard-card simple">
          <span>진행 중</span>
          <strong>{doing}개</strong>
        </div>

        <div className="dashboard-card simple">
          <span>대기 중</span>
          <strong>{waiting}개</strong>
        </div>

       <div className="dashboard-card simple">
          <span>완료</span>
          <strong>{done}개</strong>
        </div>

        <div className="dashboard-card simple">
          <span>완료율</span>
          <strong>{completionRate}%</strong>
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-panel">
          <h3>프로젝트별 진도율</h3>
          <div className="project-progress-list">
            {projectSummary.slice(0, 5).map(item => (
              <div className="project-progress-row" key={item.name}>
                <span className="project-progress-name">
                  {item.name}
                </span>
                <div className="project-progress-track">
                  <i style={{ width: `${item.progress}%` }} />
                </div>
                <b>{item.progress}%</b>
              </div>
            ))}
          </div>
        </section>

        <section className="dashboard-panel">
          <h3>상태별 업무 비율</h3>

          <div className="donut-row">
            <DonutChart total={total} doing={doing} waiting={waiting} done={done} />

            <div className="dashboard-legend">
              <div>
                <span className="legend-dot blue"></span>
                <span>진행</span>
                <b>{doing}</b>
              </div>
              <div>
                <span className="legend-dot orange"></span>
                <span>대기</span>
                <b>{waiting}</b>
              </div>
              <div>
                <span className="legend-dot green"></span>
                <span>완료</span>
                <b>{done}</b>
              </div>
            </div>
          </div>
        </section>

        <section className="dashboard-panel">
          <h3>담당자별 업무 수</h3>

          <div className="owner-bars">
            {ownerSummary.map(item => (
              <div className="owner-row" key={item.owner}>
                <button
                  className="owner-click"
                  onClick={() => setSelectedOwner(item.owner)}
                >
                  {item.owner}
                </button>
                <div>
                  <i style={{ width: `${Math.min(item.count * 8, 100)}%` }} />
                </div>
                <b>{item.count}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="dashboard-panel">
          <h3>종료 예정 업무</h3>

          <div className="urgent-list">
            {urgentTasks.length === 0 ? (
              <p className="empty-text">표시할 업무가 없습니다.</p>
              ) : (
                urgentTasks.map(task => {
                  const today = new Date()
                  const due = new Date(task.dueDate)

                  today.setHours(0, 0, 0, 0)
                  due.setHours(0, 0, 0, 0)
                  const diffDays = Math.ceil
                  (
                    (due - today) / (1000 * 60 * 60 * 24)
                  )

                  return (
                    <div key={task.id} className="urgent-row clickable" onClick={() => focusTask(task)}>
                      <span>
                        {task.title || task.work || '이름없는 업무'}
                        <em>{task.owner || '미지정'}</em>
                      </span>
                      <b>
                        {task.dueDate.replaceAll('-', '.')}
                        {' '}
                        (D-{diffDays})
                      </b>
                    </div>
                  )
                })
              )
            }
          </div>
        </section>
      </div>

        <div className="dashboard-detail-grid">
        <section className="project-board">
          <div className="project-board-head">
            <h3>프로젝트별 업무 현황</h3>
            <strong>
              {selectedProject?.name || '이름없는 프로젝트'} · 평균 진도율{' '}
              {projectProgress}%
            </strong>
          </div>

          <div className="project-bubbles">
            {dashboardProjects
              .filter(project => project.name && project.name.trim())
              .map(project => (
                <button
                  key={project.id}
                  className={selectedProject?.id === project.id ? 'active' : ''}
                  onClick={() => setSelectedProjectId(project.id)}
                >
                  {project.name}
                </button>
              ))}
          </div>

          <div className="project-task-table">
            <div className="project-task-header">
              <span>업무</span>
              <span>상세내용</span>
              <span>참조</span>
              <span>상태</span>
              <span>진도율</span>
            </div>

            {selectedTasks.length === 0 ? (
              <div className="project-task-empty">업무가 없습니다.</div>
            ) : (
              selectedTasks.map(task => {
                const progress = getTaskProgress(task)

                return (
                  <div className="project-task-row" key={task.id}>
                    <span>{task.work || '-'}</span>
                    <span>{task.title || '-'}</span>
                    <span>
                    {task.artifactUrls?.length ? (
                      <span className="task-doc-links">
                        {task.artifactUrls.map((url, i) => (
                          <a key={i} href={safeUrl(url)} target="_blank" rel="noreferrer" className="task-doc-link">
                            {task.artifactName || `문서${i + 1}`}
                          </a>
                        ))}
                      </span>
                    ) : task.artifactUrl ? (
                      <a href={safeUrl(task.artifactUrl)} target="_blank" rel="noreferrer" className="task-doc-link">
                        {task.artifactName || '문서열기'}
                      </a>
                    ) : '-'}
                  </span>
                    <span>{getDisplayStatus(task)}</span>

                    <span className="project-progress-cell">
                      <div className="project-progress-bar">
                        <i style={{ width: `${progress}%` }} />
                      </div>
                      <b>{progress}%</b>
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </section>

        <section className="project-board owner-board">
          <div className="project-board-head">

            <h3>담당자별 업무 현황</h3>
            <strong>
              {activeOwner || '미지정'} · 평균 수행율 {ownerAvgProgress}%
            </strong>
          </div>

          <div className="bubble-scroll">
            <div className="project-bubbles">
              {ownerNames.map(owner => (
                <button
                  key={owner}
                  className={selectedOwner === owner ? 'active' : ''}
                  onClick={() => setSelectedOwner(owner)}
                >
                  {owner}
                </button>
              ))}
            </div>
          </div>

          <div className="project-task-table">
            <div className="owner-task-header">
              <span>프로젝트</span>
              <span>업무</span>
              <span>상세내용</span>
              <span>상태</span>
              <span>진도율</span>
              <span>담당자</span>
            </div>

            {ownerTasks.length === 0 ? (
              <div className="project-task-empty">업무가 없습니다.</div>
            ) : (
              ownerTasks.map(task => {
                const progress = getTaskProgress(task)

                return (
                  <div className="owner-task-row" key={`${task.projectName}-${task.id}`}>
                    <span>{task.projectName}</span>
                    <span>{task.work || '-'}</span>
                    <span>{task.title || '-'}</span>
                    <span>{getDisplayStatus(task)}</span>

                    <span className="project-progress-cell">
                      <div className="project-progress-bar">
                        <i style={{ width: `${progress}%` }} />
                      </div>
                      <b>{progress}%</b>
                    </span>

                    <span>{task.owner || '미지정'}</span>
                  </div>
                )
              })
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function getHistoryType(action) {
  if (['프로젝트 삭제', '업무 삭제'].includes(action)) return '삭제'
  if (action === '순서 이동') return '이동'
  return '변경'
}

function buildHistorySentence(history) {
  const task = history.task_title || history.task_work || ''
  const before = history.before_value || ''
  const after = history.after_value || ''
  const field = history.field_name || ''
  const taskLabel = task ? `'${task}'` : '업무'

  switch (history.action) {
    case '프로젝트 삭제':
      return `프로젝트가 삭제되었습니다.`
    case '업무 삭제':
      return `${taskLabel} 업무가 삭제되었습니다.`
    case '프로젝트명 변경':
      return `프로젝트 이름이 '${before}'에서 '${after}'로 변경되었습니다.`
    case '업무 정보 변경':
      if (after === '') {
        return `${taskLabel}의 ${field}이(가) '${before}'에서 삭제되었습니다.`
      }
      return `${taskLabel}의 ${field}이(가) '${before}'에서 '${after}'로 변경되었습니다.`
    case '일정 변경': {
      const formatDates = str => str ? str.split(',').map(d => d.replace(/-/g, '.')).join(', ') : '-'
      if (after === '') {
        return `${taskLabel}의 일정이 삭제되었습니다. (이전: ${formatDates(before)})`
      }
      return `${taskLabel}의 일정이 변경되었습니다. ${formatDates(before)} → ${formatDates(after)}`
    }
    case '프로젝트 추가':
      return '프로젝트가 추가되었습니다.'
    case '업무 추가':
      return `${taskLabel} 업무가 추가되었습니다.`
    case '일정·메모 변경':
      return `${taskLabel}의 일정 또는 메모가 변경되었습니다.`
    case '순서 이동':
      return `${taskLabel}의 순서가 변경되었습니다.`
    default:
      return history.action || '-'
  }
}

function History({ histories, focusHistory }) {
  return (
    <div className="history-page">
      <section className="history-board">
        <div className="history-list">
          <div className="history-list-header">
            <span>수정시각</span>
            <span>타입</span>
            <span>프로젝트</span>
            <span>변경내용</span>
          </div>
          {histories.length === 0 ? (
            <div className="history-empty">수정 이력이 없습니다.</div>
          ) : (
            histories.map(history => {
              const isFocusable =
                !['업무 삭제', '프로젝트 삭제'].includes(history.action)
              const sentence = buildHistorySentence(history)
              return (
                <div
                  className={['history-item', isFocusable ? 'clickable' : ''].join(' ')}
                  key={history.id}
                  onClick={() => {
                    if (!isFocusable) return
                    focusHistory(history)
                  }}
                >
                  <span className="history-time">
                    {new Date(history.created_at).toLocaleString('ko-KR', {
                      month: '2-digit', day: '2-digit',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                  <span className={`history-type type-${getHistoryType(history.action)}`}>
                    {getHistoryType(history.action)}
                  </span>
                  <span className="history-project">{history.project_name || '-'}</span>
                  <span className="history-sentence">{sentence}</span>
                </div>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}