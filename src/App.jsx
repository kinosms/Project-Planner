import { useMemo, useState } from 'react'
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

export default function App() {
  const [projects, setProjects] = useState(() => {
    const savedProjects = localStorage.getItem('projectPlannerProjects')
    if (savedProjects) {
      return JSON.parse(savedProjects)
    }
    return []
  })

  const [compactMode, setCompactMode] = useState(false)
  const [rangeStart, setRangeStart] = useState('2026-04-01')
  const [rangeEnd, setRangeEnd] = useState('2026-07-31')
  const [isPainting, setIsPainting] = useState(false)
  const [paintMode, setPaintMode] = useState(null)
  const [urlEditor, setUrlEditor] = useState(null)
  const [scheduleLocked, setScheduleLocked] = useState(true)

  const days = useMemo(() => {
    return eachDayOfInterval({
      start: new Date(rangeStart),
      end: new Date(rangeEnd),
    }).filter(day => {
      const dayOfWeek = day.getDay()
      return dayOfWeek !== 0 && dayOfWeek !== 6
    })
  }, [rangeStart, rangeEnd])

  const flatTasks = projects.flatMap(project =>
    project.tasks.map(task => ({
      ...task,
      projectId: project.id,
      projectName: project.name,
    }))
  )

  const ownerSuggestions = [
    ...new Set(
      flatTasks
        .map(task => task.owner)
        .filter(owner => owner && owner.trim())
    ),
  ]

  const saveProjects = next => {
    setProjects(next)
    localStorage.setItem('projectPlannerProjects', JSON.stringify(next))
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
            dates: [],
          },
        ],
      },
    ])
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
                  dates: [],
                },
              ],
            }
          : project
      )
    )
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

  const setRange = mode => {
    if (mode === 'month') {
      const start = startOfMonth(new Date())
      const end = endOfMonth(new Date())
      setRangeStart(format(start, 'yyyy-MM-dd'))
      setRangeEnd(format(end, 'yyyy-MM-dd'))
    }

    if (mode === '3months') {
      const start = startOfMonth(new Date(rangeStart))
      const end = endOfMonth(addMonths(start, 2))
      setRangeEnd(format(end, 'yyyy-MM-dd'))
    }

    if (mode === '6months') {
      const start = startOfMonth(new Date(rangeStart))
      const end = endOfMonth(addMonths(start, 5))
      setRangeEnd(format(end, 'yyyy-MM-dd'))
    }
  }

  const addOneMonth = () => {
    const nextEnd = endOfMonth(addMonths(new Date(rangeEnd), 1))
    setRangeEnd(format(nextEnd, 'yyyy-MM-dd'))
  }

  const goToday = () => {
    const today = new Date()
    const start = startOfMonth(today)
    const end = endOfMonth(today)

    setRangeStart(format(start, 'yyyy-MM-dd'))
    setRangeEnd(format(end, 'yyyy-MM-dd'))
  }

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

  const getFirstWeekStartOfMonth = date => {
    const monthStart = startOfMonth(date)
    const day = monthStart.getDay()

    // 일요일이면 다음 월요일
    if (day === 0) {
      const nextMonday = new Date(monthStart)
      nextMonday.setDate(monthStart.getDate() + 1)
      return nextMonday
    }

    // 월/화/수면 그 주를 1주차로 인정
    if (day >= 1 && day <= 3) {
      const monday = new Date(monthStart)
      monday.setDate(monthStart.getDate() - (day - 1))
      return monday
    }

    // 목/금/토면 다음 월요일부터 1주차
    const nextMonday = new Date(monthStart)
    nextMonday.setDate(monthStart.getDate() + (8 - day))
    return nextMonday
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



const weekGroups = useMemo(() => {
  const groups = []
  const weekCountByMonth = {}

  days.forEach(day => {
    const dayOfWeek = day.getDay()

    const monday = new Date(day)
    monday.setDate(day.getDate() - (dayOfWeek - 1))

    const mondayMonthKey = format(monday, 'yyyy-MM')

    if (!weekCountByMonth[mondayMonthKey]) {
      weekCountByMonth[mondayMonthKey] = 0
    }

    const last = groups[groups.length - 1]
    const weekKey = format(monday, 'yyyy-MM-dd')

    if (last && last.key === weekKey) {
      last.count += 1
    } else {
      weekCountByMonth[mondayMonthKey] += 1

      groups.push({
        key: weekKey,
        label: `${weekCountByMonth[mondayMonthKey]}w`,
        count: 1,
      })
    }
  })

  return groups
}, [days])







  const todayString = format(new Date(), 'yyyy-MM-dd')
  const isLastFridayOfMonth = day => {
    if (!isFriday(day)) return false
    const monthEnd = endOfMonth(day)
    let cursor = monthEnd
    while (cursor.getDay() !== 5) {
      cursor = subDays(cursor, 1)
    }
    return format(cursor, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
  }

  const total = flatTasks.length
  const done = flatTasks.filter(task => task.status === '완료').length
  const doing = flatTasks.filter(task => task.status === '진행').length
  const waiting = flatTasks.filter(task => task.status === '대기').length

  return (
    <div className="app" onMouseUp={endPaint}>
      <datalist id="owner-suggestions">
        {ownerSuggestions.map(owner => (
          <option key={owner} value={owner} />
        ))}
      </datalist>

      <header className="topbar">
        <h1>Project Planner</h1>

        <div className="toolbar">
          <button onClick={addProject}>+ 프로젝트</button>

          <button onClick={() => setCompactMode(!compactMode)}>
            {compactMode ? '전체형' : '축소형'}
          </button>

          <button onClick={goToday}>오늘</button>
          <button onClick={() => setRange('month')}>이번달</button>
          <button onClick={() => setRange('3months')}>3개월</button>
          <button onClick={() => setRange('6months')}>6개월</button>
          <button onClick={addOneMonth}>+1개월</button>

          <input
            type="date"
            value={rangeStart}
            onChange={e => setRangeStart(e.target.value)}
          />

          <input
            type="date"
            value={rangeEnd}
            onChange={e => setRangeEnd(e.target.value)}
          />
          <button
            onClick={() => setScheduleLocked(v => !v)}
          >
            {scheduleLocked ? '🔒 일정잠금' : '🔓 편집중'}
          </button>

          <div className="stats">
            <span>전체 {total}</span>
            <span>진행 {doing}</span>
            <span>대기 {waiting}</span>
            <span>완료 {done}</span>
          </div>
        </div>
      </header>

      <div className="planner">
        <div className="planner-inner">
          <div className={compactMode ? 'info-panel compact' : 'info-panel'}>
            <div className="table-title">AI OPERATION</div>

            <div className="info-header">
              <div>프로젝트</div>
              <div>업무</div>
              <div>상세내용</div>

              {!compactMode && (
                <>
                  <div>문서</div>
                  <div>담당자</div>
                </>
              )}

              <div>상태</div>
              <div></div>
            </div>

            {projects.map(project => (
              <div className="project-group" key={project.id}>
                <div className="project-cell">
                  <input
                    className="table-input"
                    value={project.name}
                    onChange={e => updateProjectName(project.id, e.target.value)}
                    onKeyDown={e => moveNextCell(e, project.id)}
                  />

                  <button
                    className="add-task-btn"
                    onClick={() => addTaskToProject(project.id)}
                    title="업무 추가"
                  >
                    +
                  </button>
                </div>

                <div className="project-task-list">
                  {project.tasks.map(task => (
                    <div className="task-row-fields" key={task.id}>
                      <input
                        className="table-input"
                        onKeyDown={e => moveNextCell(e, project.id)}
                        value={task.work}
                        onChange={e =>
                          updateTask(project.id, task.id, 'work', e.target.value)
                        }
                      />

                      <input
                        className="table-input"
                        onKeyDown={e => moveNextCell(e, project.id)}
                        value={task.title}
                        onChange={e =>
                          updateTask(project.id, task.id, 'title', e.target.value)
                        }
                      />

                      {!compactMode && (
                        <>
                          <div className="doc-cell">
                            <input
                              className="table-input"
                              onKeyDown={e => moveNextCell(e, project.id)}
                              value={task.artifactName}
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
                              className={
                                task.artifactUrl
                                  ? 'url-button linked'
                                  : 'url-button'
                              }
                              onClick={() =>
                                setUrlEditor({
                                  projectId: project.id,
                                  taskId: task.id,
                                  url: task.artifactUrl || '',
                                })
                              }
                              title="문서 링크 설정"
                            >
                              🔗
                            </button>
                          </div>

                          <input
                            className="table-input"
                            list="owner-suggestions"
                            onKeyDown={e => moveNextCell(e, project.id)}
                            value={task.owner}
                            onChange={e =>
                              updateTask(
                                project.id,
                                task.id,
                                'owner',
                                e.target.value
                              )
                            }
                          />
                        </>
                      )}

                      <div className="status-cell">
                        <div
                          className={`status-pill status-${task.status}`}
                          onClick={() => cycleStatus(project.id, task.id)}
                        >
                          {task.status}
                        </div>
                      </div>

                      <button
                        className="delete-btn"
                        onClick={() => deleteTask(project.id, task.id)}
                        title="삭제"
                      >
                        x
                      </button>
                    </div>
                  ))}
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
                      ].join(' ')}
                      key={day.toISOString()}
                    >
                      {format(day, 'd')}
                    </div>
                  )
                })}
              </div>
            </div>

            {projects.map(project =>
              project.tasks.map(task => (
                <div className="timeline-row" key={`${project.id}-${task.id}`}>
                  {days.map(day => {
                    const date = format(day, 'yyyy-MM-dd')
                    const selected = isDateSelected(task, date)

                    return (
                      <div
                        key={date}
                        className={[
                          'grid-cell',
                          selected ? 'selected' : '',
                          date === todayString ? 'today-line' : '',
                          isLastFridayOfMonth(day) ? 'last-friday-line' : '',
                        ].join(' ')}
                        onMouseDown={() => {
                          if (scheduleLocked) return
                          toggleDate(project.id, task.id, task, date)
                        }}
                        onMouseEnter={() => {
                          if (scheduleLocked) return
                          paintOverDate(project.id, task.id, date)
                        }}
                      />
                    )
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {urlEditor && (
        <div className="modal-backdrop">
          <div className="url-modal">
            <h3>문서 URL 입력</h3>

            <input
              value={urlEditor.url}
              onChange={e =>
                setUrlEditor({
                  ...urlEditor,
                  url: e.target.value,
                })
              }
              placeholder="https://..."
              autoFocus
            />

            <div className="modal-actions">
              <button
                onClick={() => {
                  updateTask(
                    urlEditor.projectId,
                    urlEditor.taskId,
                    'artifactUrl',
                    urlEditor.url
                  )
                  setUrlEditor(null)
                }}
              >
                저장
              </button>

              <button onClick={() => setUrlEditor(null)}>취소</button>

              <button
                onClick={() => {
                  updateTask(urlEditor.projectId, urlEditor.taskId, 'artifactUrl', '')
                  setUrlEditor(null)
                }}
              >
                URL 삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}