# 사용자 목적(User Flow) 분석 (UserFlowAnalysis)

> 분석 대상: `src/App.jsx`  
> 분석 기준: 실제 코드 호출 관계 기반  
> 분석 일자: 2026-07-02

---

## User Flow 1. 앱 처음 열기

**설명**: 앱을 처음 실행하면 Supabase에서 데이터를 로드하고 대시보드를 표시한다.

**실행 순서**

| 단계 | 행동 | 함수 |
|------|------|------|
| 1 | 앱 마운트 | `useEffect([], loadFromDB)` |
| 2 | DB 설정 로드 | `loadFromDB` → SELECT planner_settings |
| 3 | 프로젝트 로드 | SELECT projects |
| 4 | 업무 로드 | SELECT tasks |
| 5 | 일정 로드 | SELECT task_dates |
| 6 | 히스토리 로드 | `loadHistories` → SELECT planner_histories |
| 7 | 대시보드 표시 | `Dashboard` 렌더링 |
| 8 | 일일 브리핑 팝업 | `useEffect([page])` → `setShowDailyBrief(true)` |

**함수 호출 순서**
```
loadFromDB()
  ↓
setRangeStart / setRangeEnd
  ↓
setProjects / setLoadedProjects
  ↓
loadHistories()
  ↓
setHistories()
  ↓
Dashboard 렌더링
  ↓
setShowDailyBrief(true)  ← useEffect[page]
  ↓
DailyBrief 렌더링
```

**관련 기능**: 앱 초기화, 일일 브리핑

**테스트 포인트**
- [ ] Supabase 연결 성공 시 데이터가 플래너에 표시되는가
- [ ] localStorage에 기존 데이터가 있을 때 DB 데이터로 덮어쓰는가
- [ ] 오늘 이미 브리핑을 닫은 경우 팝업이 다시 뜨지 않는가

**실패 가능성**
- Supabase 네트워크 에러 → 데이터 미로드 (에러 로그만 출력, 사용자 알림 없음)
- `task_dates` 로드 전에 렌더링 시 날짜 표시 안 됨 (현재 순차 로드라 실제 발생하지 않음)

**예외 처리**
- projectError, taskError, dateError 발생 시 `console.log` 후 return (사용자에게 피드백 없음 — 개선 필요)

---

## User Flow 2. 새 프로젝트와 업무 만들기

**설명**: 플래너에서 새 프로젝트를 만들고 업무를 여러 개 추가하며 정보를 입력한다.

**실행 순서**

| 단계 | 행동 | 함수 |
|------|------|------|
| 1 | 잠금 해제 | `toggleScheduleLock` (비밀번호 입력) |
| 2 | + 프로젝트 클릭 | `addProject` → `saveProjects` |
| 3 | 프로젝트명 입력 | `updateProjectName` → `saveProjects` |
| 4 | 업무 정보 입력 | `updateTask(work/title/owner/artifactName)` → `saveProjects` |
| 5 | 문서 URL 설정 | `setUrlEditor` → (모달) → `updateTaskFields` → `saveProjects` |
| 6 | + 업무 추가 또는 Tab | `addTaskToProject` → `saveProjects` |
| 7 | 업무 반복 추가 | 4~6 반복 |

**함수 호출 순서**
```
toggleScheduleLock()
  ↓
addProject()
  ↓
saveProjects() → localStorage
  ↓
updateProjectName(id, value)
  ↓
saveProjects()
  ↓
updateTask(projectId, taskId, key, value) [반복]
  ↓
saveProjects()
  ↓
addTaskToProject(projectId)
  ↓
saveProjects()
```

**관련 기능**: 프로젝트 생성, 업무 추가, 업무 정보 편집, 문서 URL 관리

**테스트 포인트**
- [ ] 잠금 상태에서 입력 필드가 비활성화되는가
- [ ] Tab 키로 다음 셀로 이동하는가
- [ ] 마지막 셀에서 Tab 시 새 업무 행이 추가되는가
- [ ] 문서 URL 여러 개 추가 시 아이콘이 이중 링크로 변경되는가

**실패 가능성**
- 잠금 비밀번호 하드코딩 → 노출 시 누구나 편집 가능

**예외 처리**
- 없음 (입력 실패 시 별도 처리 없음)

---

## User Flow 3. 업무 일정 입력

**설명**: 플래너 타임라인에서 셀을 드래그하여 업무 기간을 설정한다.

**실행 순서**

| 단계 | 행동 | 함수 |
|------|------|------|
| 1 | 날짜 셀 클릭 (MouseDown) | `toggleDate` → `setIsPainting(true)` → `paintDate` |
| 2 | 드래그 (MouseEnter 반복) | `paintOverDate` → `paintDate` |
| 3 | 마우스 놓기 (MouseUp) | `handleAppMouseUp` → `endPaint` |
| 4 | 특정 날짜 더블클릭 | `toggleRedDate` (적색 날짜 표시) |
| 5 | Shift+클릭 | `updateDateMemo` → 메모 모달 |

