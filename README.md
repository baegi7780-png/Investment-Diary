# 투자노트 · Stock Journal

최대 5명이 쓰는 미국 주식 투자일지. 실제 주문을 전송하지 않습니다. Cloudflare Workers + D1 + TypeScript, HTML/CSS/JavaScript + Bootstrap으로 만들었습니다. API 키 없이 수동 현재가로 모든 투자기록 기능을 사용합니다.

## 구현된 기능

- 토큰 기반 최초 관리자 생성, 로그인/로그아웃, 최대 5계정, 관리자만 계정 추가 및 일반 계정 비활성화, 비밀번호 변경 및 세션 폐기
- 사용자별 거래·투자일지·현재가 분리. 관리자는 다른 사용자의 투자정보에 접근할 수 없습니다.
- 미국 종목 수동 등록/등록된 종목 검색, 매수/추가 매수/일부·전량 매도, 이유·메모, 거래 수정/삭제/필터/CSV 내보내기
- 시간순 이동평균 계산, 수수료 제외 체결평단과 수수료 포함 취득평단 분리, 실현손익 및 평가손익
- 소수 8자리 입력을 문자열로 저장, Decimal.js 50자리 정밀도 계산, 화면은 금액·수익률 2자리 표시. 순환소수 나눗셈은 지정 정밀도에서 계산됩니다.
- 사용자별 수동 가격과 모드 영구 저장, API/수동 전환, 입력 즉시 저장 전 평가 미리보기, API 갱신에도 수동 모드 유지
- 현재가 미설정 표시, 일부 종목 가격 누락 시 총 평가 미계산
- 대시보드, 종목 상세, 투자일지(목표/손절/목적/전망/결과/복기), 거래 화면, 모바일 카드, 다크/라이트 테마
- 선택적 Twelve Data 시세 조회 어댑터, 공용 D1 캐시 15분, 제공 시각/갱신 시각/지연 안내, 실패 시 가격과 모드 유지
- PBKDF2-SHA256(100,000회, 개별 랜덤 salt), 세션 토큰 SHA256 저장, HttpOnly/SameSite=Strict/HTTPS Secure 쿠키, 7일 세션
- Origin + 세션별 CSRF 토큰, CSP, 출력 이스케이프, 준비된 SQL, 입력 검증, 로그인 시도 제한(아이디+IP별 15분 10회)
- 사용자별 요청 ID로 거래 중복 방지, D1 batch + revision trigger로 동시 거래 변경 차단 및 일괄 롤백

## 파일 구성

```text
src/index.ts                 Worker API / 인증 / 사용자 분리 / 가격 캐시
src/calculation.ts           정확한 소수 계산 / 시간순 거래 재계산
public/index.html            로그인·초기 설정·거래 입력
public/app.js                대시보드·상세·거래내역·일지·계정 UI
public/style.css             반응형·테마 스타일
public/vendor/               Bootstrap CSS / Decimal.js (로컬 제공)
migrations/0001_initial.sql  7개 핵심 테이블 + 로그인 제한 / 동시쓰기 가드
tests/calculation.test.ts    계산 시나리오 테스트
tests/integration.mjs        로컬 Worker + D1 통합 테스트
scripts/vendor.mjs           로컬 정적 의존 파일 준비
wrangler.jsonc              Worker / Static Assets / D1 설정
.dev.vars.example           초기 설정 Secret 예시
package.json / pnpm-lock.yaml 의존성·명령 / 고정 버전
```

## 로컬 실행

Node.js 22 이상과 npm(또는 pnpm), Git은 권장입니다. GitHub는 선택입니다.

```powershell
cd "C:\Users\qorlc\Documents\Codex\2026-10-08\new-chat\outputs\stock-journal"
npm install
npm run vendor
Copy-Item .dev.vars.example .dev.vars
```

`.dev.vars`에서 SETUP_TOKEN을 충분히 긴 무작위 값으로 바꾸세요. 기본 관리자 비밀번호는 없습니다. 예시의 토큰 문자열을 실제 운영에 사용하지 마세요.

```powershell
npm run db:local
npm run dev
```

http://localhost:8787 에서 설정 토큰, 관리자 아이디, 12자 이상 비밀번호로 첫 계정을 만듭니다. 생성 후 로그인하고 사용자 관리에서 계정을 추가합니다. 계정 수 제한은 비활성 계정도 포함합니다. 최초 설정 후 SETUP_TOKEN을 삭제하고 서버를 재시작하세요. 로컬 HTTP 예외는 localhost/127.0.0.1/::1에만 적용됩니다.

## Cloudflare D1 및 배포

아직 실제 Cloudflare 계정 연결이나 원격 배포는 실행하지 않았습니다. 본인 계정으로 다음을 진행하세요.

```powershell
npx wrangler login
npx wrangler d1 create stock-journal-db
```

반환된 database_id를 wrangler.jsonc의 0으로 된 임시 ID 대신 넣습니다. 운영 시 ALLOW_HTTP_LOCAL을 false로 바꾸세요.

```powershell
npm run db:remote
npx wrangler secret put SETUP_TOKEN
npm run deploy
```

배포된 HTTPS 주소에서 최초 관리자를 생성한 뒤:

```powershell
npx wrangler secret delete SETUP_TOKEN
```

Secrets는 `.dev.vars`와 별도입니다. `.dev.vars`는 로컬 전용이며 Git에 포함되지 않습니다. 원격 마이그레이션은 운영 변경이므로 배포 전 백업을 먼저 확보하세요.

