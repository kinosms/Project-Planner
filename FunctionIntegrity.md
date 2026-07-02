# 함수 무결성 분석 (FunctionIntegrity)

> 분석 대상: `src/App.jsx` (2677줄), `src/supabase.js`  
> 분석 기준: 실제 코드 호출 관계, React 훅, 이벤트 핸들러 포함  
> 분석 일자: 2026-07-02

---

## 1. 함수 목록 및 분석표

| 함수명 | 파일 | 호출횟수 | 호출하는 함수(calledBy) | 역할 | 중복위험 | Dead | Unused | SRP | 리팩토링 | 무결성점수 | 개선의견 |
|--------|------|----------|------------------------|------|----------|------|--------|-----|---------|-----------|---------|
| `IconLinkSingle` | App.jsx | 0 (JSX) | App(JSX) | SVG 링크 단일 아이콘 렌더링 | 낮음 | — | — | 적정 | — | 95 | IconLinkDouble과 path 코드 중복. 공통 컴포넌트 통합 가능 |
| `IconLinkDouble` | App.jsx | 0 (JSX) | App(JSX) | SVG 링크 이중 아이콘 렌더링 | **높음** | — | — | 적정 | ✓ | 80 | IconLinkSingle과 SVG path 중복. props count로 단일 컴포넌트 통합 권장 |
| `App` | App.jsx | — | main.jsx | 전체 앱 루트 — 상태 관리, 페이지 라우팅, DB 저장/로드, 이벤트 핸들링 총괄 | 낮음 | — | — | **과부하** | ✓ | 42 | 2600+ 줄 단일 컴포넌트. useProjects/usePainting/useHistory 훅 분리, 페이지별 파일 추출 필수 |
| `isProjectCompleted` | App.jsx | 1 | visibleProjects(useMemo) | 프로젝트 내 모든 task가 완료인지 판별 | 낮음 | — | — | 적정 | — | 90 | 간결하고 역할 명확 |
| `scrollToToday` | App.jsx | 1 | 플래너 탭 onClick | 플래너 스크롤을 오늘 날짜로 이동 | **중간** | — | — | 적정 | ✓ | 75 | scrollToCurrentMonth와 거의 동일 패턴(.planner vs .timeline-panel 차이만). 유틸 통합 권장 |
| `focusTask` | App.jsx | 2 | focusHistory, Dashboard/urgentTasks onClick | 특정 task로 플래너 스크롤 + 하이라이트 | 낮음 | — | — | 적정 | — | 82 | 중첩 setTimeout 사용. useLayoutEffect 개선 가능 |
| `focusHistory` | App.jsx | 1 | History 컴포넌트 onClick | 히스토리 항목으로 project/task 찾아 focusTask 호출 | 낮음 | — | — | 적정 | — | 85 | 역할 명확 |
| `saveProjects` | App.jsx | 14 | 대부분의 프로젝트/업무 변경 함수 | state + localStorage 동시 저장 래퍼 | 낮음 | — | — | 적정 | — | 92 | 핵심 래퍼. 현재 설계 적절 |
| `saveChangeHistories` | App.jsx | 1 | saveAllToDB | loadedProjects vs projects 비교 후 변경 이력 Supabase 저장 | 낮음 | — | — | 약간과부하 | ✓ | 65 | 삭제/이름변경/필드변경/일정변경 로직 혼재. 케이스별 헬퍼 분리 권장 |
| `showToast` | App.jsx | 3 | moveLocalHistory, saveAllToDB | 토스트 메시지 2.2초 표시 | 낮음 | — | — | 적정 | — | 95 | 간결. clearTimeout 없는 점 주의 |
| `buildSnapshot` | App.jsx | 1 | saveLocalSnapshot | 현재 state를 스냅샷 객체로 직렬화 | 낮음 | — | — | 적정 | — | 90 | 역할 명확 |
| `saveLocalSnapshot` | App.jsx | 1 | saveAllToDB | localStorage 로컬 히스토리(최대 3개) 저장 | 낮음 | — | — | 적정 | — | 88 | slice(-3)으로 최대 3개 유지 |
| `applySnapshot` | App.jsx | 1 | moveLocalHistory | 스냅샷을 state + localStorage에 복원 | 낮음 | — | — | 적정 | — | 90 | 역할 명확 |
| `moveLocalHistory` | App.jsx | 2 | ← / → 버튼 onClick | 로컬 히스토리 인덱스 이동 후 스냅샷 복원 | 낮음 | — | — | 적정 | — | 88 | 명확 |
| `saveAllToDB` | App.jsx | 1 | 저장 버튼 onClick | DB 전체 재저장 (delete-then-insert 패턴) | 낮음 | — | — | **과부하** | ✓ | 55 | delete-then-insert는 동시 접속 시 데이터 소실 위험. upsert/diff 전환, 150+줄 분리 필요 |
| `loadHistories` | App.jsx | 2 | saveAllToDB, loadFromDB | Supabase planner_histories 100건 로드 | 낮음 | — | — | 적정 | — | 88 | 명확 |
| `loadFromDB` | App.jsx | 1 | useEffect(mount) | settings/projects/tasks/dates 전체 로드 | 낮음 | — | — | 약간과부하 | ✓ | 68 | 4테이블 순차 로드. 로드 후 rangeStart/End 재초기화 이중 로직. 설정/데이터 로드 분리 권장 |
| `moveNextCell` | App.jsx | 5 | 다수 input onKeyDown | Enter/Tab 시 다음 셀 포커스, 마지막이면 업무 추가 | 낮음 | — | — | 적정 | — | 80 | 이동+추가 혼재. 주석 부재 |
| `addProject` | App.jsx | 1 | + 프로젝트 버튼 | 빈 프로젝트 + 빈 task 1개 추가 | 낮음 | — | — | 적정 | — | 90 | 명확 |
| `toggleRedDate` | App.jsx | 1 | grid-cell onDoubleClick | 셀 redDates 토글 | **중간** | — | — | 적정 | — | 85 | paintDate와 유사 구조. 통합 가능성 있음 |
| `isRedDateSelected` | App.jsx | 1 | timeline 셀 렌더링 | task.redDates 포함 여부 반환 | 낮음 | — | — | 적정 | — | 95 | 1줄 헬퍼 |
| `addTaskToProject` | App.jsx | 2 | + 버튼, moveNextCell | 프로젝트에 빈 업무 추가 | 낮음 | — | — | 적정 | — | 90 | 명확 |
| `updateDateMemo` | App.jsx | 1 | grid-cell onMouseDown(Shift) | 셀 메모 편집 모달 열기 | 낮음 | — | — | 적정 | — | 88 | 명확 |
| `updateProjectName` | App.jsx | 1 | 프로젝트명 input onChange | 프로젝트명 업데이트 | 낮음 | — | — | 적정 | — | 90 | updateTask로 통합 가능하나 명시성 측면에서 분리도 합당 |
| `updateTask` | App.jsx | 5 | work/title/owner/artifactName onChange | 단일 key-value로 task 업데이트 | 낮음 | — | — | 적정 | — | 92 | 범용 핸들러 |
| `updateTaskFields` | App.jsx | 1 | URL 모달 저장 버튼 | 여러 필드를 한번에 task 업데이트 | 낮음 | — | — | 적정 | — | 92 | 다중 필드용 분리 의도 명확 |
| `deleteTask` | App.jsx | 1 | 삭제 버튼 onClick | 업무 삭제 (마지막 업무 삭제 시 프로젝트도 삭제) | 낮음 | — | — | 약간혼재 | ✓ | 78 | 업무 삭제가 프로젝트 삭제를 암묵적으로 유발. 의도 주석 필요 |
| `cycleStatus` | App.jsx | 1 | status-pill onClick | 대기→진행→완료 순환 | 낮음 | — | — | 적정 | — | 92 | 명확 |
| `updateRange` | App.jsx | 4 | setRange, addOneMonth, 전체기간 onClick | rangeStart/End state + localStorage 동시 업데이트 | 낮음 | — | — | 적정 | — | 92 | saveProjects 패턴과 동일한 래퍼 역할 |
| `setRange` | App.jsx | 4 | 이번달/최근3개월/최근6개월 버튼 | 날짜 범위 프리셋 적용 | 낮음 | — | — | 약간과부하 | ✓ | 78 | 3모드 분기 + scrollToCurrentMonth 혼재. 날짜 계산 헬퍼 분리 권장 |
| `scrollToCurrentMonth` | App.jsx | 1 | setRange | .timeline-panel을 현재 달로 스크롤 | **중간** | — | — | 적정 | ✓ | 75 | scrollToToday와 거의 동일 로직. 공통 유틸 통합 권장 |
| `addOneMonth` | App.jsx | 1 | +1개월 버튼 onClick | rangeEnd를 1달 연장 | 낮음 | — | — | 적정 | — | 90 | 명확 |
| `toggleScheduleLock` | App.jsx | 1 | 잠금 버튼 onClick | 편집 잠금/해제 (비밀번호 확인) | 낮음 | — | — | 적정 | ✓ | 60 | **비밀번호 하드코딩** — 심각한 보안 취약. 서버 검증 또는 Supabase Auth 전환 필요 |
| `isDateSelected` | App.jsx | 1 | timeline 셀 렌더링 | task.dates 포함 여부 반환 | 낮음 | — | — | 적정 | — | 95 | 1줄 헬퍼 |
| `paintDate` | App.jsx | 2 | toggleDate, paintOverDate | add/remove 모드에 따라 task.dates 갱신 | 낮음 | — | — | 적정 | — | 88 | 명확 |
| `toggleDate` | App.jsx | 1 | grid-cell onMouseDown | 날짜 토글 시작 (페인트 모드 설정 + paintDate) | 낮음 | — | — | 적정 | — | 88 | 명확 |
| `paintOverDate` | App.jsx | 1 | grid-cell onMouseEnter | 드래그 중 날짜에 페인트 적용 | 낮음 | — | — | 적정 | — | 92 | 명확 |
| `endPaint` | App.jsx | 1 | handleAppMouseUp | 페인트 상태 초기화 | 낮음 | — | — | 적정 | — | 95 | 명확 |
| `getWeekNumberInMonth` | App.jsx | 1 | weekGroups(useMemo) | 날짜의 월내 주차 계산 | 낮음 | — | — | 적정 | — | 82 | 복잡한 로직. 주석 부족 |
| `getDisplayStatus` | App.jsx | 4 | 대시보드 렌더링, 상태 카운트 | 현재 날짜 기준 task 표시 상태 계산 | 낮음 | — | — | 적정 | — | 85 | 종료 후 "진행" 유지 의도에 주석 필요 |
| `getTaskProgress` | App.jsx | 3 | 대시보드 진도율, projectProgressSummary | task 진도율 0-100 계산 | 낮음 | — | — | 적정 | — | 88 | redDates를 진도율 계산에서 제외하는 의도 불명확 |
| `isLastFridayOfMonth` | App.jsx | 2 | date-row, grid-cell 렌더링 | 월 마지막 금요일 여부 판별 | 낮음 | — | — | 적정 | — | 88 | 명확 |
| `toggleCustomHolidayDate` | App.jsx | 1 | day-cell onDoubleClick | 커스텀 휴일 토글 + localStorage 저장 | 낮음 | — | — | 적정 | — | 90 | 명확 |
| `reorderProject` | App.jsx | 1 | 프로젝트 onMouseUp(drag) | Shift+드래그로 프로젝트 순서 변경 | 낮음 | — | — | 적정 | — | 90 | 명확 |
| `reorderTask` | App.jsx | 1 | 업무 onMouseUp(drag) | Shift+드래그로 업무 순서 변경 | 낮음 | — | — | 적정 | — | 90 | 명확 |
| `handleAppMouseUp` | App.jsx | 1 | div.app onMouseUp | 마우스업 시 페인트/드래그 상태 초기화 | 낮음 | — | — | 적정 | — | 92 | 명확 |
| `DailyBrief` | App.jsx | 0 (JSX) | App(showDailyBrief) | 일일 브리핑 팝업 | 낮음 | — | — | 적정 | — | 85 | 텍스트 빌드 로직 분리하면 테스트 용이 |
| `buildSpeechText` | App.jsx | 1 | handleSpeak | 음성 읽기용 텍스트 구성 | **중간** | — | — | 적정 | — | 82 | 브리핑 UI와 음성 텍스트 이중 관리. 단일 데이터 소스로 통합 권장 |
| `handleSpeak` | App.jsx | 1 | 음성 버튼 onClick | Web Speech API 음성 재생/중지 | 낮음 | — | — | 적정 | — | 88 | 명확 |
| `closeDailyBrief` | App.jsx | 1 | DailyBrief onClose | showDailyBrief false 설정 | **높음** | — | — | 적정 | ✓ | 70 | 1줄 함수. dismissDailyBrief와 합치거나 인라인 처리 가능 |
| `dismissDailyBrief` | App.jsx | 1 | DailyBrief onDismiss | 오늘 하루 브리핑 숨김(localStorage) | 낮음 | — | — | 적정 | — | 90 | 명확 |
| `DonutChart` | App.jsx | 1 | Dashboard(JSX) | 도넛 차트 SVG 렌더링 | 낮음 | — | — | 적정 | — | 88 | 외부 라이브러리 없이 구현. 명확 |
| `Dashboard` | App.jsx | 1 | App(JSX) page===dashboard | 대시보드 전체 렌더링 | 낮음 | — | — | 약간과부하 | ✓ | 68 | 300+ 줄 단일 컴포넌트. 섹션별 서브 컴포넌트 분리 권장 |
| `getHistoryType` | App.jsx | 2 | History 렌더링 | action → 타입 문자열 변환 | 낮음 | — | — | 적정 | — | 90 | 명확 |
| `buildHistorySentence` | App.jsx | 1 | History 렌더링 | action → 자연어 문장 변환 | 낮음 | — | — | 적정 | — | 88 | 명확 |
| `History` | App.jsx | 1 | App(JSX) page===history | 히스토리 목록 렌더링 | 낮음 | — | — | 적정 | — | 90 | 명확 |