**함수 호출 순서**
```
onMouseDown → toggleDate()
  ↓
setIsPainting(true) / setPaintMode('add'|'remove')
  ↓
paintDate(id, taskId, date, mode)
  ↓
saveProjects()
  ↓
[드래그 중] onMouseEnter → paintOverDate()
  ↓
paintDate() → saveProjects()
  ↓
onMouseUp → handleAppMouseUp()
  ↓
endPaint() → setIsPainting(false)
```

**관련 기능**: 일정 페인팅, 적색 날짜 토글, 셀 메모 입력

**테스트 포인트**
- [ ] 클릭 시 날짜가 추가/제거 토글되는가
- [ ] 드래그 시 연속 날짜가 한번에 칠해지는가
- [ ] 이미 선택된 셀에서 시작 시 remove 모드로 동작하는가
- [ ] 더블클릭 시 red-selected 클래스가 토글되는가
- [ ] Shift+클릭 시 메모 모달이 열리는가

**실패 가능성**
- 빠른 드래그 시 일부 셀 MouseEnter 이벤트 누락 → 불연속 일정 (브라우저 이슈)

**예외 처리**
- 잠금 상태에서는 모든 이벤트가 early return

---

## User Flow 4. 업무 상태 변경

**설명**: 업무의 상태(대기/진행/완료)를 수동으로 변경한다.

**실행 순서**

| 단계 | 행동 | 함수 |
|------|------|------|
| 1 | 상태 뱃지 클릭 | `cycleStatus` |
| 2 | 순서 순환 | 대기 → 진행 → 완료 → 대기 |
| 3 | 저장 | `saveProjects` |

**함수 호출 순서**
```
status-pill onClick → cycleStatus(projectId, taskId)
  ↓
projects.map(...status 순환...)
  ↓
saveProjects()
```

**관련 기능**: 업무 상태 변경

**테스트 포인트**
- [ ] 클릭마다 대기→진행→완료→대기 순으로 순환하는가
- [ ] 완료 상태에서 getDisplayStatus가 완료를 반환하는가
- [ ] 잠금 상태에서 클릭이 무시되는가

**실패 가능성**: 없음 (단순 순환 로직)

---

## User Flow 5. 프로젝트/업무 순서 변경

**설명**: Shift+드래그로 프로젝트 또는 업무의 표시 순서를 변경한다.

**실행 순서**

| 단계 | 행동 | 함수 |
|------|------|------|
| 1 | 잠금 해제 확인 | `scheduleLocked === false` |
| 2 | Shift+MouseDown | `setDragging({type, id/taskId})` |
| 3 | MouseEnter (대상) | `setDragOver({id/taskId})` |
| 4 | MouseUp | `reorderProject` 또는 `reorderTask` |
| 5 | 저장 | `saveProjects` |

**함수 호출 순서**
```
Shift+onMouseDown → setDragging({type:'project'|'task', ...})
  ↓
onMouseEnter → setDragOver({id/taskId})
  ↓
onMouseUp → reorderProject(fromId, toId)
          또는 reorderTask(projectId, fromTaskId, toTaskId)
  ↓
saveProjects()
  ↓
setDragging(null) / setDragOver(null)
```

**관련 기능**: 순서 변경

**테스트 포인트**
- [ ] Shift 없이 드래그 시 이동이 발생하지 않는가
- [ ] 잠금 상태에서 드래그가 무시되는가
- [ ] 프로젝트 이동 시 해당 프로젝트의 모든 업무가 함께 이동하는가
- [ ] 타임라인 행도 동일 순서로 반영되는가

**실패 가능성**
- 업무 드래그는 같은 프로젝트 내에서만 허용. 다른 프로젝트 간 이동 불가 (현재 미지원)

---

## User Flow 6. DB 저장

**설명**: 로컬에서 편집한 내용을 Supabase DB에 저장한다. 변경 이력도 함께 기록된다.

**실행 순서**

| 단계 | 행동 | 함수 |
|------|------|------|
| 1 | 저장 버튼 클릭 | `saveAllToDB` |
| 2 | 확인 팝업 | `confirm` |
| 3 | 변경 이력 저장 | `saveChangeHistories` → INSERT planner_histories |
| 4 | 기존 데이터 삭제 | DELETE projects |
| 5 | 프로젝트/업무/일정 재삽입 | INSERT projects → tasks → task_dates |
| 6 | 설정 저장 | UPSERT planner_settings |
| 7 | 로컬 스냅샷 저장 | `saveLocalSnapshot` |
| 8 | 토스트 | `showToast('DB 저장 완료')` |

