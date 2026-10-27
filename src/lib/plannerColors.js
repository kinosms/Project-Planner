// Legacy overlaps preserve the explicit blue selection. Never infer color from due dates.
export function normalizeProjects(projects) {
  return projects.map(project => ({ ...project, tasks: project.tasks.map(task => ({
    ...task,
    dates: [...new Set(task.dates || [])],
    redDates: [...new Set(task.redDates || [])].filter(date => !task.dates?.includes(date)),
  })) }))
}

export function paintTaskDate(task, date, color) {
  return {
    ...task,
    dates: [...(task.dates || []).filter(d => d !== date), ...(color === 'blue' ? [date] : [])].sort(),
    redDates: [...(task.redDates || []).filter(d => d !== date), ...(color === 'red' ? [date] : [])].sort(),
  }
}
