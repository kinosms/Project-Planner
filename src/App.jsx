import { supabase } from './supabase'
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
  const [rangeStart, setRangeStart] = useState(() => {
  return localStorage.getItem('projectPlannerRangeStart') || '2026-04-01'
  })

  const [rangeEnd, setRangeEnd] = useState(() => {
    return localStorage.getItem('projectPlannerRangeEnd') || '2026-07-31'
  })
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


  const saveAllToDB = async () => {
    if (!confirm('현재 화면 데이터를 DB에 저장할까?')) return

    const { error: deleteError } = await supabase
      .from('projects')
      .delete()
      .neq('id', 0)

    if (deleteError) {
      console.log('delete error=', deleteError)
      alert('기존 데이터 삭제 실패')
      return
    }

    for (const project of projects) {
      const { data: insertedProjects, error: projectError } = await supabase
        .from('projects')
        .insert({ name: project.name || '' })
        .select()

      if (projectError) {
        console.log('project error=', projectError)
        alert('프로젝트 저장 실패')
        return
      }

      const insertedProject = insertedProjects[0]

      for (const task of project.tasks) {
        const { data: insertedTasks, error: taskError } = await supabase
          .from('tasks')
          .insert({
            project_id: insertedProject.id,
            work: task.work || '',
            title: task.title || '',
            owner: task.owner || '',
            status: task.status || '대기',
            artifact_name: task.artifactName || '',
            artifact_url: task.artifactUrl || '',
          })
          .select()

        if (taskError) {
          console.log('task error=', taskError)
          alert('업무 저장 실패')
          return
        }

        const insertedTask = insertedTasks[0]

        if (task.dates?.length) {
          const rows = task.dates.map(date => ({
            task_id: insertedTask.id,
            work_date: date,
            color: 'blue',
          }))

          const { error: dateError } = await supabase
            .from('task_dates')
            .insert(rows)

          if (dateError) {
            console.log('date error=', dateError)
            alert('일정 저장 실패')
            return
          }
        }
      }
    }

    alert('DB 저장 완료')
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

  const updateRange = (start, end) => {
    setRangeStart(start)
    setRangeEnd(end)
    localStorage.setItem('projectPlannerRangeStart', start)
    localStorage.setItem('projectPlannerRangeEnd', end)
  }

  const setRange = mode => {
    if (mode === 'month') {
      const start = startOfMonth(new Date())
      const end = endOfMonth(new Date())
      updateRange(
        format(start, 'yyyy-MM-dd'),
        format(end, 'yyyy-MM-dd')
      )
    }

    if (mode === '3months') {
      const end = endOfMonth(new Date())
      const start = startOfMonth(addMonths(end, -2))
      updateRange(
        format(start, 'yyyy-MM-dd'),
        format(end, 'yyyy-MM-dd')
      )
    }

    if (mode === '6months') {
      const end = endOfMonth(new Date())
      const start = startOfMonth(addMonths(end, -5))
      updateRange(
        format(start, 'yyyy-MM-dd'),
        format(end, 'yyyy-MM-dd')
      )
    }
  }

  const addOneMonth = () => {
    const nextEnd = endOfMonth(addMonths(new Date(rangeEnd), 1))
    setRangeEnd(format(nextEnd, 'yyyy-MM-dd'))
  }

const toggleScheduleLock = () => {
  if (!scheduleLocked) {
    setScheduleLocked(true)
    return
  }

  const password = prompt('짐승거인과 관계된 운동은')
  if (password === '야구') {
    setScheduleLocked(false)
  } else {
    alert('비밀번호가 맞지 않아')
  }
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

  const getWeekMonthKey = day => {
    const monthStart = startOfMonth(day)
    const monthStartDay = monthStart.getDay()

    // 그 달 1일이 월/화/수면 그 주부터 해당 월 1주차
    if (monthStartDay >= 1 && monthStartDay <= 3) {
      return format(day, 'yyyy-MM')
    }

    // 그 달 1일이 목/금/토/일이면 첫 월요일 전까지는 이전 달 마지막 주
    const firstMonday = new Date(monthStart)

    if (monthStartDay === 0) {
      firstMonday.setDate(monthStart.getDate() + 1)
    } else {
      firstMonday.setDate(monthStart.getDate() + (8 - monthStartDay))
    }

    if (day < firstMonday) {
      const prevMonth = addMonths(monthStart, -1)
      return format(prevMonth, 'yyyy-MM')
    }

    return format(day, 'yyyy-MM')
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

          <button onClick={() => setRange('month')}>이번달</button>
          <button onClick={() => setRange('3months')}>최근3개월</button>
          <button onClick={() => setRange('6months')}>최근6개월</button>
          <button onClick={addOneMonth}>+1개월</button>
          <input
            type="date"
            value={rangeStart}
            onChange={e => {
              setRangeStart(e.target.value)
              localStorage.setItem('projectPlannerRangeStart', e.target.value)
            }}
          />

          <input
            type="date"
            value={rangeEnd}
            onChange={e => {
              setRangeEnd(e.target.value)
              localStorage.setItem('projectPlannerRangeEnd', e.target.value)
            }}
          />
          <button onClick={toggleScheduleLock}>
            {scheduleLocked ? '🔒 일정잠금' : '🔓 편집중'}
          </button>
          <button onClick={saveAllToDB}>저장</button>

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

            {projects.map(project => (
              <div className="project-group" key={project.id}>
                <div className="project-cell project-bottom-line">
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
                  {project.tasks.map((task, taskIndex) => {
                    const isLastTaskInProject = taskIndex === project.tasks.length - 1
                    return (
                      <div
                        className={[
                          'task-row-fields',
                          isLastTaskInProject ? 'project-bottom-line' : '',
                        ].join(' ')}
                        key={task.id}

                      >
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
                          <div
                            className={
                              task.artifactUrl
                                ? 'doc-cell linked'
                                : 'doc-cell'
                            }
                          >
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
              project.tasks.map((task, taskIndex) => {
                const isLastTaskInProject = taskIndex === project.tasks.length - 1
                return (
                  <div
                    className={[
                      'timeline-row',
                      isLastTaskInProject ? 'project-bottom-line' : '',
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
                        ].join(' ')}
                        onMouseDown={() => {
                          if (scheduleLocked) return
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
                      />
                    )
                  })}
                </div>
              )
            })
            )}
          </div>
        </div>
      </div>

      {urlEditor && (
        <div className="modal-backdrop">
          <div className="url-modal">
            <h3>문서 URL 입력</h3>
            <div className="url-input-row">
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

              <button
                className="open-url-btn"
                onClick={() => {
                  if (!urlEditor?.url) return
                  window.open(urlEditor.url, '_blank')
                }}
              >
                ↗
              </button>
            </div>

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