**함수 호출 순서**
```
저장 버튼 onClick → saveAllToDB()
  ↓
confirm() → 취소 시 종료
  ↓
setIsSaving(true)
  ↓
saveChangeHistories() → INSERT planner_histories
  ↓
DELETE projects (neq id 0)
  ↓
for project of projects:
  INSERT projects → insertedProject
  for task of tasks:
    INSERT tasks → insertedTask
    INSERT task_dates rows
  ↓
UPSERT planner_settings
  ↓
setLoadedProjects(deepCopy)
  ↓
loadHistories()
  ↓
saveLocalSnapshot() → buildSnapshot() → localStorage
  ↓
showToast('DB 저장 완료')
  ↓
setIsSaving(false)
```

**관련 기능**: DB 저장, 로컬 히스토리

**테스트 포인트**
- [ ] 저장 중 다시 저장 버튼 클릭이 무시되는가 (`isSaving` 가드)
- [ ] 저장 성공 후 히스토리 목록이 갱신되는가
- [ ] 에러 발생 시 toast에 '저장 실패'가 표시되는가
- [ ] beforeunload 이벤트가 저장 중 페이지 이탈을 막는가

**실패 가능성**
- DELETE 후 INSERT 도중 에러 → 데이터 일부 소실 (rollback 없음)
- 동시에 두 사용자가 저장 시 나중 저장이 이전 저장을 덮어씀

**예외 처리**
- `catch(error)` → `showToast('DB 저장 실패')` + `console.log`
- `finally` → `setIsSaving(false)`

---

## User Flow 7. 이전 상태로 되돌리기 (Undo)

**설명**: ← 버튼으로 이전 저장 시점 상태로 복원한다.

**실행 순서**

| 단계 | 행동 | 함수 |
|------|------|------|
| 1 | ← 버튼 클릭 | `moveLocalHistory(-1)` |
| 2 | 인덱스 이동 | `historyIndex - 1` |
| 3 | 스냅샷 복원 | `applySnapshot(localHistory[nextIndex])` |
| 4 | 토스트 표시 | `showToast('이전 상태로 이동했습니다')` |

**함수 호출 순서**
```
← onClick → moveLocalHistory(-1)
  ↓
nextIndex = historyIndex - 1
  ↓
setHistoryIndex(nextIndex)
  ↓
applySnapshot(localHistory[nextIndex])
  ↓
setProjects / setRangeStart / setRangeEnd / setCustomHolidayDates
  ↓
localStorage 동기화
  ↓
showToast('이전 상태로 이동했습니다')
```

**관련 기능**: 로컬 히스토리

**테스트 포인트**
- [ ] 히스토리가 0개일 때 ← 버튼이 disabled인가
- [ ] 복원 후 플래너가 스냅샷 날짜로 다시 렌더링되는가
- [ ] → 버튼으로 복원 취소(redo)가 가능한가

**실패 가능성**
- localStorage 용량 초과 시 저장 실패 (현재 에러 처리 없음)

---

## User Flow 8. 히스토리 조회 및 업무 이동

**설명**: 히스토리 탭에서 변경 이력을 확인하고 해당 업무로 플래너에서 이동한다.

**실행 순서**

| 단계 | 행동 | 함수 |
|------|------|------|
| 1 | 히스토리 탭 클릭 | `setPage('history')` |
| 2 | 히스토리 목록 표시 | `History` 렌더링 (`buildHistorySentence`, `getHistoryType`) |
| 3 | 항목 클릭 | `focusHistory(history)` |
| 4 | 프로젝트/업무 찾기 | visibleProjects 탐색 |
| 5 | 플래너로 이동 | `focusTask` → `setPage('planner')` |
| 6 | 스크롤 + 하이라이트 | `plannerEl.scrollTo` → `setHighlightTaskId` |

**함수 호출 순서**
```
히스토리 탭 onClick → setPage('history')
  ↓
History 컴포넌트 렌더링
  ↓
history-item onClick → focusHistory(history)
  ↓
visibleProjects.find(project by name)
  ↓
project.tasks.find(task by work+title)
  ↓
focusTask({...task, projectId, projectName})
  ↓
setPage('planner')
  ↓
setTimeout → taskRefs.current[task.id].getBoundingClientRect()
  ↓
plannerEl.scrollTo({top, left})
  ↓
setHighlightTaskId(task.id)
  ↓
setTimeout → setHighlightTaskId(null)  [5초 후]
```

**관련 기능**: 히스토리 조회

**테스트 포인트**
- [ ] 삭제된 업무 이력 클릭 시 이동이 발생하지 않는가 (isFocusable 가드)
- [ ] 하이라이트가 5초 후 사라지는가
- [ ] 해당 날짜로 수평 스크롤이 이동하는가