## 선택적 시세 API

2026-10-08 조사: [Twelve Data 요금표](https://twelvedata.com/pricing)의 Basic은 분당 8 API credits, 일 800회 제한을 안내합니다. 개인 요금표에는 internal non-display 접근 설명이 있어 무료 요금제만으로 5명에게 화면 표시할 권리가 확보됐다고 단정할 수 없습니다. 거래소별 지연·표시 권한과 적용 크레딧은 공급자에게 확인하세요. 현재 앱은 표시 권한 확인 플래그 없이는 API 호출을 하지 않습니다.

승인받은 경우에만 다음을 설정합니다.

```powershell
npx wrangler secret put TWELVE_DATA_API_KEY
npx wrangler secret put QUOTE_DISPLAY_APPROVED
# 두 번째 입력 값: true
```

API 키는 서버 Secret에서만 사용합니다. 종목 상세에서 API 조회를 누르면 갱신하며 자동 주기 조회는 없습니다. 같은 종목은 15분 캐시를 공유합니다. 캐시 미스가 동시에 생기면 중복 조회가 가능하므로 많은 종목을 연속 조회하면 공급자 제한에 도달할 수 있습니다. 실패하면 기존 캐시를 유지하고 오류를 안내합니다. API 모드를 선택했는데 캐시가 없으면 수동 가격으로 몰래 대체하지 않고 미설정으로 표시합니다.

## 테스트

```powershell
npm run check
npm test
```

통합 테스트는 전용 테스트 DB만 사용하며 테스트 가격/계정을 생성합니다. 운영 DB나 사용 중인 로컬 DB에서 실행하지 마세요. 다음 TEST_STATE 폴더는 매번 새 빈 폴더를 지정하세요.

```powershell
$env:TEST_STATE='../../work/test-state-new'
npx wrangler d1 migrations apply DB --local --persist-to $env:TEST_STATE
npx wrangler dev --persist-to $env:TEST_STATE --var SETUP_TOKEN:integration-only-token-do-not-deploy
# 다른 터미널, 동일 프로젝트 폴더:
$env:TEST_STATE='../../work/test-state-new'
$env:TEST_SETUP_TOKEN='integration-only-token-do-not-deploy'
npm run test:integration
```

검증 결과는 TEST-RESULTS.md 참조. 테스트 계정/가격은 work/의 별도 DB에만 있고 사용자용 기본 DB와 배포 데이터에는 포함하지 않습니다.

## 백업과 복구

Git은 코드 이력용이며 D1 투자기록 백업을 대체하지 않습니다. 일별 또는 중요한 변경 전에 SQL export를 안전한 곳에 보관하세요.

```powershell
New-Item -ItemType Directory -Force backups
npx wrangler d1 export DB --remote --output backups/journal-backup.sql
npx wrangler d1 time-travel info DB
```

복구는 현재 DB 상태를 되돌리므로 먼저 앱 사용을 중단하고 현재 export도 보존합니다. 반환받은 실제 bookmark로:

```powershell
npx wrangler d1 time-travel restore DB --bookmark="실제-복구-bookmark"
```

SQL 백업은 먼저 새 별도 D1에 복구하고 데이터를 검증한 후 binding을 전환하는 것을 권장합니다. 빈 복구 DB에 `npx wrangler d1 execute 복구DB이름 --remote --file backups/journal-backup.sql`을 실행합니다. [D1 Time Travel 공식 문서](https://developers.cloudflare.com/d1/reference/time-travel/) 기준 무료 플랜은 7일, 유료는 30일 복구 범위입니다. 백업은 해시된 비밀번호와 세션도 포함하는 민감한 파일이므로 비공개로 보호하고 복구 후 세션을 폐기하세요.

## 비용 및 운영

무료 플랜에서 시작할 수 있지만 사용자 5명이라는 조건만으로 항상 무료를 보장하지 않습니다. [Workers 요금](https://developers.cloudflare.com/workers/platform/pricing/) 및 [D1 요금](https://developers.cloudflare.com/d1/platform/pricing/)에서 요청/CPU/행 읽기·쓰기/저장 제한을 확인하세요. 이 앱은 보안 헤더 적용을 위해 정적 파일도 Worker를 거칩니다. 거래가 늘면 전체 내역 재계산 비용도 증가합니다. 무료 한도 초과 시 오류가 날 수 있고 유료로 전환하면 요금이 발생할 수 있습니다. 외부 API 및 도메인 비용은 별도입니다.

향후 개선: 거래 페이지네이션과 조회 범위 최적화, API 전역 호출 제한 및 동시 요청 결합, MFA/비밀번호 복구, 변경 감사 이력과 소프트 삭제, 자동 백업·복구 훈련, 자동 시세 갱신, 데이터 import, 엄밀한 유리수 원가 계산. 현재는 수동 백업 절차를 제공합니다.

## Git

로컬 Git 저장소를 초기화했습니다. 원격 저장소는 만들지 않았습니다. 코드/마이그레이션/테스트만 관리하며 DB, Secret, 설치 파일은 제외합니다. GitHub에 올릴 경우 비공개 저장소를 권장합니다. 최초 커밋은 본인 Git 이름과 이메일을 설정한 후 만들면 됩니다.

```powershell
git add .
git commit -m "Implement stock journal on Cloudflare Workers and D1"
```
