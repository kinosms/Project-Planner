import { useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  startOfMonth,
} from 'date-fns'
import './App.css'

const initialProjects = [
  {
    id: 1,
    name: '운영 페이지',
    tasks: [
      {
        id: 101,
        work: '기획',
        title: '화면 기획서 1차',
        owner: 'geronimo.sung',
        status: '진행',
        artifactName: '화면설계서',
        artifactUrl: 'https://example.com',
        dates: ['2026-04-06', '2026-04-07', '2026-04-08', '2026-04-09'],
      },
    ],
  },
  {
    id: 2,
    name: '디지털카드',
    tasks: [
      {
        id: 201,
        work: '개발',
        title: '백엔드 개발',
        owner: 'alex.jang',
        status: '진행',
        artifactName: '디자인시안',
        artifactUrl: '',
        dates: ['2026-04-10', '2026-04-11', '2026-04-12'],
      },
    ],
  },
]

export default function App() {
  const [projects, setProjects] = useState(() => {
    const savedProjects = localStorage.getItem('projectPlannerProjects')
    if (savedProjects) return JSON.parse(savedProjects)

    const oldTasks = localStorage.getItem('projectPlannerTasks')
    if (oldTasks) {
      const parsedTasks = JSON.parse(oldTasks)
      const grouped = parsedTasks.reduce((acc, task) => {
        const projectName = task.project || '프로젝트'
        const found = acc.find(p => p.name === projectName)

        const convertedTask = {
          id: task.id || Date.now(),
          work: task.work || '',
          title: task.title || '',
          owner: task.owner || '',
          status: task.status || '대기',
          artifactName: task.artifactName || '',
          artifactUrl: task.artifactUrl || '',
          dates: task.dates || [],
        }

        if (found) {
          found.tasks.push(convertedTask)
        } else {
          acc.push({
            id: Date.now() + acc.length,
            name: projectName,
            tasks: [convertedTask],
          })
        }

        return acc
      }, [])

      return grouped
    }

    return initialProjects
  })

  const [compactMode, setCompactMode] = useState(false)
  const [rangeStart, setRangeStart] = useState('2026-04-01')
  const [rangeEnd, setRangeEnd] = useState('2026-07-31')
  const [isPainting, setIsPainting] = useState(false)
  const [paintMode, setPaintMode] = useState(null)
  const [urlEditor, setUrlEditor] = useState(null)

  const days = useMemo(() => {
    return eachDayOfInterval({
      start: new Date(rangeStart),
      end: new Date(rangeEnd),
    })
  }, [rangeStart, rangeEnd])

  const flatTasks = projects.flatMap(project =>
    project.tasks.map(task => ({
      ...task,
      projectId: project.id,
      projectName: project.name,
    }))
  )

  const saveProjects = next => {
    setProjects(next)
    localStorage.setItem('projectPlannerProjects', JSON.stringify(next))
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

  const todayString = format(new Date(), 'yyyy-MM-dd')

  const total = flatTasks.length
  const done = flatTasks.filter(task => task.status === '완료').length
  const doing = flatTasks.filter(task => task.status === '진행').length
  const waiting = flatTasks.filter(task => task.status === '대기').length

  return (
    <div className="app" onMouseUp={endPaint}>
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
                    value={project.name}
                    onChange={e => updateProjectName(project.id, e.target.value)}
                    placeholder="프로젝트"
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
                        value={task.work}
                        onChange={e =>
                          updateTask(project.id, task.id, 'work', e.target.value)
                        }
                        placeholder="업무"
                      />

                      <input
                        value={task.title}
                        onChange={e =>
                          updateTask(project.id, task.id, 'title', e.target.value)
                        }
                        placeholder="상세내용"
                      />

                      {!compactMode && (
                        <>
                          <div className="doc-cell">
                            <input
                              value={task.artifactName}
                              onChange={e =>
                                updateTask(
                                  project.id,
                                  task.id,
                                  'artifactName',
                                  e.target.value
                                )
                              }
                              placeholder="문서명"
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
                            value={task.owner}
                            onChange={e =>
                              updateTask(
                                project.id,
                                task.id,
                                'owner',
                                e.target.value
                              )
                            }
                            placeholder="담당자"
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

              <div className="date-row">
                {days.map(day => {
                  const dateString = format(day, 'yyyy-MM-dd')
                  const isToday = dateString === todayString

                  return (
                    <div
                      className={isToday ? 'day-cell today' : 'day-cell'}
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
                        ].join(' ')}
                        onMouseDown={() =>
                          toggleDate(project.id, task.id, task, date)
                        }
                        onMouseEnter={() =>
                          paintOverDate(project.id, task.id, date)
                        }
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