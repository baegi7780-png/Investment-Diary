# 투자노트 · Stock Journal

한국·미국·일본 주식을 기록하는 투자일지. 가입 인원은 관리자가 설정합니다. 실제 주문을 전송하지 않습니다. Cloudflare Workers + D1 + TypeScript, HTML/CSS/JavaScript + Bootstrap으로 만들었습니다. API 키 없이 수동 현재가로 모든 투자기록 기능을 사용합니다.

## 구현된 기능

- USD/KRW·JPY/KRW 환율: Frankfurter의 일별 기준 환율을 매일 오전 9시 KST(UTC 00:00)에 확인하고 D1에 저장합니다. 당일 확인이 안 된 경우 화면 조회 시에도 확인하며, 동시에 조회해도 중복 외부 호출을 막고 실패 시 1시간 후 재시도합니다. 마지막 환율과 실제 제공 기준 날짜를 유지합니다. 주말·휴일은 이전 기준 날짜가 표시될 수 있습니다. 피드·포트폴리오·종목 및 거래 금액 옆에 원화 참고 환산을 표시하며, 과거 실제 환전율·은행 수수료·환차손익은 반영하지 않습니다. 각 시장의 원래 거래 금액은 변경하지 않습니다. 배포 전 `0004_exchange_rates.sql`을 적용합니다. API 키가 필요하지 않으며 외부 요청에는 USD/KRW·JPY/KRW 통화쌍만 포함합니다.

- 닉네임: 첫 로그인 시 2~20자 닉네임을 등록합니다. 한글·영문 등 문자, 숫자, 공백, . _ -를 사용할 수 있고 첫 글자는 문자/숫자여야 합니다. 계정별 D1 저장으로 재로그인과 기기 변경 후에도 유지하며, 계정 설정에서 변경할 수 있습니다. 중복 닉네임은 정규화·대소문자 기준으로 차단합니다. 로그인 아이디와 비밀번호는 그대로 유지됩니다. 기존 계정은 다음 접속 시 최초 닉네임 설정 화면을 거칩니다. `0002_user_nicknames.sql`은 기존 투자기록을 변경하지 않고 사용자 테이블에 닉네임 필드를 추가합니다.

- 회원 투자현황: 로그인 전에는 투자정보를 표시하지 않습니다. 로그인한 활성 사용자 누구나 모든 활성 계정의 현재 보유 종목·수량·평단·현재가·평가손익·수익률을 조회합니다. 계정 선택으로 현황을 전환하며, 내 투자기록에서 본인 기록만 수정할 수 있습니다. 거래내역·이유·메모·종목별 일지는 공개 범위를 선택합니다. 기본은 비공개이며, 공개한 기록만 로그인한 회원이 조회할 수 있습니다. GET /api/community/portfolios는 인증이 필요하고 조회만 지원합니다. 이전 비로그인 공개 API는 제거했습니다.

- 로그인 화면의 회원가입으로 아이디(영문·숫자·._- 3~40자)와 비밀번호(12자 이상)를 등록합니다. 이메일 인증 없이 일반 사용자 계정을 생성하며 첫 로그인에서 닉네임을 설정합니다. 비밀번호 원문 대신 PBKDF2 해시를 저장하고 중복 아이디와 IP별 15분 20회를 넘는 가입 요청을 차단합니다.
- 가입 인원은 기본 관리자와 비활성 계정을 포함해 5명입니다. 데이터베이스 트리거로 동시 가입에도 제한을 지킵니다. 관리자 로그인 → 내 투자기록 → 사용자 관리 → 회원가입 인원 제한에서 변경하며, 0은 제한 해제입니다. 제한을 낮춰도 기존 계정은 유지됩니다. `0003_registration_limit.sql` 적용 후 배포합니다.
- 토큰 기반 최초 관리자 생성, 로그인/로그아웃, 관리자 계정 추가 및 일반 계정 비활성화, 비밀번호 변경 및 세션 폐기
- 사용자별 거래·투자일지·현재가 분리. 관리자도 다른 회원의 거래·투자 이유·메모를 조회하거나 수정할 수 없습니다.
- 한국·미국·일본 종목 수동 등록/시장별 등록 종목 검색, 매수/추가 매수/일부·전량 매도, 이유·메모, 거래 수정/삭제/필터/CSV 내보내기
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

Cloudflare Git 빌드용 패키지 관리자는 `pnpm@10.11.1`로 지정했습니다. `pnpm-workspace.yaml`에 루트 패키지(`packages: ['.']`)와 esbuild/workerd의 설치 스크립트 허용을 설정했습니다. 빌드 설정은 루트 디렉터리 `/`, 빌드 명령 `pnpm run vendor`, 배포 명령 `pnpm run deploy`를 사용하세요. `packages field missing or empty` 오류가 발생했던 빌드는 수정 커밋으로 재시도합니다. 원격 D1 ID와 Secret 설정은 별도로 필요합니다.

배포 전 `npm run vendor`로 QR 브라우저 번들과 앱 아이콘을 생성합니다. 정적 파일은 저장소에도 포함되어 있습니다.

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

## QR 접속과 앱처럼 사용하기

상단 **QR · 앱처럼 사용** 버튼에서 접속 QR, PNG 저장, 주소 복사와 설치 안내를 제공합니다. Cloudflare에 HTTPS 배포하면 현재 사이트의 로그인 시작 주소로 QR이 자동 생성됩니다. localhost에서는 휴대폰 접속용 QR을 만들지 않고 배포 필요 안내를 표시합니다. QR에는 로그인 정보·쿼리·투자기록 경로를 넣지 않습니다.