**실패 가능성**
- 업무가 이름 변경된 경우 `focusHistory`의 name 매칭 실패 → 이동 안 됨
- `taskRefs.current[task.id]`가 존재하지 않을 경우 스크롤 실패

---

## User Flow 9. 대시보드에서 업무 확인 및 플래너 이동

**설명**: 대시보드의 종료 예정 업무를 클릭하여 플래너의 해당 업무로 이동한다.

**실행 순서**

| 단계 | 행동 | 함수 |
|------|------|------|
| 1 | 대시보드 탭 클릭 | `setPage('dashboard')` |
| 2 | 종료예정 업무 확인 | `urgentTasks` 렌더링 |
| 3 | 업무 클릭 | `focusTask(task)` |
| 4 | 플래너로 이동 | `setPage('planner')` + 스크롤 |

**함수 호출 순서**
```
대시보드 탭 onClick → setPage('dashboard')
  ↓
Dashboard 컴포넌트 렌더링
  ↓
urgentTasks 목록 표시
  ↓
urgent-row onClick → focusTask(task)
  ↓
setPage('planner')
  ↓
setTimeout → plannerEl.scrollTo + setHighlightTaskId
```

**관련 기능**: 히스토리 조회 및 이동, 일일 브리핑

**테스트 포인트**
- [ ] 대시보드 탭 전환 후 데이터가 현재 범위 기준으로 표시되는가
- [ ] 담당자 버튼 클릭 시 해당 담당자 업무만 필터링되는가
- [ ] 프로젝트 버튼 클릭 시 해당 프로젝트 업무가 표시되는가

---

## User Flow 10. 문서 링크 열기

**설명**: 업무에 연결된 문서 URL을 새 탭으로 연다.

**실행 순서**

| 단계 | 행동 | 함수 |
|------|------|------|
| 1 | 링크 버튼 클릭 | `setUrlEditor({urls})` |
| 2 | URL 모달 표시 | urlEditor state |
| 3 | ↗ 버튼 클릭 | `window.open(url, '_blank')` |
| 4 | URL 저장 | `updateTaskFields` → `saveProjects` |

**관련 기능**: 문서 URL 관리

**테스트 포인트**
- [ ] URL이 비어 있을 때 ↗ 버튼이 동작하지 않는가
- [ ] 여러 URL 추가 후 저장 시 모두 persistance 되는가
- [ ] 대시보드 프로젝트 상세에서도 링크가 클릭 가능한가

---

## 종합 평가

### 유지보수성 — 40/100

App.jsx 단일 파일에 2677줄이 모여 있어 코드 추적, 변경 영향 범위 파악이 극히 어렵다.  
컴포넌트 분리(`PlannerPage`, `DashboardPage`, `HistoryPage`)와 커스텀 훅(`useProjects`, `usePainting`, `useHistory`) 도입이 시급하다.

### 코드 품질 — 62/100

- 함수 단위 로직은 비교적 명확하고 간결하다.
- `saveAllToDB`의 delete-then-insert는 트랜잭션 없이 운영되어 동시 접속 시 데이터 소실 위험이 있다.
- `toggleScheduleLock`의 비밀번호 하드코딩은 즉시 수정이 필요한 보안 이슈다.
- 여러 곳의 `console.log` 디버그 로그가 프로덕션 코드에 남아 있다.

### 테스트 용이성 — 25/100

- 거의 모든 로직이 컴포넌트 내부에 결합되어 있어 유닛 테스트가 불가능에 가깝다.
- `getTaskProgress`, `getDisplayStatus`, `buildHistorySentence`, `getHistoryType`은 순수 함수로 즉시 추출 가능하며 테스트 대상으로 적합하다.
- 테스트 코드가 전무하다.

### 권장 리팩토링 로드맵

| 단계 | 작업 | 효과 |
|------|------|------|
| 1 | `toggleScheduleLock` 비밀번호 하드코딩 제거 | 보안 위험 제거 |
| 2 | `saveAllToDB` upsert 패턴 전환 | 데이터 안전성 확보 |
| 3 | `getTaskProgress` 등 순수 함수 분리 + 테스트 추가 | 테스트 용이성 확보 |
| 4 | `useProjects` / `usePainting` / `useHistory` 커스텀 훅 분리 | 관심사 분리 |
| 5 | `PlannerPage` / `DashboardPage` / `HistoryPage` 컴포넌트 분리 | 파일 크기 감소 |
| 6 | `scrollToToday` + `scrollToCurrentMonth` 통합 | 중복 제거 |
| 7 | `IconLinkSingle` + `IconLinkDouble` 통합 | 중복 제거 |
| 8 | 에러 발생 시 사용자 피드백 추가 (toast 활용) | UX 개선 |
