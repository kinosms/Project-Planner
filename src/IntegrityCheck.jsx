import { useState, useMemo, useEffect } from 'react'
import IntegrityGraph from './IntegrityGraph'

export default function IntegrityCheck({ projects }) {
  // ─── 1. 함수 목록 (정적 분석 기반) ───────────────────────────────
  const functionList = [
    {
      name: 'IconLinkSingle',
      file: 'App.jsx',
      calls: 0,
      calledBy: ['App(JSX)'],
      role: 'SVG 링크 단일 아이콘 렌더링',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 95,
      opinion: '역할 명확. 다만 IconLinkDouble과 SVG 경로 중복 — 공통 컴포넌트로 통합 가능.',
    },
    {
      name: 'IconLinkDouble',
      file: 'App.jsx',
      calls: 0,
      calledBy: ['App(JSX)'],
      role: 'SVG 링크 이중 아이콘 렌더링',
      dupRisk: '높음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: true,
      score: 80,
      opinion: 'IconLinkSingle과 path 코드 중복. props로 count를 받는 단일 컴포넌트로 통합 권장.',
    },
    {
      name: 'App',
      file: 'App.jsx',
      calls: 30,
      calledBy: ['main.jsx'],
      role: '전체 앱 루트 — 상태 관리, 페이지 라우팅, DB 저장/로드, 이벤트 핸들링 총괄',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '과부하',
      refactor: true,
      score: 42,
      opinion: '2600+ 줄 단일 컴포넌트. 상태/로직을 커스텀 훅으로 분리(useProjects, usePainting, useHistory), 플래너/대시보드/히스토리 컴포넌트 별도 파일 추출 필요.',
    },
    {
      name: 'isProjectCompleted',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['visibleProjects(useMemo)'],
      role: '프로젝트 내 모든 task가 완료인지 판별',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 90,
      opinion: '간결하고 역할 명확.',
    },
    {
      name: 'scrollToToday',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['플래너 탭 onClick'],
      role: '플래너 스크롤을 오늘 날짜로 이동',
      dupRisk: '중간',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: true,
      score: 75,
      opinion: 'scrollToCurrentMonth과 거의 동일 패턴(.planner vs .timeline-panel 차이만 존재). 유틸 함수로 통합 권장.',
    },
    {
      name: 'focusTask',
      file: 'App.jsx',
      calls: 2,
      calledBy: ['focusHistory', 'Dashboard/urgentTasks onClick'],
      role: '특정 task로 플래너 스크롤 + 하이라이트',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 82,
      opinion: '중첩 setTimeout 사용. useLayoutEffect로 개선 가능.',
    },
    {
      name: 'focusHistory',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['History 컴포넌트 onClick'],
      role: '히스토리 항목으로 project/task를 찾아 focusTask 호출',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 85,
      opinion: '역할 명확.',
    },
    {
      name: 'saveProjects',
      file: 'App.jsx',
      calls: 14,
      calledBy: ['대부분의 프로젝트/업무 변경 함수'],
      role: 'state + localStorage 동시 저장 래퍼',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 92,
      opinion: '핵심 래퍼. 현재 설계 적절.',
    },
    {
      name: 'saveChangeHistories',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['saveAllToDB'],
      role: 'loadedProjects vs projects 비교 후 변경 이력 Supabase 저장',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '약간 과부하',
      refactor: true,
      score: 65,
      opinion: '프로젝트 삭제/이름변경/업무 삭제/필드변경/일정변경 로직 혼재. 각 케이스를 헬퍼 함수로 분리하면 테스트 용이.',
    },
    {
      name: 'showToast',
      file: 'App.jsx',
      calls: 3,
      calledBy: ['moveLocalHistory', 'saveAllToDB'],
      role: '토스트 메시지 표시 (2.2초)',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 95,
      opinion: '간결. 타이머 정리(clearTimeout) 없는 점 주의.',
    },
    {
      name: 'buildSnapshot',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['saveLocalSnapshot'],
      role: '현재 state를 스냅샷 객체로 직렬화',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 90,
      opinion: '역할 명확.',
    },
    {
      name: 'saveLocalSnapshot',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['saveAllToDB'],
      role: 'localStorage 로컬 히스토리(최대 3개) 저장',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 88,
      opinion: '슬라이스 -3으로 최대 3개 유지. 명확.',
    },
    {
      name: 'applySnapshot',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['moveLocalHistory'],
      role: '스냅샷을 state + localStorage에 복원',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 90,
      opinion: '역할 명확.',
    },
    {
      name: 'moveLocalHistory',
      file: 'App.jsx',
      calls: 2,
      calledBy: ['← 버튼 onClick', '→ 버튼 onClick'],
      role: '로컬 히스토리 인덱스 이동 후 스냅샷 복원',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 88,
      opinion: '명확.',
    },
    {
      name: 'saveAllToDB',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['저장 버튼 onClick'],
      role: 'DB 전체 재저장 (delete-then-insert 패턴)',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '과부하',
      refactor: true,
      score: 55,
      opinion: 'delete-then-insert 방식은 동시 접속 시 데이터 소실 위험. upsert/diff 패턴 전환 권장. 함수 내 for 루프 sequential await → Promise.all 전환 가능. 150+ 줄 함수 분리 필요.',
    },
    {
      name: 'loadHistories',
      file: 'App.jsx',
      calls: 2,
      calledBy: ['saveAllToDB', 'loadFromDB'],
      role: 'Supabase planner_histories 100건 로드',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 88,
      opinion: '명확.',
    },
    {
      name: 'loadFromDB',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['useEffect(mount)'],
      role: 'Supabase에서 settings/projects/tasks/dates 전체 로드',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '약간 과부하',
      refactor: true,
      score: 68,
      opinion: '4개 테이블 순차 로드. 로드 후 rangeStart/End를 또 초기화하는 이중 로직 존재. 설정 로드와 데이터 로드 분리 권장.',
    },
    {
      name: 'moveNextCell',
      file: 'App.jsx',
      calls: 5,
      calledBy: ['input onKeyDown (다수)'],
      role: 'Enter/Tab 시 다음 입력 셀로 포커스 이동, 마지막 셀이면 행 추가',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 80,
      opinion: '논리 혼재(이동 + 추가). addTaskToProject 호출 조건이 currentIndex+1이 없을 때만이므로 정상. 주석 부재.',
    },
    {
      name: 'addProject',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['+ 프로젝트 버튼 onClick'],
      role: '빈 프로젝트 + 빈 태스크 1개 추가',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 90,
      opinion: '명확.',
    },
    {
      name: 'toggleRedDate',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['grid-cell onDoubleClick'],
      role: '셀 redDates 토글',
      dupRisk: '중간',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 85,
      opinion: 'paintDate와 유사 구조. 통합 가능성 있음.',
    },
    {
      name: 'isRedDateSelected',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['timeline 셀 렌더링'],
      role: 'task.redDates 포함 여부 반환',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 95,
      opinion: '1줄 헬퍼. 명확.',
    },
    {
      name: 'addTaskToProject',
      file: 'App.jsx',
      calls: 2,
      calledBy: ['+ 버튼 onClick', 'moveNextCell'],
      role: '프로젝트에 빈 업무 추가',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 90,
      opinion: '명확.',
    },
    {
      name: 'updateDateMemo',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['grid-cell onMouseDown (Shift)'],
      role: '셀 메모 편집 모달 열기 (memoEditor state 설정)',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 88,
      opinion: '명확.',
    },
    {
      name: 'updateProjectName',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['프로젝트명 input onChange'],
      role: '프로젝트명 업데이트',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 90,
      opinion: 'updateTask로 통합 가능하나 명시성 측면에서 분리도 합당.',
    },
    {
      name: 'updateTask',
      file: 'App.jsx',
      calls: 5,
      calledBy: ['work/title/owner/artifactName input onChange'],
      role: '단일 key-value로 task 업데이트',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 92,
      opinion: '범용 핸들러. 적절.',
    },
    {
      name: 'updateTaskFields',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['URL 모달 저장 버튼'],
      role: '여러 필드를 한번에 task 업데이트',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 92,
      opinion: 'updateTask와 역할이 겹치나, 다중 필드용으로 분리한 의도 명확.',
    },
    {
      name: 'deleteTask',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['삭제 버튼 onClick'],
      role: '업무 삭제 (마지막 업무 삭제 시 프로젝트도 삭제)',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '약간 혼재',
      refactor: true,
      score: 78,
      opinion: '업무 삭제가 프로젝트 삭제를 암묵적으로 유발함. 의도적이면 주석 필요.',
    },
    {
      name: 'cycleStatus',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['status-pill onClick'],
      role: '대기→진행→완료 순환',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 92,
      opinion: '명확.',
    },
    {
      name: 'updateRange',
      file: 'App.jsx',
      calls: 4,
      calledBy: ['setRange', 'addOneMonth', 'toolbar onClick (전체기간)'],
      role: 'rangeStart/End state + localStorage 동시 업데이트',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 92,
      opinion: 'saveProjects 패턴과 동일한 래퍼 역할. 명확.',
    },
    {
      name: 'setRange',
      file: 'App.jsx',
      calls: 4,
      calledBy: ['이번달/최근3개월/최근6개월 버튼'],
      role: '날짜 범위 프리셋 적용',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '약간 과부하',
      refactor: true,
      score: 78,
      opinion: '3가지 모드 분기 + scrollToCurrentMonth 혼재. 날짜 계산을 별도 헬퍼로 분리 권장.',
    },
    {
      name: 'scrollToCurrentMonth',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['setRange'],
      role: '.timeline-panel을 현재 달로 스크롤',
      dupRisk: '중간',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: true,
      score: 75,
      opinion: 'scrollToToday와 거의 동일 로직. 공통 유틸 함수 통합 권장.',
    },
    {
      name: 'addOneMonth',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['+1개월 버튼 onClick'],
      role: 'rangeEnd를 1달 연장',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 90,
      opinion: '명확.',
    },
    {
      name: 'toggleScheduleLock',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['잠금 버튼 onClick'],
      role: '편집 잠금/해제 (비밀번호 확인)',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: true,
      score: 60,
      opinion: '비밀번호 하드코딩 — 보안 취약. 환경변수 또는 서버 검증 방식으로 전환 필요.',
    },
    {
      name: 'isDateSelected',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['timeline 셀 렌더링'],
      role: 'task.dates 포함 여부 반환',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 95,
      opinion: '1줄 헬퍼.',
    },
    {
      name: 'paintDate',
      file: 'App.jsx',
      calls: 2,
      calledBy: ['toggleDate', 'paintOverDate'],
      role: '날짜 add/remove 모드에 따라 task.dates 갱신',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 88,
      opinion: '명확.',
    },
    {
      name: 'toggleDate',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['grid-cell onMouseDown'],
      role: '날짜 토글 시작 (페인트 모드 설정 + paintDate)',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 88,
      opinion: '명확.',
    },
    {
      name: 'paintOverDate',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['grid-cell onMouseEnter'],
      role: '드래그 중 날짜에 페인트 적용',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 92,
      opinion: '명확.',
    },
    {
      name: 'endPaint',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['handleAppMouseUp'],
      role: '페인트 상태 초기화',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 95,
      opinion: '명확.',
    },
    {
      name: 'getWeekNumberInMonth',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['weekGroups(useMemo)'],
      role: '날짜의 월내 주차 계산',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 82,
      opinion: '로직 복잡. 주석 부족.',
    },
    {
      name: 'getDisplayStatus',
      file: 'App.jsx',
      calls: 4,
      calledBy: ['대시보드 렌더링', '상태 카운트', 'History 렌더링'],
      role: '현재 날짜 기준 task 표시 상태 계산',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 85,
      opinion: '완료 후에도 "진행"으로 남는 의도적 동작에 주석 필요.',
    },
    {
      name: 'getTaskProgress',
      file: 'App.jsx',
      calls: 3,
      calledBy: ['대시보드 진도율', 'projectProgressSummary'],
      role: 'task 진도율 0-100 계산',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 88,
      opinion: 'redDates를 진도율 계산에서 제외한 것이 의도적인지 불명확.',
    },
    {
      name: 'isLastFridayOfMonth',
      file: 'App.jsx',
      calls: 2,
      calledBy: ['date-row 렌더링', 'grid-cell 렌더링'],
      role: '월 마지막 금요일 여부 판별',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 88,
      opinion: '명확.',
    },
    {
      name: 'toggleCustomHolidayDate',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['day-cell onDoubleClick'],
      role: '커스텀 휴일 토글 + localStorage 저장',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 90,
      opinion: '명확.',
    },
    {
      name: 'reorderProject',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['프로젝트 onMouseUp (drag)'],
      role: 'Shift+드래그로 프로젝트 순서 변경',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 90,
      opinion: '명확.',
    },
    {
      name: 'reorderTask',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['업무 onMouseUp (drag)'],
      role: 'Shift+드래그로 업무 순서 변경',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 90,
      opinion: '명확.',
    },
    {
      name: 'handleAppMouseUp',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['div.app onMouseUp'],
      role: '마우스업 시 페인트/드래그 상태 초기화',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 92,
      opinion: '명확.',
    },
    // DailyBrief
    {
      name: 'DailyBrief',
      file: 'App.jsx',
      calls: 0,
      calledBy: ['App(JSX) showDailyBrief'],
      role: '일일 브리핑 팝업 (진도/종료임박/음성 읽기)',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 85,
      opinion: '브리핑 텍스트 빌드 로직을 별도 함수로 분리하면 테스트 용이.',
    },
    {
      name: 'buildSpeechText',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['handleSpeak'],
      role: '음성 읽기용 텍스트 구성',
      dupRisk: '중간',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 82,
      opinion: '브리핑 UI 텍스트와 내용 중복. 단일 데이터 소스에서 UI/음성 모두 생성하도록 리팩토링 권장.',
    },
    {
      name: 'handleSpeak',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['음성 버튼 onClick'],
      role: 'Web Speech API 음성 재생/중지',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 88,
      opinion: '명확.',
    },
    {
      name: 'closeDailyBrief',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['DailyBrief onClose'],
      role: 'showDailyBrief false 설정',
      dupRisk: '높음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: true,
      score: 70,
      opinion: '1줄 함수. dismissDailyBrief와 합치거나 인라인 처리 가능.',
    },
    {
      name: 'dismissDailyBrief',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['DailyBrief onDismiss'],
      role: '오늘 하루 브리핑 숨김 (localStorage)',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 90,
      opinion: '명확.',
    },
    // DonutChart
    {
      name: 'DonutChart',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['Dashboard(JSX)'],
      role: '도넛 차트 SVG 렌더링',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 88,
      opinion: '명확. 외부 라이브러리 없이 구현.',
    },
    // Dashboard
    {
      name: 'Dashboard',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['App(JSX) page===dashboard'],
      role: '대시보드 전체 렌더링 (카드/진도/도넛/담당자/종료예정/프로젝트/담당자 상세)',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '약간 과부하',
      refactor: true,
      score: 68,
      opinion: '300+ 줄 단일 컴포넌트. 섹션별 서브 컴포넌트 분리 권장.',
    },
    // History utilities
    {
      name: 'getHistoryType',
      file: 'App.jsx',
      calls: 2,
      calledBy: ['History 렌더링'],
      role: '히스토리 action → 타입 문자열 변환',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 90,
      opinion: '명확.',
    },
    {
      name: 'buildHistorySentence',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['History 렌더링'],
      role: '히스토리 action → 자연어 문장 변환',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 88,
      opinion: '명확.',
    },
    {
      name: 'History',
      file: 'App.jsx',
      calls: 1,
      calledBy: ['App(JSX) page===history'],
      role: '히스토리 목록 렌더링',
      dupRisk: '낮음',
      deadCode: false,
      unused: false,
      srp: '적정',
      refactor: false,
      score: 90,
      opinion: '명확.',
    },
  ]

  // ─── 2. 집계 ─────────────────────────────────────────────────────
  const avgScore = Math.round(functionList.reduce((s, f) => s + f.score, 0) / functionList.length)
  const refactorNeeded = functionList.filter(f => f.refactor)
  const deadList = functionList.filter(f => f.deadCode)
  const unusedList = functionList.filter(f => f.unused)
  const dupList = functionList.filter(f => f.dupRisk === '높음')
  const overSrp = functionList.filter(f => f.srp === '과부하' || f.srp === '약간 과부하')

  // ─── 3. 기능 무결성 데이터 ───────────────────────────────────────
  const featureList = [
    {
      name: '앱 초기화 및 DB 로드',
      purpose: '앱 최초 마운트 시 Supabase의 projects/tasks/task_dates/planner_settings를 모두 로드하여 로컬 state와 동기화한다.',
      trigger: '앱 마운트 (useEffect [])',
      flow: ['useEffect(mount)', 'loadFromDB()', 'SELECT planner_settings', 'setRangeStart / setRangeEnd', 'SELECT projects → SELECT tasks → SELECT task_dates', 'nextProjects 조합', 'setProjects / setLoadedProjects', 'loadHistories()', 'SELECT planner_histories', 'setHistories()'],
      states: ['projects', 'loadedProjects', 'rangeStart', 'rangeEnd', 'selectedRange', 'histories'],
      tables: ['planner_settings', 'projects', 'tasks', 'task_dates', 'planner_histories'],
      successCondition: '플래너/대시보드에 프로젝트 데이터가 정상 표시됨',
      branches: ['settingRows 없으면 기본 rangeStart/End 유지', 'projectError 발생 시 early return'],
      failures: [
        'Supabase 네트워크 에러 → console.log만 출력, 사용자 피드백 없음',
        'task_dates 로드 실패 시 날짜 데이터 전체 소실',
        'artifact_url JSON 파싱 실패 → catch({}) 무시, artifactUrls 빈 배열 처리',
      ],
      score: 62,
      opinion: '에러 발생 시 사용자에게 알림이 전혀 없다. 로드 실패 시 showToast("데이터 로드 실패") 연결 필요. 4개 테이블 순차 SELECT → Promise.all 병렬화로 속도 개선 가능.',
    },
    {
      name: '프로젝트·업무 생성',
      purpose: '새 프로젝트와 업무를 추가하고 즉시 localStorage에 반영한다.',
      trigger: '플래너 화면 "+ 프로젝트" 버튼 클릭',
      flow: ['+ 프로젝트 버튼 onClick', 'addProject()', 'saveProjects(nextProjects)', 'setProjects(next)', 'localStorage.setItem(projectPlannerProjects)'],
      states: ['projects'],
      tables: [],
      successCondition: '플래너에 빈 프로젝트 행과 빈 업무 행 1개가 즉시 추가됨',
      branches: ['Tab/Enter 입력 시 addTaskToProject() → 다음 행 포커스'],
      failures: [
        'scheduleLocked === true → 버튼 disabled, 입력 불가',
        'localStorage 용량 초과 시 저장 실패 (에러 처리 없음)',
      ],
      score: 85,
      opinion: '로컬 저장만 되므로 saveAllToDB 호출 전까지 새로고침 시 데이터는 localStorage에서 복원됨. localStorage 저장 실패 예외 처리 추가 권장.',
    },
    {
      name: '업무 정보 편집',
      purpose: '업무의 work/title/owner/artifactName/artifactUrls 필드를 인라인 input으로 수정하고 즉시 저장한다.',
      trigger: '플래너 업무 행의 input onChange 이벤트',
      flow: ['input onChange', 'updateTask(projectId, taskId, key, value)', 'saveProjects(next)', 'setProjects / localStorage'],
      states: ['projects'],
      tables: [],
      successCondition: '변경값이 입력 즉시 화면에 반영되고 localStorage에 저장됨',
      branches: ['URL 편집: setUrlEditor → 모달 → updateTaskFields({artifactUrls, artifactUrl}) → saveProjects'],
      failures: [
        'scheduleLocked === true → 모든 input disabled',
        'URL 모달에서 저장 없이 닫으면 변경 사항 유실',
      ],
      score: 88,
      opinion: '편집 중 오타도 즉시 저장되어 undo가 불편함. debounce 또는 onBlur 저장 방식 검토 권장.',
    },
    {
      name: '일정 페인팅 (날짜 드래그)',
      purpose: '타임라인 셀을 클릭/드래그하여 업무 날짜(dates)를 추가하거나 제거한다.',
      trigger: '플래너 타임라인 grid-cell onMouseDown',
      flow: ['grid-cell onMouseDown', 'toggleDate(projectId, taskId, task, date)', 'setIsPainting(true) / setPaintMode(add|remove)', 'paintDate()', 'saveProjects()', '[드래그 중] grid-cell onMouseEnter', 'paintOverDate() → paintDate() → saveProjects()', 'div.app onMouseUp', 'handleAppMouseUp() → endPaint()', 'setIsPainting(false) / setPaintMode(null)'],
      states: ['isPainting', 'paintMode', 'projects'],
      tables: [],
      successCondition: '클릭/드래그한 날짜가 파란 셀로 표시되고, 재클릭 시 해제됨',
      branches: [
        'Shift+클릭: updateDateMemo() → 메모 모달로 분기',
        'scheduleLocked: early return으로 페인트 차단',
        'mode=add: 이미 선택된 날짜 재클릭 시 무시 (includes 체크)',
        'mode=remove: 선택된 날짜 드래그 시 연속 제거',
      ],
      failures: [
        '빠른 드래그 시 일부 onMouseEnter 누락 → 날짜 불연속 (브라우저 이벤트 한계)',
        '페인트 중 창 밖으로 마우스 이탈 시 onMouseUp 미발생 → isPainting stuck',
      ],
      score: 78,
      opinion: '창 밖 이탈 시 페인트 상태가 stuck되는 문제가 있음. window.addEventListener("mouseup", endPaint) 글로벌 이벤트 등록으로 해결 가능.',
    },
    {
      name: '적색 날짜 토글',
      purpose: '특정 날짜 셀을 더블클릭하여 위험/중요 날짜(redDates)를 추가하거나 제거한다.',
      trigger: '플래너 타임라인 grid-cell onDoubleClick',
      flow: ['grid-cell onDoubleClick', 'toggleRedDate(projectId, taskId, date)', 'saveProjects()'],
      states: ['projects'],
      tables: [],
      successCondition: '더블클릭한 날짜가 붉은 셀로 표시되고 재더블클릭 시 해제됨',
      branches: ['scheduleLocked: early return'],
      failures: [
        '싱글클릭(페인트) 직후 더블클릭 인식으로 dates와 redDates 동시 설정 가능성',
      ],
      score: 82,
      opinion: 'dates와 redDates가 동시에 설정된 경우 시각적으로 어떻게 처리할지 정의가 없음. 상호 배타 로직 추가 고려.',
    },
    {
      name: '셀 메모 입력/수정/삭제',
      purpose: 'Shift+클릭으로 특정 날짜 셀에 메모를 입력, 수정, 삭제하는 모달을 제공한다.',
      trigger: '플래너 grid-cell Shift+onMouseDown',
      flow: ['Shift+onMouseDown', 'updateDateMemo(projectId, taskId, date)', 'setMemoEditor({projectId, taskId, date, memo})', '[모달 저장] saveProjects(next)', 'setMemoEditor(null)', '[메모 삭제] delete nextMemoDates[date] → saveProjects()'],
      states: ['memoEditor', 'projects'],
      tables: [],
      successCondition: '저장 시 해당 셀에 메모 도트(has-memo 클래스)가 표시되고 hover 시 텍스트가 보임',
      branches: ['메모 내용이 빈 문자열이면 저장 시 delete 처리'],
      failures: [
        'scheduleLocked: 모달은 열리지만 실제 save는 saveProjects 내부에서 잠금 체크 없음 → 잠금 상태에서도 메모 저장 가능한 버그',
      ],
      score: 70,
      opinion: '잠금 상태에서도 Shift+클릭으로 메모 편집이 가능한 버그가 있음. updateDateMemo 호출부에 scheduleLocked 가드 추가 필요.',
    },
    {
      name: '문서 URL 관리',
      purpose: '업무에 연결된 문서 링크(1개 이상)를 추가/수정/삭제하고 새 탭으로 열 수 있다.',
      trigger: '플래너 업무 행의 링크 버튼(url-button) 클릭',
      flow: ['url-button onClick', 'setUrlEditor({projectId, taskId, urls})', '[URL 편집] setUrlEditor({...urlEditor, urls: newUrls})', '[열기] window.open(url, "_blank")', '[저장] updateTaskFields({artifactUrls, artifactUrl}) → saveProjects()', 'setUrlEditor(null)'],
      states: ['urlEditor', 'projects'],
      tables: [],
      successCondition: '저장 후 링크 버튼 아이콘이 URL 수에 맞게 변경됨 (1개: 단일, 2개+: 이중)',
      branches: [
        '빈 URL 필터링: validUrls = urls.filter(u => u.trim())',
        'artifactUrls 2개 이상: IconLinkDouble 표시',
        '취소 버튼: setUrlEditor(null), 변경 미적용',
      ],
      failures: [
        'URL 유효성 검증 없음 → 임의 문자열도 저장 가능',
        '모달 바깥 클릭(backdrop) 시 변경 내용 유실',
      ],
      score: 80,
      opinion: 'URL 형식 유효성 검증(startsWith http) 추가 권장. backdrop 클릭 시 변경 내용 유실에 대한 사용자 경고 필요.',
    },
    {
      name: '업무 상태 변경',
      purpose: '업무 상태(대기→진행→완료)를 순환 클릭으로 수동 변경한다.',
      trigger: '플래너 업무 행 status-pill 클릭',
      flow: ['status-pill onClick', 'cycleStatus(projectId, taskId)', 'order 배열에서 다음 인덱스 계산', 'saveProjects()'],
      states: ['projects'],
      tables: [],
      successCondition: '클릭마다 대기→진행→완료→대기 순으로 뱃지 색상이 변경됨',
      branches: [
        'scheduleLocked: early return',
        '완료 상태에서 클릭: 대기로 순환',
        'getDisplayStatus()는 날짜 기반 자동 계산 — cycleStatus의 수동 변경과 별개',
      ],
      failures: [
        '완료 상태로 수동 변경 후 getDisplayStatus가 날짜 기반으로 다시 "진행"을 반환할 수 있음 → 표시 불일치',
      ],
      score: 75,
      opinion: 'task.status(수동)와 getDisplayStatus(자동 계산)가 분리되어 있어 혼선 발생 가능. 표시 우선순위 정책을 명문화하거나 단일화 권장.',
    },
    {
      name: '업무 삭제',
      purpose: '확인 후 업무를 삭제한다. 마지막 업무 삭제 시 프로젝트도 자동 삭제된다.',
      trigger: '플래너 업무 행 삭제(x) 버튼 클릭',
      flow: ['삭제 버튼 onClick', 'confirm("삭제할까?")', 'deleteTask(projectId, taskId)', 'tasks.filter(t => t.id !== taskId)', 'project.tasks.length === 0이면 해당 프로젝트도 filter로 제거', 'saveProjects()'],
      states: ['projects'],
      tables: [],
      successCondition: '업무 행이 즉시 사라짐. 마지막 업무였다면 프로젝트 행도 사라짐',
      branches: [
        'confirm 취소: early return',
        '프로젝트 내 업무가 1개: 업무 삭제 → 프로젝트도 함께 삭제',
      ],
      failures: [
        '삭제 후 undo 방법 없음 (로컬 히스토리는 DB 저장 시점에만 생성)',
        '암묵적 프로젝트 삭제가 사용자 예상 밖 동작을 유발할 수 있음',
      ],
      score: 72,
      opinion: '마지막 업무 삭제 시 프로젝트 자동 삭제는 암묵적 동작. 명시적 경고 추가 권장. 삭제 직후 로컬 스냅샷 저장으로 즉시 undo 지원 고려.',
    },
    {
      name: 'DB 전체 저장',
      purpose: '로컬 state의 모든 데이터를 Supabase에 저장하고 변경 이력을 기록한다.',
      trigger: '플래너 "저장" 버튼 클릭',
      flow: ['저장 버튼 onClick', 'confirm("DB에 저장할까?")', 'saveAllToDB()', 'setIsSaving(true)', 'saveChangeHistories() → INSERT planner_histories', 'DELETE projects (neq id 0)', 'for project: INSERT projects → INSERT tasks → INSERT task_dates', 'UPSERT planner_settings', 'setLoadedProjects(deepCopy)', 'loadHistories()', 'saveLocalSnapshot()', 'showToast("DB 저장 완료")', 'setIsSaving(false)'],
      states: ['isSaving', 'loadedProjects', 'localHistory', 'historyIndex', 'histories'],
      tables: ['projects', 'tasks', 'task_dates', 'planner_settings', 'planner_histories'],
      successCondition: '"DB 저장 완료" toast가 표시되고 히스토리 목록이 갱신됨',
      branches: [
        'isSaving === true: early return (중복 저장 방지)',
        'confirm 취소: early return',
        'rows.length === 0: task_dates INSERT 건너뜀',
      ],
      failures: [
        'DELETE 성공 후 INSERT 중 에러 → 데이터 일부 소실 (트랜잭션 없음)',
        '동시 접속 시 나중 저장이 이전 저장을 완전히 덮어씀',
        'saveChangeHistories의 console.log 디버그 코드가 프로덕션 노출',
        '개별 INSERT 에러 시 throw로 후속 저장이 모두 중단됨',
      ],
      score: 52,
      opinion: 'delete-then-insert 패턴이 가장 큰 위험. Supabase RPC 또는 upsert + diff 방식으로 전환 필요. 최소한 DELETE 전 백업 스냅샷 저장 후 에러 시 복원하는 로직 추가 권장.',
    },
    {
      name: '로컬 히스토리 (Undo/Redo)',
      purpose: 'DB 저장 시점의 스냅샷을 최대 3개 보관하고, ← → 버튼으로 이전/다음 상태로 복원한다.',
      trigger: '← 버튼 또는 → 버튼 클릭',
      flow: ['← 버튼 onClick', 'moveLocalHistory(-1)', 'nextIndex = historyIndex - 1', 'setHistoryIndex(nextIndex)', 'applySnapshot(localHistory[nextIndex])', 'setProjects / setRangeStart / setRangeEnd / setCustomHolidayDates', 'localStorage 4개 항목 동기화', 'showToast("이전 상태로 이동했습니다")'],
      states: ['localHistory', 'historyIndex', 'projects', 'rangeStart', 'rangeEnd', 'customHolidayDates'],
      tables: [],
      successCondition: '플래너가 해당 스냅샷 기준으로 재렌더링되고 toast가 표시됨',
      branches: [
        'nextIndex < 0: early return (← 버튼 disabled)',
        'nextIndex >= localHistory.length: early return (→ 버튼 disabled)',
        '히스토리 없음(length 0): 양쪽 버튼 모두 disabled',
      ],
      failures: [
        'localStorage 저장 실패 시 에러 처리 없음',
        '스냅샷 최대 3개 제한으로 오래된 이력은 자동 삭제됨',
        'applySnapshot 후 loadedProjects는 갱신되지 않아 다음 saveAllToDB 시 이력 계산 기준이 틀릴 수 있음',
      ],
      score: 76,
      opinion: 'applySnapshot 후 loadedProjects도 함께 갱신해야 saveChangeHistories의 diff 기준이 올바름. 현재는 복원 후 저장 시 불필요한 이력이 생성될 수 있음.',
    },
    {
      name: '프로젝트/업무 순서 변경',
      purpose: '잠금 해제 상태에서 Shift+드래그로 프로젝트 또는 업무의 표시 순서를 변경한다.',
      trigger: '플래너 Shift+onMouseDown (project-cell 또는 task-row-fields)',
      flow: ['Shift+onMouseDown', 'setDragging({type, id|taskId})', 'onMouseEnter → setDragOver({id|taskId})', 'onMouseUp → reorderProject(fromId, toId) | reorderTask(projectId, fromTaskId, toTaskId)', 'saveProjects()', 'setDragging(null) / setDragOver(null)'],
      states: ['dragging', 'dragOver', 'projects'],
      tables: [],
      successCondition: '드래그 대상이 목적지로 이동하여 순서가 변경됨',
      branches: [
        'type=project: 전체 프로젝트(하위 업무 포함) 이동',
        'type=task: 같은 프로젝트 내에서만 이동',
        'fromId === toId: early return',
        'scheduleLocked: onMouseDown에서 early return',
      ],
      failures: [
        '다른 프로젝트 간 업무 이동 불가 (현재 미지원, 조용히 무시됨)',
        'Shift 없이 드래그: dragging이 설정되지 않아 이동 미발생',
        '창 밖으로 마우스 이탈 시 dragging 상태 stuck 가능성',
      ],
      score: 80,
      opinion: '프로젝트 간 업무 이동 미지원이 사용자에게 안내되지 않음. UX 피드백 추가 권장.',
    },
    {
      name: '히스토리 조회 및 업무 이동',
      purpose: 'DB에 저장된 변경 이력을 목록으로 확인하고 클릭 시 해당 업무로 플래너에서 이동한다.',
      trigger: '히스토리 탭 클릭 → history-item 클릭',
      flow: ['히스토리 탭 onClick', 'setPage("history")', 'History 컴포넌트 렌더링', 'getHistoryType() / buildHistorySentence()', 'history-item onClick', 'focusHistory(history)', 'visibleProjects.find(by name)', 'project.tasks.find(by work+title)', 'focusTask({...task})', 'setPage("planner")', 'setTimeout → plannerEl.scrollTo + setHighlightTaskId', 'setTimeout(5000) → setHighlightTaskId(null)'],
      states: ['page', 'histories', 'highlightTaskId'],
      tables: ['planner_histories'],
      successCondition: '플래너로 전환되고 해당 업무 행이 하이라이트되며 스크롤이 이동함',
      branches: [
        '삭제 이력(업무/프로젝트 삭제): isFocusable=false, 클릭 시 이동 없음',
        '업무가 없는 경우: focusHistory에서 early return',
      ],
      failures: [
        '업무명 변경 이력의 경우 변경 후 이름으로 탐색하므로 이전 이름 기준 항목 클릭 시 이동 실패',
        'taskRefs에 해당 id가 없으면 스크롤 미발생 (silent fail)',
        '히스토리는 최신 100건만 로드되어 오래된 이력은 조회 불가',
      ],
      score: 74,
      opinion: '이름 변경된 업무에 대한 히스토리 이동 실패가 가장 큰 UX 문제. task_id 기반 탐색으로 전환 권장. 100건 제한도 사용자에게 안내 필요.',
    },
    {
      name: '일일 브리핑 팝업',
      purpose: '대시보드 최초 방문 시 오늘의 프로젝트 진도와 종료 임박 업무를 팝업으로 보여주고 음성으로 읽어준다.',
      trigger: 'page === "dashboard" 진입 (useEffect [page])',
      flow: ['setPage("dashboard")', 'useEffect([page])', 'localStorage.getItem("dailyBriefDismissed") 확인', 'dismissed !== todayString → setShowDailyBrief(true)', 'DailyBrief 렌더링', '[음성] handleSpeak() → buildSpeechText() → SpeechSynthesisUtterance', '[닫기] closeDailyBrief() → setShowDailyBrief(false)', '[하루 그만보기] dismissDailyBrief() → localStorage.setItem'],
      states: ['showDailyBrief', 'speaking'],
      tables: [],
      successCondition: '오늘 처음 대시보드 방문 시 팝업 표시. 오늘 하루 그만보기 후 재방문 시 팝업 미표시',
      branches: [
        'dismissed === todayString: 팝업 표시 안 함',
        'window.speechSynthesis 없음: 음성 버튼 클릭 시 early return',
        'speaking === true 상태에서 재클릭: 음성 중지',
      ],
      failures: [
        'page가 dashboard가 아닌 상태에서 다시 dashboard로 전환할 때마다 useEffect 재실행 → 오늘 이미 닫았어도 dismissed 확인 후 재표시 가능',
        'urgentTasks는 status === "진행" 필터이므로 "대기" 상태 업무는 종료임박 목록에 미표시',
      ],
      score: 78,
      opinion: 'dismissed 체크는 정상 동작하나 page 전환 시마다 useEffect가 실행되는 구조. 이미 닫은 경우(showDailyBrief=false)에도 재평가하는 점은 불필요한 연산. dismissed 조건 외 showDailyBrief 상태도 고려 필요.',
    },
    {
      name: '잠금/편집 전환',
      purpose: '비밀번호 입력으로 편집 잠금을 해제하고 플래너 편집을 활성화한다.',
      trigger: '"잠금상태" 버튼 클릭',
      flow: ['잠금 버튼 onClick', 'toggleScheduleLock()', 'scheduleLocked === false → setScheduleLocked(true) (잠금)', 'scheduleLocked === true → prompt("LDAP 입력")', 'passwords.includes(input) → setScheduleLocked(false)', '불일치 → alert("권한이 없습니다")'],
      states: ['scheduleLocked'],
      tables: [],
      successCondition: '올바른 비밀번호 입력 시 버튼 텍스트가 "편집중"으로 변경되고 모든 입력 필드가 활성화됨',
      branches: [
        '이미 편집 중(scheduleLocked=false): 클릭 시 즉시 잠금',
        '비밀번호 불일치: alert 후 잠금 상태 유지',
      ],
      failures: [
        '비밀번호 2개가 소스코드에 하드코딩 → 클라이언트 번들 노출 시 누구나 편집 가능',
        'prompt/alert는 브라우저 팝업 차단 시 동작 안 함',
        '비밀번호 입력 취소(null)도 불일치 처리되어 잠금 유지는 되나 불필요한 alert 없음 (passwords.includes(null) = false)',
      ],
      score: 45,
      opinion: '비밀번호 하드코딩은 즉시 수정이 필요한 보안 이슈. Supabase Auth 또는 환경변수 기반 서버 사이드 검증으로 전환 필요. prompt/alert 대신 커스텀 모달 사용 권장.',
    },
  ]

  const avgFeatureScore = Math.round(featureList.reduce((s, f) => s + f.score, 0) / featureList.length)
  const criticalFeatures = featureList.filter(f => f.score < 60)
  const warningFeatures = featureList.filter(f => f.score >= 60 && f.score < 80)

  // ─── 4. Scenario 데이터 ─────────────────────────────────────────
  // ─── featureList 함수 매핑 헬퍼 ─────────────────────────────────
  // featureList의 flow 배열에서 실제 함수명을 추출하여 functions[] 빌드
  const buildFeatureFunctions = (featureName) => {
    const feat = featureList.find(f => f.name === featureName)
    if (!feat) return []
    return feat.flow
      .filter(step => functionList.some(fn => step.includes(fn.name)))
      .map(step => {
        const fn = functionList.find(f => step.includes(f.name))
        return fn ? { id: fn.name, name: `${fn.name}()`, description: fn.role, score: fn.score } : null
      })
      .filter(Boolean)
      .filter((v, i, a) => a.findIndex(x => x.id === v.id) === i) // dedup
  }

  // 공통 앱 진입 단계 (모든 시나리오 공유)
  const APP_ENTRY_FEATURES = ['앱 초기화 및 DB 로드']
  const PLANNER_ENTRY_FEATURES = ['앱 초기화 및 DB 로드']
  const UNLOCK_FEATURES = ['잠금/편집 전환']

  const scenarioList = [
    {
      id: 'S01', name: '대시보드 확인',
      purpose: '앱을 처음 실행해 DB 데이터를 로드하고, 대시보드에서 오늘의 업무 브리핑을 확인한다.',
      startScreen: '브라우저 주소 입력 (앱 최초 진입)', endScreen: 'Dashboard — 일일 브리핑 팝업 표시',
      featureFlow: ['앱 초기화 및 DB 로드', '일일 브리핑 팝업'],
      stepLabels: [
        '브라우저에서 앱 URL 진입',
        'Supabase에서 프로젝트/업무/일정 데이터 로드',
        '대시보드 화면 렌더링',
        '일일 브리핑 팝업 표시',
      ],
      successCondition: '대시보드에 프로젝트 데이터가 표시되고 일일 브리핑 팝업이 노출됨',
      failureCondition: 'Supabase 네트워크 에러 → 빈 화면, 사용자 에러 피드백 없음',
      exceptionHandling: 'console.log만 출력, UI 알림 없음',
      dangerFunctions: ['loadFromDB', 'loadHistories'],
      dangerFeatures: ['앱 초기화 및 DB 로드'],
      complexity: 5, riskLevel: '중간', score: 62,
      opinion: '로드 실패 시 사용자 피드백 전무. showToast 연결 + 재시도 버튼 추가 필요.',
    },
    {
      id: 'S02', name: '프로젝트·업무 생성',
      purpose: '앱을 실행해 플래너로 이동한 뒤, 잠금을 해제하고 새 프로젝트와 업무를 입력한다.',
      startScreen: '브라우저 진입 (앱 최초 실행)', endScreen: '플래너 — 새 프로젝트·업무 행 추가 완료',
      featureFlow: ['앱 초기화 및 DB 로드', '잠금/편집 전환', '프로젝트·업무 생성', '업무 정보 편집', '문서 URL 관리'],
      stepLabels: [
        '브라우저에서 앱 URL 진입',
        'DB 데이터 로드 완료 → 대시보드 표시',
        '"플래너" 탭 클릭',
        '"잠금상태" 버튼 클릭 → LDAP 입력 → "편집중" 전환',
        '"+ 프로젝트" 버튼 클릭 → 프로젝트명 입력',
        '"+" 버튼 클릭 → 업무명·담당자 입력',
        '링크 버튼 클릭 → 문서 URL 입력 → 저장',
      ],
      successCondition: '새 프로젝트 행 + 업무 행 생성 + localStorage 저장',
      failureCondition: '잠금 비밀번호 하드코딩 노출 시 권한 우회 가능',
      exceptionHandling: '잠금 상태 버튼 disabled. localStorage 오류 시 처리 없음',
      dangerFunctions: ['toggleScheduleLock', 'addProject', 'addTaskToProject'],
      dangerFeatures: ['잠금/편집 전환'],
      complexity: 5, riskLevel: '높음', score: 68,
      opinion: '비밀번호 하드코딩 즉시 수정 필요. DB 저장 유도 UX 안내 부재.',
    },
    {
      id: 'S03', name: '업무 일정 입력',
      purpose: '앱을 실행해 플래너로 이동한 뒤, 잠금 해제 후 날짜 셀을 드래그하여 업무 일정을 설정한다.',
      startScreen: '브라우저 진입 (앱 최초 실행)', endScreen: '플래너 — 날짜 셀 파란색으로 표시',
      featureFlow: ['앱 초기화 및 DB 로드', '잠금/편집 전환', '일정 페인팅 (날짜 드래그)', '적색 날짜 토글', '셀 메모 입력/수정/삭제'],
      stepLabels: [
        '브라우저에서 앱 URL 진입',
        'DB 데이터 로드 완료 → 대시보드 표시',
        '"플래너" 탭 클릭',
        '"잠금상태" 버튼 클릭 → LDAP 입력 → "편집중" 전환',
        '타임라인 날짜 셀 클릭/드래그 → 파란 셀 표시',
        '(선택) 날짜 셀 더블클릭 → 적색 위험 날짜 표시',
        '(선택) Shift+클릭 → 날짜 셀 메모 입력',
      ],
      successCondition: '드래그한 날짜 셀이 파란 셀로 표시되고 저장됨',
      failureCondition: '창 밖 마우스 이탈 시 isPainting stuck',
      exceptionHandling: '잠금 상태 early return. Shift+클릭 메모 잠금 중 가능한 버그 존재',
      dangerFunctions: ['toggleDate', 'paintDate', 'paintOverDate', 'updateDateMemo'],
      dangerFeatures: ['일정 페인팅 (날짜 드래그)', '셀 메모 입력/수정/삭제'],
      complexity: 6, riskLevel: '중간', score: 76,
      opinion: 'window.addEventListener("mouseup") 글로벌 등록으로 stuck 해결 가능.',
    },
    {
      id: 'S04', name: 'DB 저장 및 이력 확인',
      purpose: '앱 실행 후 데이터를 편집하고 DB에 저장한 뒤, 히스토리 탭에서 변경 이력을 확인한다.',
      startScreen: '브라우저 진입 (앱 최초 실행)', endScreen: '히스토리 탭 — 변경 이력 목록 확인',
      featureFlow: ['앱 초기화 및 DB 로드', '잠금/편집 전환', 'DB 전체 저장', '히스토리 조회 및 업무 이동', '로컬 히스토리 (Undo/Redo)'],
      stepLabels: [
        '브라우저에서 앱 URL 진입',
        'DB 데이터 로드 완료 → 대시보드 표시',
        '"플래너" 탭 클릭',
        '"잠금상태" 버튼 클릭 → LDAP 입력 → "편집중" 전환',
        '데이터 편집 (업무 추가/수정/일정 변경 등)',
        '"저장" 버튼 클릭 → 확인 팝업 → DB 저장 실행',
        '"히스토리" 탭 클릭 → 변경 이력 목록 확인',
        '이력 항목 클릭 → 플래너 해당 업무로 이동',
        '← / → 버튼으로 이전/다음 저장 상태 복원',
      ],
      successCondition: 'toast "DB 저장 완료" + 히스토리 목록 갱신',
      failureCondition: 'DELETE 후 INSERT 에러 → 데이터 일부 소실 (트랜잭션 없음)',
      exceptionHandling: 'catch → showToast("DB 저장 실패"). rollback 없음',
      dangerFunctions: ['saveAllToDB', 'saveChangeHistories'],
      dangerFeatures: ['DB 전체 저장'],
      complexity: 8, riskLevel: '높음', score: 52,
      opinion: 'delete-then-insert 최고 위험. Supabase RPC/upsert 전환 필수.',
    },
    {
      id: 'S05', name: '업무 상태 완료 처리',
      purpose: '앱을 실행한 뒤 플래너에서 업무 상태를 완료로 변경하고 대시보드에서 진도율을 확인한다.',
      startScreen: '브라우저 진입 (앱 최초 실행)', endScreen: '대시보드 — 완료율 갱신 확인',
      featureFlow: ['앱 초기화 및 DB 로드', '잠금/편집 전환', '업무 상태 변경'],
      stepLabels: [
        '브라우저에서 앱 URL 진입',
        'DB 데이터 로드 완료 → 대시보드 표시',
        '"플래너" 탭 클릭',
        '"잠금상태" 버튼 클릭 → LDAP 입력 → "편집중" 전환',
        '업무 상태 뱃지 클릭 → 대기 → 진행 → 완료 순환',
        '"대시보드" 탭 클릭 → 완료율 갱신 확인',
      ],
      successCondition: '상태 뱃지 변경 + 대시보드 완료율 즉시 반영',
      failureCondition: 'task.status(수동)와 getDisplayStatus(자동) 불일치 → 혼선',
      exceptionHandling: '잠금 상태 early return',
      dangerFunctions: ['cycleStatus', 'getDisplayStatus'],
      dangerFeatures: ['업무 상태 변경'],
      complexity: 4, riskLevel: '낮음', score: 80,
      opinion: '수동 status와 자동 계산 getDisplayStatus 이원화 해소 권장.',
    },
    {
      id: 'S06', name: '업무 삭제',
      purpose: '앱을 실행해 플래너로 이동하고 잠금을 해제한 뒤, 불필요한 업무를 삭제한다.',
      startScreen: '브라우저 진입 (앱 최초 실행)', endScreen: '플래너 — 업무 행 제거 완료',
      featureFlow: ['앱 초기화 및 DB 로드', '잠금/편집 전환', '업무 삭제'],
      stepLabels: [
        '브라우저에서 앱 URL 진입',
        'DB 데이터 로드 완료 → 대시보드 표시',
        '"플래너" 탭 클릭',
        '"잠금상태" 버튼 클릭 → LDAP 입력 → "편집중" 전환',
        '삭제할 업무 행의 "x" 버튼 클릭',
        '"삭제할까?" confirm → 확인 클릭',
        '업무 행 즉시 제거 (마지막 업무면 프로젝트도 제거)',
      ],
      successCondition: '업무 행 즉시 제거. 마지막 업무면 프로젝트도 제거',
      failureCondition: '삭제 직후 undo 불가 (로컬 히스토리는 DB 저장 시점만)',
      exceptionHandling: 'confirm 취소 시 early return',
      dangerFunctions: ['deleteTask'],
      dangerFeatures: ['업무 삭제'],
      complexity: 4, riskLevel: '낮음', score: 74,
      opinion: '마지막 업무 삭제 → 프로젝트 자동 삭제 경고 추가 필요.',
    },
    {
      id: 'S07', name: '종료임박 업무 확인',
      purpose: '앱을 실행하고 대시보드에서 종료 임박 업무를 확인한 뒤, 해당 업무 행으로 플래너에서 바로 이동한다.',
      startScreen: '브라우저 진입 (앱 최초 실행)', endScreen: '플래너 — 해당 업무 행 하이라이트',
      featureFlow: ['앱 초기화 및 DB 로드', '일일 브리핑 팝업'],
      stepLabels: [
        '브라우저에서 앱 URL 진입',
        'DB 데이터 로드 완료',
        '대시보드 표시 → 일일 브리핑 팝업 확인',
        '"종료 예정 업무" 패널에서 D-Day 업무 확인',
        '해당 업무 클릭 → 플래너로 자동 이동 + 하이라이트',
      ],
      successCondition: '종료임박 업무 클릭 → 플래너 해당 업무 하이라이트',
      failureCondition: '업무명 변경 후 히스토리 이동 시 탐색 실패',
      exceptionHandling: '이동 불가 항목 clickable 미부여',
      dangerFunctions: ['focusTask', 'focusHistory'],
      dangerFeatures: [],
      complexity: 4, riskLevel: '낮음', score: 82,
      opinion: '일일 브리핑 재표시 조건 개선. focusTask setTimeout → useLayoutEffect 전환.',
    },
    {
      id: 'S08', name: '문서 링크 등록 및 열기',
      purpose: '앱을 실행해 플래너에서 업무에 문서 URL을 등록하고 새 탭에서 바로 열어 확인한다.',
      startScreen: '브라우저 진입 (앱 최초 실행)', endScreen: '새 탭 — 문서 URL 열림',
      featureFlow: ['앱 초기화 및 DB 로드', '잠금/편집 전환', '업무 정보 편집', '문서 URL 관리'],
      stepLabels: [
        '브라우저에서 앱 URL 진입',
        'DB 데이터 로드 완료 → 대시보드 표시',
        '"플래너" 탭 클릭',
        '"잠금상태" 버튼 클릭 → LDAP 입력 → "편집중" 전환',
        '업무 행의 링크(🔗) 버튼 클릭',
        'URL 모달에서 https:// 주소 입력',
        '"저장" 클릭 → 링크 버튼 아이콘 변경',
        '링크 버튼 → ↗ 클릭 → 새 탭에서 문서 열림',
      ],
      successCondition: '저장 후 링크 버튼 아이콘 변경 + URL 새 탭 열림',
      failureCondition: 'URL 유효성 검증 없음. backdrop 클릭 시 변경 유실',
      exceptionHandling: '빈 URL 필터링(trim)',
      dangerFunctions: ['updateTaskFields'],
      dangerFeatures: ['문서 URL 관리'],
      complexity: 4, riskLevel: '낮음', score: 80,
      opinion: 'URL 형식 검증 추가. backdrop 클릭 경고 필요.',
    },
    {
      id: 'S09', name: '업무·프로젝트 순서 변경',
      purpose: '앱을 실행한 뒤 플래너에서 잠금을 해제하고 Shift+드래그로 업무·프로젝트 순서를 변경한다.',
      startScreen: '브라우저 진입 (앱 최초 실행)', endScreen: '플래너 — 순서 변경 완료',
      featureFlow: ['앱 초기화 및 DB 로드', '잠금/편집 전환', '프로젝트/업무 순서 변경'],
      stepLabels: [
        '브라우저에서 앱 URL 진입',
        'DB 데이터 로드 완료 → 대시보드 표시',
        '"플래너" 탭 클릭',
        '"잠금상태" 버튼 클릭 → LDAP 입력 → "편집중" 전환',
        'Shift 키를 누른 채로 업무/프로젝트 행에 마우스다운',
        '원하는 위치로 드래그 → 마우스업',
        '순서 변경 완료 확인',
      ],
      successCondition: '드래그 후 순서가 변경됨',
      failureCondition: '프로젝트 간 업무 이동 불가 (조용히 무시). 창 밖 이탈 시 stuck',
      exceptionHandling: 'fromId===toId early return',
      dangerFunctions: ['reorderProject', 'reorderTask'],
      dangerFeatures: ['프로젝트/업무 순서 변경'],
      complexity: 4, riskLevel: '낮음', score: 80,
      opinion: '프로젝트 간 업무 이동 미지원 안내 추가.',
    },
    {
      id: 'S10', name: 'Undo — 이전 상태 복원',
      purpose: '앱을 실행해 편집한 뒤 DB 저장을 완료하고, 실수 시 ← 버튼으로 이전 저장 상태로 되돌린다.',
      startScreen: '브라우저 진입 (앱 최초 실행)', endScreen: '플래너 — 이전 저장 상태 복원 완료',
      featureFlow: ['앱 초기화 및 DB 로드', '잠금/편집 전환', 'DB 전체 저장', '로컬 히스토리 (Undo/Redo)'],
      stepLabels: [
        '브라우저에서 앱 URL 진입',
        'DB 데이터 로드 완료',
        '"플래너" 탭 클릭',
        '"잠금상태" 버튼 클릭 → LDAP 입력 → "편집중" 전환',
        '데이터 편집',
        '"저장" 버튼 클릭 → DB 저장 완료 (스냅샷 생성)',
        '추가 편집 (실수 상황 가정)',
        '"←" 버튼 클릭 → 이전 스냅샷으로 복원',
        '"이전 상태로 이동했습니다" toast 표시',
      ],
      successCondition: 'toast "이전 상태로 이동했습니다" + 플래너 복원',
      failureCondition: '스냅샷 3개 초과 시 오래된 이력 소멸. applySnapshot 후 loadedProjects 비갱신',
      exceptionHandling: 'nextIndex 범위 체크',
      dangerFunctions: ['moveLocalHistory', 'applySnapshot'],
      dangerFeatures: ['로컬 히스토리 (Undo/Redo)'],
      complexity: 5, riskLevel: '중간', score: 74,
      opinion: 'applySnapshot 후 loadedProjects 동기화 필요.',
    },
  ]

  // ─── 시나리오에 featureFlowObj + paths 자동 생성 ─────────────────
  const enrichedScenarios = useMemo(() => scenarioList.map(sc => ({
    ...sc,
    // 기능 객체 배열 (featureName → { featureId, featureName, functions[] })
    featureFlowObj: sc.featureFlow.map((fname, fi) => ({
      featureId: fname,
      featureName: fname,
      functions: buildFeatureFunctions(fname),
    })),
    // 기본 경로: featureFlow 전체 함수 순서대로
    paths: sc.paths || [{
      id: `${sc.id}-default`,
      name: '기본 흐름 경로',
      functionIds: sc.featureFlow.flatMap(fname => buildFeatureFunctions(fname).map(f => f.id)),
    }],
  })), [scenarioList, featureList, functionList]) // eslint-disable-line

  const avgScenarioScore = Math.round(scenarioList.reduce((s, sc) => s + sc.score, 0) / scenarioList.length)
  const highRiskScenarios = scenarioList.filter(sc => sc.riskLevel === '높음')
  const midRiskScenarios  = scenarioList.filter(sc => sc.riskLevel === '중간')
  const overallScore = Math.round((avgScore + avgFeatureScore + avgScenarioScore) / 3)

  const [tab, setTab] = useState('functions')
  const [graphOpen, setGraphOpen] = useState(true)
  const [highlightNode, setHighlightNode] = useState(null)
  const [highlightFeature, setHighlightFeature] = useState(null)
  const [highlightScenario, setHighlightScenario] = useState(null)
  // graph ↔ table 양방향 선택 연동
  const [activeNodeId, setActiveNodeId] = useState(null)
  const [activeFeatureId, setActiveFeatureId] = useState(null)
  const [activeScenarioId, setActiveScenarioId] = useState(null)
  const [expandedScenario, setExpandedScenario] = useState(null)
  // 시나리오 탭 상태
  const [expandedFeatureIds, setExpandedFeatureIds] = useState(new Set())
  const [currentPathIndex,    setCurrentPathIndex]   = useState(0)
  const [currentEdgeStepIndex, setCurrentEdgeStepIndex] = useState(0)  // 엣지 단위 (그래프 전용)

  // ─── 6. ID 계산 헬퍼 ─────────────────────────────────────────────
  const fnIdOf   = name => { const i = functionList.findIndex(f => f.name === name); return i >= 0 ? `FN-${String(i+1).padStart(3,'0')}` : '' }
  const featIdOf = name => { const i = featureList.findIndex(f => f.name === name);  return i >= 0 ? `F-${101+i}` : '' }

  // ─── 7. Global Search state ────────────────────────────────────
  const [globalSearch, setGlobalSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)

  const globalSearchResults = useMemo(() => {
    const q = globalSearch.toLowerCase().trim()
    if (!q) return []
    const results = []
    functionList.forEach((f, i) => {
      const id = `FN-${String(i+1).padStart(3,'0')}`
      if (f.name.toLowerCase().includes(q) || id.toLowerCase().includes(q) || f.file?.toLowerCase().includes(q)) {
        results.push({ type:'function', id, name:f.name, score:f.score, file:f.file })
      }
    })
    featureList.forEach((f, i) => {
      const id = `F-${101+i}`
      if (f.name.toLowerCase().includes(q) || id.toLowerCase().includes(q)) {
        results.push({ type:'feature', id, name:f.name, score:f.score })
      }
    })
    scenarioList.forEach(sc => {
      if (sc.name.toLowerCase().includes(q) || sc.id.toLowerCase().includes(q)) {
        results.push({ type:'scenario', id:sc.id, name:sc.name, score:sc.score })
      }
    })
    return results.slice(0, 12)
  }, [globalSearch, functionList, featureList, scenarioList])

  const handleSearchSelect = item => {
    setGlobalSearch(''); setSearchOpen(false)
    if (item.type === 'function') {
      setHighlightNode(item.name); setHighlightFeature(null); setHighlightScenario(null)
      setActiveNodeId(item.name); setActiveFeatureId(null); setActiveScenarioId(null)
      setTab('functions'); setGraphOpen(true)
    } else if (item.type === 'feature') {
      setHighlightFeature(item.name); setHighlightNode(null); setHighlightScenario(null)
      setActiveFeatureId(item.name); setActiveNodeId(null); setActiveScenarioId(null)
      setTab('feature'); setGraphOpen(true)
    } else {
      const sc = scenarioList.find(s => s.id === item.id)
      if (sc) { setHighlightScenario(sc.featureFlow); setHighlightNode(null); setHighlightFeature(null) }
      setActiveScenarioId(item.id); setActiveNodeId(null); setActiveFeatureId(null)
      setTab('scenario'); setGraphOpen(true)
    }
  }

  const handleGraphNodeSelect = name => {
    setActiveNodeId(name); setActiveFeatureId(null)
  }
  const handleGraphFeatureSelect = name => {
    setActiveFeatureId(name); setActiveNodeId(null)
  }

  // ─── 엣지 단계 애니메이션 (그래프 전용, 하단 UI와 완전 분리) ──────
  useEffect(() => {
    if (!activeScenarioId) return
    const sc = enrichedScenarios.find(s => s.id === activeScenarioId)
    if (!sc) return
    const path = sc.paths?.[currentPathIndex]
    if (!path?.functionIds?.length) return

    const lastEdgeIdx = path.functionIds.length - 2   // 엣지 수 = 노드 수 - 1
    const isLast = currentEdgeStepIndex >= lastEdgeIdx
    const delay  = isLast ? 1000 : 800

    const timer = setTimeout(() => {
      if (isLast) {
        setCurrentEdgeStepIndex(0)
        setCurrentPathIndex(prev => (prev + 1) % (sc.paths.length || 1))
      } else {
        setCurrentEdgeStepIndex(prev => prev + 1)
      }
    }, delay)

    return () => clearTimeout(timer)
  }, [activeScenarioId, currentPathIndex, currentEdgeStepIndex, enrichedScenarios])

  // 시나리오 변경 시 엣지 애니메이션 리셋
  useEffect(() => {
    setCurrentPathIndex(0); setCurrentEdgeStepIndex(0)
    setExpandedFeatureIds(new Set())
  }, [activeScenarioId])

  // ─── Breadcrumb 계산 ─────────────────────────────────────────────
  const breadcrumb = (() => {
    const crumbs = []
    if (activeScenarioId) {
      const sc = scenarioList.find(s => s.id === activeScenarioId)
      crumbs.push({ type:'scenario', id: activeScenarioId, name: sc?.name || activeScenarioId })
    }
    if (activeFeatureId) {
      const featIdx = featureList.findIndex(f => f.name === activeFeatureId)
      const fid = featIdx >= 0 ? `F-${101+featIdx}` : ''
      crumbs.push({ type:'feature', id: fid, name: activeFeatureId })
    }
    if (activeNodeId) {
      crumbs.push({ type:'function', id: fnIdOf(activeNodeId), name: activeNodeId })
    }
    return crumbs
  })()

  return (
    <div className="integrity-page">

      {/* ─── 3D Integrity Graph ─────────────────────────────── */}
      <div className="integrity-graph-section">
        <div className="integrity-graph-header">
          <div className="integrity-graph-header-left">
            <span className="integrity-graph-title">Integrity Graph</span>
            <span className="integrity-graph-sub">
              FN ×{functionList.length} · F ×{featureList.length} · SC ×{scenarioList.length}
            </span>
          </div>

          {/* Global Search */}
          <div className="ig-search-wrap">
            <input
              className="ig-global-search"
              placeholder="검색: 함수명 / ID / Feature / Scenario..."
              value={globalSearch}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 180)}
              onChange={e => { setGlobalSearch(e.target.value); setSearchOpen(true) }}
            />
            {searchOpen && globalSearchResults.length > 0 && (
              <div className="ig-search-dropdown">
                {globalSearchResults.map(r => (
                  <div key={`${r.type}-${r.id}`} className="ig-search-item" onMouseDown={() => handleSearchSelect(r)}>
                    <span className={['ig-sr-type', `ig-sr-${r.type}`].join(' ')}>{r.type === 'function' ? 'FN' : r.type === 'feature' ? 'F' : 'SC'}</span>
                    <span className="ig-sr-id">{r.id}</span>
                    <span className="ig-sr-name">{r.name}</span>
                    <span className="ig-sr-score" style={{ color: r.score>=80?'#22c55e':r.score>=60?'#eab308':'#ef4444' }}>{r.score}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            className="integrity-graph-toggle"
            onClick={() => setGraphOpen(v => !v)}
          >
            {graphOpen ? '▲' : '▼'}
          </button>
        </div>
        {graphOpen && (() => {
          // 엣지 애니메이션: active source → target 두 값만 전달
          const animSc   = enrichedScenarios.find(s => s.id === activeScenarioId)
          const animPath = animSc?.paths?.[currentPathIndex]
          const animSrc  = animPath?.functionIds?.[currentEdgeStepIndex] ?? null
          const animTgt  = animPath?.functionIds?.[currentEdgeStepIndex + 1] ?? null

          return (
          <IntegrityGraph
            functionList={functionList}
            featureList={featureList}
            scenarioList={scenarioList}
            highlightNodeName={highlightNode}
            highlightFeatureName={highlightFeature}
            highlightScenarioFeatures={highlightScenario}
            onNodeSelect={handleGraphNodeSelect}
            onFeatureSelect={handleGraphFeatureSelect}
            animSourceFnId={animSrc}
            animTargetFnId={animTgt}
          />
          )
        })()}
      </div>

      {/* ─── Breadcrumb ────────────────────────────────────────── */}
      {breadcrumb.length > 0 && (
        <div className="integrity-breadcrumb">
          <span className="ibc-label">탐색 경로</span>
          {breadcrumb.map((crumb, i) => (
            <span key={i} className="ibc-crumb-group">
              {i > 0 && <span className="ibc-sep">›</span>}
              <span className={`ibc-type ibc-${crumb.type}`}>{crumb.type === 'function' ? 'FN' : crumb.type === 'feature' ? 'FEAT' : 'SC'}</span>
              {crumb.id && <code className="ibc-id">{crumb.id}</code>}
              <span
                className="ibc-name"
                onClick={() => {
                  if (crumb.type === 'function') { setTab('functions') }
                  else if (crumb.type === 'feature') { setTab('feature') }
                  else { setTab('scenario') }
                }}
              >{crumb.name}</span>
            </span>
          ))}
          <button className="ibc-clear" onClick={() => {
            setActiveNodeId(null); setActiveFeatureId(null); setActiveScenarioId(null)
            setHighlightNode(null); setHighlightFeature(null); setHighlightScenario(null)
          }}>✕ 초기화</button>
        </div>
      )}

      {/* ─── Horizontal Function Flow ─────────────────────────── */}
      {(activeFeatureId || activeScenarioId) && (() => {
        let flowItems = []
        let flowTitle = ''
        if (activeFeatureId) {
          const feat = featureList.find(f => f.name === activeFeatureId)
          if (feat) { flowItems = feat.flow; flowTitle = `${featIdOf(activeFeatureId)} ${activeFeatureId}` }
        } else if (activeScenarioId) {
          const sc = scenarioList.find(s => s.id === activeScenarioId)
          if (sc) { flowItems = sc.featureFlow; flowTitle = `${activeScenarioId} ${sc.name}` }
        }
        if (!flowItems.length) return null
        const isScenarioFlow = !!activeScenarioId && !activeFeatureId
        return (
          <div className="integrity-flow-bar">
            <div className="ifb-title">
              <span className={`ifb-badge ${isScenarioFlow ? 'ifb-sc' : 'ifb-feat'}`}>{isScenarioFlow ? 'SCENARIO FLOW' : 'FUNCTION FLOW'}</span>
              <span className="ifb-name">{flowTitle}</span>
            </div>
            <div className="ifb-scroll">
              {flowItems.map((item, i) => {
                const isFeature = isScenarioFlow
                const nodeId = isFeature ? featIdOf(item) : fnIdOf(item)
                const fnData = !isFeature ? functionList.find(f => f.name === item) : null
                const featData = isFeature ? featureList.find(f => f.name === item) : null
                const score = fnData?.score ?? featData?.score ?? null
                const isActive = isFeature ? activeFeatureId === item : activeNodeId === item
                return (
                  <div key={i} className="ifb-step">
                    {i > 0 && <div className="ifb-arrow">→</div>}
                    <div
                      className={['ifb-box', isActive ? 'ifb-box-active' : '', score !== null && score < 60 ? 'ifb-box-danger' : ''].join(' ')}
                      onClick={() => {
                        if (isFeature) {
                          setActiveFeatureId(item); setHighlightFeature(item)
                          setHighlightNode(null); setHighlightScenario(null)
                          setTab('feature'); setGraphOpen(true)
                        } else {
                          setActiveNodeId(item); setHighlightNode(item)
                          setHighlightFeature(null); setHighlightScenario(null)
                          setTab('functions'); setGraphOpen(true)
                        }
                      }}
                    >
                      {nodeId && <div className="ifb-id">{nodeId}</div>}
                      <div className="ifb-fn-name">{item}</div>
                      {score !== null && (
                        <div className="ifb-score" style={{ color: score>=80?'#22c55e':score>=60?'#eab308':'#ef4444' }}>{score}</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      <div className="integrity-tabs">
        <button className={tab === 'functions' ? 'active' : ''} onClick={() => setTab('functions')}>
          <span className="tab-level">L1</span> 함수 무결성
        </button>
        <button className={tab === 'feature' ? 'active' : ''} onClick={() => setTab('feature')}>
          <span className="tab-level">L2</span> 기능 무결성
        </button>
        <button className={tab === 'scenario' ? 'active' : ''} onClick={() => setTab('scenario')}>
          <span className="tab-level">L3</span> 시나리오 무결성
        </button>
        <button className={tab === 'summary' ? 'active' : ''} onClick={() => setTab('summary')}>
          <span className="tab-level">L4</span> 종합 요약
        </button>
      </div>

      {tab === 'functions' && (
        <div className="integrity-section">
          <div className="integrity-score-header">
            <div className="integrity-score-box">
              <span>평균 무결성 점수</span>
              <strong className={avgScore >= 80 ? 'score-high' : avgScore >= 60 ? 'score-mid' : 'score-low'}>
                {avgScore}점
              </strong>
            </div>
            <div className="integrity-score-box">
              <span>리팩토링 필요</span>
              <strong className="score-mid">{refactorNeeded.length}개</strong>
            </div>
            <div className="integrity-score-box">
              <span>SRP 과부하</span>
              <strong className="score-low">{overSrp.length}개</strong>
            </div>
            <div className="integrity-score-box">
              <span>코드 중복 위험</span>
              <strong className="score-mid">{dupList.length}개</strong>
            </div>
          </div>

          <div className="integrity-table-wrap">
            <table className="integrity-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>함수명</th>
                  <th>파일</th>
                  <th>호출횟수</th>
                  <th>호출하는 함수</th>
                  <th>호출되는 함수</th>
                  <th>역할</th>
                  <th>중복위험</th>
                  <th>Dead</th>
                  <th>Unused</th>
                  <th>SRP</th>
                  <th>리팩토링</th>
                  <th>점수</th>
                  <th>개선 의견</th>
                </tr>
              </thead>
              <tbody>
                {functionList.map((f, fi) => (
                  <tr
                    key={f.name}
                    className={[f.refactor ? 'row-warn' : '', 'row-clickable', activeNodeId === f.name ? 'row-active' : ''].join(' ')}
                    onClick={() => {
                      setHighlightNode(f.name)
                      setHighlightFeature(null)
                      setActiveNodeId(f.name)
                      setActiveFeatureId(null)
                      setGraphOpen(true)
                      document.querySelector('.integrity-page')?.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    title={`그래프에서 ${f.name} 보기`}
                  >
                    <td><code className="fn-id-badge">FN-{String(fi+1).padStart(3,'0')}</code></td>
                    <td><code>{f.name}</code></td>
                    <td>{f.file}</td>
                    <td>{f.calls}</td>
                    <td>{f.calledBy.join(', ')}</td>
                    <td>—</td>
                    <td>{f.role}</td>
                    <td className={f.dupRisk === '높음' ? 'badge-red' : f.dupRisk === '중간' ? 'badge-orange' : ''}>{f.dupRisk}</td>
                    <td>{f.deadCode ? '✓' : '—'}</td>
                    <td>{f.unused ? '✓' : '—'}</td>
                    <td className={f.srp === '과부하' ? 'badge-red' : f.srp === '약간 과부하' ? 'badge-orange' : ''}>{f.srp}</td>
                    <td>{f.refactor ? '✓' : '—'}</td>
                    <td className={f.score >= 80 ? 'score-high' : f.score >= 60 ? 'score-mid' : 'score-low'}>{f.score}</td>
                    <td className="opinion-cell">{f.opinion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="integrity-bottom">
            <div className="integrity-list-section">
              <h4>리팩토링 우선순위</h4>
              <ol>
                {[...refactorNeeded].sort((a, b) => a.score - b.score).map(f => (
                  <li key={f.name}><code>{f.name}</code> — {f.score}점 — {f.opinion}</li>
                ))}
              </ol>
            </div>
            <div className="integrity-list-section">
              <h4>코드 중복 함수 목록</h4>
              {dupList.length === 0 ? <p>없음</p> : <ul>{dupList.map(f => <li key={f.name}><code>{f.name}</code></li>)}</ul>}
              <h4 style={{ marginTop: '16px' }}>Dead Code 목록</h4>
              {deadList.length === 0 ? <p>없음</p> : <ul>{deadList.map(f => <li key={f.name}><code>{f.name}</code></li>)}</ul>}
              <h4 style={{ marginTop: '16px' }}>Unused Code 목록</h4>
              {unusedList.length === 0 ? <p>없음</p> : <ul>{unusedList.map(f => <li key={f.name}><code>{f.name}</code></li>)}</ul>}
            </div>
          </div>
        </div>
      )}

      {tab === 'feature' && (
        <div className="integrity-section">
          <div className="integrity-score-header">
            <div className="integrity-score-box">
              <span>분석 기능 수</span>
              <strong>{featureList.length}개</strong>
            </div>
            <div className="integrity-score-box">
              <span>평균 무결성 점수</span>
              <strong className={avgFeatureScore >= 80 ? 'score-high' : avgFeatureScore >= 60 ? 'score-mid' : 'score-low'}>{avgFeatureScore}점</strong>
            </div>
            <div className="integrity-score-box">
              <span>위험 기능 (60점 미만)</span>
              <strong className="score-low">{criticalFeatures.length}개</strong>
            </div>
            <div className="integrity-score-box">
              <span>주의 기능 (60~79점)</span>
              <strong className="score-mid">{warningFeatures.length}개</strong>
            </div>
          </div>

          <div className="feature-list">
            {featureList.map((f, fi) => (
              <div
                key={f.name}
                className={['feature-card', f.score < 60 ? 'feature-critical' : f.score < 80 ? 'feature-warning' : '', 'row-clickable', activeFeatureId === f.name ? 'feature-active' : ''].join(' ')}
                onClick={() => {
                  setHighlightFeature(f.name)
                  setHighlightNode(null)
                  setActiveFeatureId(f.name)
                  setActiveNodeId(null)
                  setActiveScenarioId(null)
                  setGraphOpen(true)
                  document.querySelector('.integrity-page')?.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                title={`그래프에서 ${f.name} Feature 보기`}
              >
                <div className="feature-card-head">
                  <code className="feat-id-badge">F-{101+fi}</code>
                  <span className="feature-name">{f.name}</span>
                  <span className={['feature-score', f.score >= 80 ? 'score-high' : f.score >= 60 ? 'score-mid' : 'score-low'].join(' ')}>{f.score}점</span>
                </div>

                <div className="feature-body">
                  <div className="feature-row">
                    <dt>기능 목적</dt>
                    <dd>{f.purpose}</dd>
                  </div>
                  <div className="feature-row">
                    <dt>시작 UI / 이벤트</dt>
                    <dd>{f.trigger}</dd>
                  </div>
                  <div className="feature-row">
                    <dt>함수 호출 순서</dt>
                    <dd>
                      <div className="feature-flow">
                        {f.flow.map((step, i) => (
                          <span key={i} className="flow-step">
                            {i > 0 && <span className="flow-arrow">↓</span>}
                            <code>{step}</code>
                          </span>
                        ))}
                      </div>
                    </dd>
                  </div>
                  <div className="feature-row">
                    <dt>관련 상태값</dt>
                    <dd>{f.states.length > 0 ? f.states.map(s => <code key={s} className="state-tag">{s}</code>) : '—'}</dd>
                  </div>
                  <div className="feature-row">
                    <dt>관련 DB 테이블</dt>
                    <dd>{f.tables.length > 0 ? f.tables.map(t => <code key={t} className="table-tag">{t}</code>) : '—'}</dd>
                  </div>
                  <div className="feature-row">
                    <dt>정상 완료 조건</dt>
                    <dd>{f.successCondition}</dd>
                  </div>
                  <div className="feature-row">
                    <dt>조건 분기</dt>
                    <dd>
                      <ul className="feature-ul">
                        {f.branches.map((b, i) => <li key={i}>{b}</li>)}
                      </ul>
                    </dd>
                  </div>
                  <div className="feature-row">
                    <dt>예외 / 실패 케이스</dt>
                    <dd>
                      <ul className="feature-ul warn">
                        {f.failures.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </dd>
                  </div>
                  <div className="feature-row">
                    <dt>개선 의견</dt>
                    <dd className="feature-opinion">{f.opinion}</dd>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'scenario' && (() => {
        // 하단 UI는 완전 정적 — step 상태와 연결 안 함
        const activeSc  = enrichedScenarios.find(s => s.id === activeScenarioId)

        return (
        <div className="integrity-section sc2-layout">

          {/* ─── 왼쪽: 시나리오 목록 ──────────────────── */}
          <div className="sc2-list">
            <div className="sc2-list-header">
              <span className="sc2-list-title">SCENARIOS <span className="gsp-count">{scenarioList.length}</span></span>
              <span className={['sc2-avg', avgScenarioScore>=80?'score-high':avgScenarioScore>=60?'score-mid':'score-low'].join(' ')}>
                AVG {avgScenarioScore}
              </span>
            </div>

            <div className="sc2-items">
              {enrichedScenarios.map(sc => {
                const isActive = activeScenarioId === sc.id
                return (
                  <div key={sc.id}
                    className={['sc2-item', isActive?'sc2-item-active':'',
                      sc.riskLevel==='높음'?'sc2-item-high':sc.riskLevel==='중간'?'sc2-item-mid':''].join(' ')}
                    onClick={() => {
                      const next = isActive ? null : sc.id
                      setActiveScenarioId(next)
                      setExpandedScenario(next)
                      setPathAnimRunning(!!next)
                      if (next) {
                        setHighlightScenario(sc.featureFlow)
                        setHighlightNode(null); setHighlightFeature(null)
                        setActiveNodeId(null); setActiveFeatureId(null)
                        setGraphOpen(true)
                        document.querySelector('.integrity-page')?.scrollTo({ top:0, behavior:'smooth' })
                      } else {
                        setHighlightScenario(null)
                      }
                    }}
                  >
                    <div className="sc2-item-head">
                      <code className="sc2-id">{sc.id}</code>
                      <span className={['sc2-risk', sc.riskLevel==='높음'?'risk-high':sc.riskLevel==='중간'?'risk-mid':'risk-low'].join(' ')}>{sc.riskLevel}</span>
                      <span className="sc2-name">{sc.name}</span>
                      <span className={['sc2-score', sc.score>=80?'score-high':sc.score>=60?'score-mid':'score-low'].join(' ')}>{sc.score}</span>
                    </div>
                    {isActive && (
                      <div className="sc2-item-meta">
                        <span className="sc2-meta-row">{sc.startScreen} → {sc.endScreen}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ─── 오른쪽: Feature Flow + 경로 애니메이션 ─ */}
          <div className="sc2-detail">
            {!activeSc ? (
              <div className="sc2-empty">시나리오를 선택하면 전체 흐름이 표시됩니다.</div>
            ) : (<>
              {/* 시나리오 개요 */}
              <div className="sc2-overview">
                <div className="sc2-ov-title">
                  <code>{activeSc.id}</code>
                  <strong>{activeSc.name}</strong>
                  <span className={['sc2-score', activeSc.score>=80?'score-high':activeSc.score>=60?'score-mid':'score-low'].join(' ')}>{activeSc.score}점</span>
                </div>
                <div className="sc2-ov-row">
                  <span className="sc2-ov-label">목적</span>
                  <span>{activeSc.purpose}</span>
                </div>
                <div className="sc2-ov-screens">
                  <span className="sc2-screen-badge sc2-start">{activeSc.startScreen}</span>
                  <span className="sc2-screen-arrow">→→→</span>
                  <span className="sc2-screen-badge sc2-end">{activeSc.endScreen}</span>
                </div>

                {/* 단계별 사용자 흐름 — 정적 설명 */}
                {activeSc.stepLabels?.length > 0 && (
                  <div className="sc2-steps">
                    <div className="sc2-ov-label" style={{ marginBottom:6 }}>사용자 흐름</div>
                    {activeSc.stepLabels.map((label, si) => (
                      <div key={si} className="sc2-step-row">
                        <span className="sc2-step-num">{si + 1}</span>
                        <span className="sc2-step-label">{label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Feature Flow (accordion) — 정적 */}
              <div className="sc2-flow-title">
                <span>Feature Flow</span>
                <span className="sc2-flow-count">{activeSc.featureFlowObj.length}개 기능</span>
              </div>
              <div className="sc2-feature-flow">
                {activeSc.featureFlowObj.map((fobj, fi) => {
                  const feat      = featureList.find(f => f.name === fobj.featureName)
                  const score     = feat?.score ?? null
                  const isOpen    = expandedFeatureIds.has(fobj.featureId)
                  const isFeatAct = activeFeatureId === fobj.featureName
                  const isDanger  = activeSc.dangerFeatures?.includes(fobj.featureName)

                  return (
                    <div key={fobj.featureId} className={['sc2-feat-item',
                      isDanger ? 'sc2-feat-danger' : '',
                      isFeatAct ? 'sc2-feat-selected' : '',
                    ].join(' ')}>
                      {fi > 0 && <div className="sc2-feat-arrow">↓</div>}

                      {/* Feature 헤더 */}
                      <div className="sc2-feat-head"
                        onClick={() => {
                          const next = new Set(expandedFeatureIds)
                          next.has(fobj.featureId) ? next.delete(fobj.featureId) : next.add(fobj.featureId)
                          setExpandedFeatureIds(next)
                          const fname = fobj.featureName
                          setHighlightFeature(fname); setHighlightNode(null)
                          setActiveFeatureId(fname); setActiveNodeId(null)
                          setGraphOpen(true)
                          document.querySelector('.integrity-page')?.scrollTo({ top:0, behavior:'smooth' })
                        }}
                      >
                        <span className="sc2-feat-arrow-icon">{isOpen ? '▾' : '▸'}</span>
                        <span className="sc2-feat-dot" style={{ background: score>=80?'#22c55e':score>=60?'#eab308':'#ef4444' }}/>
                        <span className="sc2-feat-name">{fobj.featureName}</span>
                        <span className="sc2-feat-fn-count">{fobj.functions.length}개</span>
                        {score !== null && <span className={['sc2-feat-score', score>=80?'score-high':score>=60?'score-mid':'score-low'].join(' ')}>{score}</span>}
                        {isDanger && <span className="sc2-danger-badge">⚠ 위험</span>}
                      </div>

                      {/* 함수 목록 — 정적 */}
                      {isOpen && (
                        <div className="sc2-fn-list">
                          {fobj.functions.map(fn => (
                            <div key={fn.id} className="sc2-fn-item"
                              onClick={e => {
                                e.stopPropagation()
                                setHighlightNode(fn.id); setHighlightFeature(null)
                                setActiveNodeId(fn.id); setActiveFeatureId(null)
                                setGraphOpen(true)
                                document.querySelector('.integrity-page')?.scrollTo({ top:0, behavior:'smooth' })
                              }}
                            >
                              <span className="sc2-fn-status">·</span>
                              <code className="sc2-fn-name">{fn.name}</code>
                              <span className="sc2-fn-desc">{fn.description}</span>
                              <span className={['sc2-fn-score', fn.score>=80?'score-high':fn.score>=60?'score-mid':'score-low'].join(' ')}>{fn.score}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* 위험 함수 요약 — 정적 */}
              <div className="sc2-danger-section">
                <div className="scd-section-title">위험 함수</div>
                <div className="scenario-danger-fns">
                  {activeSc.dangerFunctions.map(fn => {
                    const fnData = functionList.find(f => f.name === fn)
                    return (
                      <div key={fn}
                        className={['sdanger-fn', activeNodeId===fn?'sdanger-fn-active':''].join(' ')}
                        onClick={() => {
                          setHighlightNode(fn); setHighlightFeature(null)
                          setActiveNodeId(fn); setActiveFeatureId(null)
                          setGraphOpen(true)
                          document.querySelector('.integrity-page')?.scrollTo({ top:0, behavior:'smooth' })
                        }}
                      >
                        <span className="sdanger-dot" style={{ background: fnData?(fnData.score>=80?'#22c55e':fnData.score>=60?'#eab308':'#ef4444'):'#ef4444' }}/>
                        <code>{fn}</code>
                        {fnData && <span className="sdanger-score" style={{ color: fnData.score>=80?'#22c55e':fnData.score>=60?'#eab308':'#ef4444' }}>{fnData.score}점</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>)}
          </div>

        </div>
        )
      })()}

      {tab === 'summary' && (
        <div className="integrity-section integrity-summary">

          {/* Project Health Scores */}
          <div className="summary-health-header">
            <h3>Project Health</h3>
            <div className="summary-health-grid">
              {[
                { label: 'L1 Function Integrity', score: avgScore, desc: `${functionList.length}개 함수 분석` },
                { label: 'L2 Feature Integrity',  score: avgFeatureScore, desc: `${featureList.length}개 기능 분석` },
                { label: 'L3 Scenario Integrity', score: avgScenarioScore, desc: `${scenarioList.length}개 시나리오 분석` },
                { label: 'Overall',               score: overallScore, desc: '3단계 종합', overall: true },
              ].map(item => (
                <div key={item.label} className={['health-score-card', item.overall ? 'health-overall' : ''].join(' ')}>
                  <div className="health-label">{item.label}</div>
                  <div className={['health-score', item.score >= 80 ? 'score-high' : item.score >= 60 ? 'score-mid' : 'score-low'].join(' ')}>
                    {item.score} <span className="health-denom">/ 100</span>
                  </div>
                  <div className="health-bar">
                    <div className="health-bar-fill" style={{
                      width: `${item.score}%`,
                      background: item.score >= 80 ? '#22c55e' : item.score >= 60 ? '#eab308' : '#ef4444',
                    }} />
                  </div>
                  <div className="health-desc">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Risk Summary */}
          <div className="summary-risk-section">
            <h3>Risk Summary</h3>
            <div className="risk-list">

              {/* P1: 고위험 시나리오 */}
              {scenarioList.filter(sc => sc.riskLevel === '높음').map(sc => (
                <div key={sc.id} className="risk-item risk-p1">
                  <div className="risk-priority">P1</div>
                  <div className="risk-body">
                    <div className="risk-scenario-name">시나리오: {sc.name}</div>
                    <div className="risk-flow">
                      {sc.featureFlow.slice(0, 4).map((f, i) => <span key={i}>{i>0?' → ':''}{f}</span>)}
                    </div>
                    <div className="risk-fail">{sc.failureCondition}</div>
                    <div className="risk-fns">
                      {sc.dangerFunctions.map(fn => {
                        const fd = functionList.find(f => f.name === fn)
                        return <code key={fn} className={fd && fd.score < 60 ? 'risk-fn-danger' : 'risk-fn'}>{fn}(){fd ? ` ${fd.score}점` : ''}</code>
                      })}
                    </div>
                  </div>
                  <div className="risk-score score-low">{sc.score}점</div>
                </div>
              ))}

              {/* P2: 중위험 시나리오 */}
              {scenarioList.filter(sc => sc.riskLevel === '중간').map(sc => (
                <div key={sc.id} className="risk-item risk-p2">
                  <div className="risk-priority">P2</div>
                  <div className="risk-body">
                    <div className="risk-scenario-name">시나리오: {sc.name}</div>
                    <div className="risk-flow">
                      {sc.featureFlow.slice(0, 4).map((f, i) => <span key={i}>{i>0?' → ':''}{f}</span>)}
                    </div>
                    <div className="risk-fail">{sc.failureCondition}</div>
                  </div>
                  <div className="risk-score score-mid">{sc.score}점</div>
                </div>
              ))}

              {/* P3: Dead/Refactor 함수 */}
              {functionList.filter(f => f.refactor && f.score < 65).map(f => (
                <div key={f.name} className="risk-item risk-p3">
                  <div className="risk-priority">P3</div>
                  <div className="risk-body">
                    <div className="risk-scenario-name">
                      {f.deadCode ? 'Dead Code' : f.unused ? 'Unused' : '리팩토링 필요'}: <code>{f.name}</code>
                    </div>
                    <div className="risk-fail">{f.opinion}</div>
                  </div>
                  <div className="risk-score score-mid">{f.score}점</div>
                </div>
              ))}
            </div>
          </div>

          {/* 액션 아이템 */}
          <div className="summary-actions">
            <h4>우선순위 액션 아이템</h4>
            <ol>
              <li><strong>[P1 보안]</strong> toggleScheduleLock 비밀번호 하드코딩 제거 → Supabase Auth 도입</li>
              <li><strong>[P1 안전성]</strong> saveAllToDB delete-then-insert → upsert/RPC 패턴 전환</li>
              <li><strong>[P2 구조]</strong> App.jsx → useProjects / usePainting / useHistory 커스텀 훅 분리</li>
              <li><strong>[P2 구조]</strong> PlannerPage / DashboardPage / HistoryPage 별도 컴포넌트 추출</li>
              <li><strong>[P3 중복]</strong> scrollToToday + scrollToCurrentMonth 유틸 통합</li>
              <li><strong>[P3 중복]</strong> IconLinkSingle + IconLinkDouble → 단일 IconLink(count) 통합</li>
              <li><strong>[P3 코드품질]</strong> saveChangeHistories 케이스별 헬퍼 분리</li>
              <li><strong>[P4 테스트]</strong> getTaskProgress / getDisplayStatus / buildHistorySentence 순수 함수 추출 → 유닛 테스트</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}