- Android Chrome: 앱 설치 버튼이 표시되면 누르거나 브라우저 메뉴의 앱 설치/홈 화면에 추가를 사용합니다.
- iPhone/iPad: Safari에서 공유 → 홈 화면에 추가를 선택합니다.
- PC Chrome/Edge: 주소창 설치 아이콘 또는 브라우저 메뉴에서 설치합니다.

설치 후 아이콘으로 열면 standalone 앱 창으로 실행됩니다. 설치 버튼 표시 여부는 브라우저에 따라 달라집니다. HTTPS와 manifest 및 192/512px 아이콘을 제공합니다. 외부 앱스토어 등록은 필요하지 않습니다. 구현은 [MDN PWA 설치 안내](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)를 기준으로 했습니다.

오프라인에는 연결 안내 화면을 표시합니다. Service Worker는 정적 UI 파일만 캐시하며 `/api/*`, 로그인 응답, 투자정보와 쓰기 요청을 캐시하거나 오프라인 저장하지 않습니다. 조회/거래 저장에는 연결이 필요합니다. 새 앱 버전을 배포할 때 sw.js의 CACHE 버전도 갱신하세요.

### 추가 파일

`public/manifest.webmanifest`, `public/pwa.js`, `public/access-url.mjs`, `public/sw.js`, `public/offline.html`, `public/icons/`, `public/vendor/qrcode.mjs`, `scripts/icons.mjs`, `tests/pwa.test.ts`.

## Git 저장소 사용

로컬 Git 저장소를 초기화했습니다. 원격 저장소는 만들지 않았습니다. 코드/마이그레이션/테스트만 관리하며 DB, Secret, 설치 파일은 제외합니다. GitHub에 올릴 경우 비공개 저장소를 권장합니다. 최초 커밋은 본인 Git 이름과 이메일을 설정한 후 만들면 됩니다.

```powershell
git add .
git commit -m "Implement stock journal on Cloudflare Workers and D1"
```

## 시장과 거래 통화

종목 등록에서 한국장(KRW), 미국장(USD), 일본장(JPY)을 선택합니다. 매수·매도·수수료·현재가·목표가는 해당 시장 통화로 입력합니다. 전체/한국/미국/일본 탭으로 보유 현황과 거래를 조회합니다. 서로 다른 통화의 보유 금액은 현재 기준 환율로 원화 합산하며, 실제 환전 손익은 계산하지 않습니다. 한국·일본 현재가는 직접 입력합니다. 현재가 API 조회는 미국장만 지원합니다.

배포 전에 0005_markets.sql을 적용합니다. 기존 미국 종목의 ID와 거래 연결을 유지하고 시장별 종목코드를 구분합니다. 운영 가입 제한(현재 10명)은 변경하지 않습니다.

## 기록 공개 범위

거래 등록·수정에서 거래내역, 이유, 메모를 각각 PUBLIC/PRIVATE로 저장합니다. 거래내역을 비공개로 하면 이유·메모도 조회에서 제외합니다. 종목별 일지는 내용·목표가·손절가를 한 범위로 설정합니다. 기존 기록은 0006_record_visibility.sql 적용 시 모두 비공개입니다. 공개 범위를 생략한 기존 클라이언트의 수정은 저장된 설정을 유지합니다.

함께 보는 투자현황 → 공개 거래·투자 일지 보기에서 현재 시장의 공개 기록을 조회합니다. 서버의 인증 및 닉네임 설정 후에만 조회 가능하며, 활성 계정만 대상으로 합니다. 비공개 거래는 SQL에서 제외하고 공개 거래의 비공개 이유·메모는 NULL로 반환합니다. 거래 ID, 사용자 ID, 요청 ID 등 내부 필드는 공유하지 않습니다. 회원은 다른 사람의 기록을 수정할 수 없습니다. 보유 현황 공유 방식은 기존과 같습니다.

로컬 통합 테스트: 기존 integration.mjs와 markets-integration.mjs 실행 후 sharing-integration.mjs로 공개 범위, 비공개 전환, 타 계정 접근 차단을 검증합니다.

## 투자기록 삭제

내 투자기록의 포트폴리오 행 또는 종목 상세에서 투자기록 삭제를 선택하고 종목코드를 입력합니다. 해당 종목의 본인 거래·이유·메모·투자 일지·직접 입력 현재가를 한 D1 배치로 삭제합니다. 공유 종목과 다른 회원의 기록은 유지하며, 공개 기록 조회에서도 제외됩니다. 앱에서는 복구할 수 없습니다. 개별 거래 삭제는 거래내역의 삭제 버튼으로 수행합니다. DELETE /api/stocks/:id/records는 인증·CSRF·소유 기록·종목코드 확인 및 쓰기 리비전 검사를 거칩니다. 로컬 delete-record-integration.mjs에서 계정 격리 및 공개 기록 제거를 검증합니다.

## 회원끼리 현재가 수정

로그인한 회원은 피드의 보유 종목에서 해당 통화로 현재가를 저장할 수 있습니다. 입력한 가격은 선택한 회원의 해당 보유 종목에만 적용되고 직접 입력 모드로 전환됩니다. 보유 수량·원가·거래·이유·메모·일지는 수정하지 않습니다. 가격 정보에 마지막 수정 회원과 시간이 표시되며 본인도 다시 수정할 수 있습니다. 다른 회원이 같은 종목을 보유한 경우 그 계정 가격은 별도로 유지됩니다. 0007_peer_price_updates.sql을 적용한 뒤 배포합니다. 수정 대상 계정의 리비전을 검사하여 거래 삭제·변경과 경합 시 저장을 거부합니다.