**평균 무결성 점수: 85점** (전체 55개 함수 기준)

---

## 2. 중복 함수 목록

| 함수 A | 함수 B | 중복 내용 |
|--------|--------|-----------|
| `IconLinkSingle` | `IconLinkDouble` | SVG path 코드 동일, count만 다름 |
| `scrollToToday` | `scrollToCurrentMonth` | DOM 조회 + scrollTo 로직 거의 동일 (.planner vs .timeline-panel 선택자 차이) |
| `buildSpeechText` | 브리핑 UI 렌더링 | 동일 데이터를 텍스트와 JSX로 각각 이중 구성 |
| `closeDailyBrief` | `dismissDailyBrief` | close는 1줄 래퍼로 통합 또는 인라인 가능 |

---

## 3. 사용되지 않는 함수 목록

없음 — 모든 함수가 직접 또는 JSX를 통해 호출됨.

---

## 4. 제거 가능한 코드

- `loadFromDB` 내 rangeStart/End 이중 초기화 블록 (로드 후 다시 defaultStart/defaultEnd 덮어씀 → 설정 DB 값이 무시될 수 있음)
- `console.log('HISTORY_ROWS=', ...)` / `console.log('HISTORY_INSERT_ERROR=', ...)` — 디버그 로그 제거 필요

---

## 5. 리팩토링 우선순위

| 우선순위 | 함수명 | 점수 | 이유 |
|---------|--------|------|------|
| P1 | `toggleScheduleLock` | 60 | 비밀번호 하드코딩 — 보안 취약 |
| P2 | `saveAllToDB` | 55 | delete-then-insert 데이터 손실 위험, 150+줄 SRP 위반 |
| P3 | `App` | 42 | 2600+줄 단일 컴포넌트 SRP 위반 |
| P4 | `loadFromDB` | 68 | 이중 범위 초기화, 4개 테이블 순차 로드 |
| P5 | `saveChangeHistories` | 65 | 케이스별 로직 혼재 |
| P6 | `Dashboard` | 68 | 300+줄 컴포넌트 |
| P7 | `scrollToToday` / `scrollToCurrentMonth` | 75 | 중복 유틸 |
| P8 | `setRange` | 78 | 날짜 계산 + 스크롤 혼재 |
