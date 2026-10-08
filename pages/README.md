# 투자노트 접속 주소

사용자 접속 주소는 https://investment-diary.pages.dev 입니다.

이 Pages 프로젝트는 `JOURNAL` 서비스 바인딩으로 `investment-diary` Worker에 요청을 전달합니다. URL, Origin, 쿠키, CSRF 토큰을 그대로 유지하므로 Pages 주소에서 로그인하고 기록을 저장할 수 있습니다. 현재 D1과 계정을 함께 사용하며 데이터를 복사하지 않습니다.

일반 앱 수정은 기존 Worker 배포로 반영됩니다. Pages 연결 코드를 바꾸었을 때만 프로젝트 루트에서 `pnpm deploy:pages`를 실행합니다. Pages의 미리보기 배포도 동일한 실제 앱에 연결되므로 테스트 데이터 작성 용도로 사용하지 않습니다.

Workers 주소에서 로그인했더라도 Pages 주소에서는 별도로 로그인해야 합니다. QR과 앱 설치 주소는 현재 접속한 Pages 주소를 사용합니다.
