# 단일 프로젝트: 공개 뷰어 + 본인 Vercel 로그인 관리자

기존 project-planner 하나만 사용합니다. 미배포 project-planner-viewer는 이 구조에서 사용하지 않습니다. 자동 삭제하지 않았습니다.

## 구현
- GET 플래너 및 히스토리는 비로그인 조회를 허용합니다.
- PUT 저장은 Vercel이 서명한 ID 토큰을 검증하고 server/authConfig.js의 본인 고유 User ID와 일치할 때만 허용합니다.
- Vercel 팀원 여부, 브라우저 표시, 요청 헤더의 이메일, 예전 PLANNER_ACCESS_MODE 값만으로 편집을 허용하지 않습니다.
- 관리자 로그인은 Sign in with Vercel의 Authorization Code + PKCE S256 방식입니다. 앱에는 client authentication method none 하나만 활성화했습니다. 이 설정은 ID 토큰 검증을 생략한다는 뜻이 아닙니다.
- 등록된 로그인 앱은 AI Operation Planner Login입니다. clientId 및 adminId는 비밀키가 아닌 공개 식별자이며 server/authConfig.js에 지정되어 있습니다. 기존 SUPABASE_URL, SUPABASE_SECRET_KEY는 그대로 사용합니다.
- 로그인 복귀 주소: https://aiopplanner.cine-clue.com/api/auth?action=callback
- state, nonce, 발급자·서명·대상 앱·만료·본인 계정 ID를 검증합니다. 토큰은 Secure/HttpOnly/호스트 한정 쿠키로만 전달합니다. 저장과 로그아웃에는 정확한 Origin 검사를 적용합니다.
- 공개 뷰어는 편집·저장 컨트롤이 숨겨지며 입력도 비활성화됩니다. 서버는 직접 전송한 변경 요청도 403으로 거부합니다.
- 기존 PLANNER_ACCESS_MODE와 PLANNER_ALLOWED_ORIGINS 설정은 새 코드에서 권한 판정에 사용하지 않습니다.

## 적용 순서
1. 수정본을 기존 저장소 main에 업로드하고 기존 project-planner 배포가 Ready인지 확인합니다.
2. 아직 Vercel 배포 보호를 해제하지 않고, 기존 로그인된 브라우저로 사이트를 엽니다. 이제 기본 표시는 뷰어·조회 전용이어야 합니다.
3. 관리자 로그인으로 본인 계정을 인증하고 관리자 표시·편집 기능을 확인합니다.
4. 배포된 새 API에 비로그인/위조 쿠키로 보낸 PUT이 403으로 거부되는지 확인합니다. 테스트 요청은 실제 저장을 수행하지 않는 비관리자 요청만 사용합니다.
5. 위 검증 후 사용자 승인하에 기존 프로젝트의 Vercel Authentication 보호 범위를 Standard Protection으로 바꿔 운영 도메인을 공개합니다. All Deployments 보호 해제를 먼저 하지 마세요.
6. 비로그인 창에서 조회·문서 링크·히스토리 20개 로딩, 편집 버튼 비노출을 확인합니다. 관리자 로그아웃 후 조회 모드로 돌아오는지 확인합니다.

## 현재 상태
- 로컬 구현 및 테스트 21개, 프로덕션 빌드 통과.
- Vercel 로그인 앱 생성, 등록 URL, 팀 내 로그인 제한, 인증 방식 저장 완료.
- GitHub 업로드와 운영 배포는 사용자가 실행할 예정입니다.
- 운영 로그인 전체 흐름 및 공개 접근 전환은 아직 검증·적용되지 않았습니다.
- Vercel이 플랫폼 설정 변경 시 별도 재인증을 요구할 가능성은 남아 있습니다.
