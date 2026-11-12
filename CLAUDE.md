# 우리집 물건 지도 — 작업 메모 (Claude용)

가족용 집안 물건 위치·유통기한 관리 웹. 휴대폰 위주로 씀. 사용자에게는 한국어로, 쉬운 말로 답할 것.

## 구조
- `web/` 정적 사이트 (빌드 없음). `main`에 `web/**` 변경을 푸시하면 `.github/workflows/pages.yml`이 GitHub Pages로 게시.
  - 게시 주소: https://ddudduddui.github.io/home-inventory/
  - `index.html` 화면 뼈대, `styles.css` 모바일 우선 스타일, `app.js` 전체 로직, `zones.js` 평면도·구역, `config.js` Supabase URL + publishable 키(공개용, 커밋 OK).
- `supabase/schema.sql` 테이블(household_members, items, settings), `is_member()`, RLS, realtime. 이미 실제 프로젝트에 적용됨.
- `.github/workflows/keepalive.yml` 사흘마다 Supabase 호출(무료 프로젝트 일시중지 방지).
- `dev/` 로컬 미리보기 전용 (게시 안 됨): `python dev/preview.py` → http://localhost:8765 . supabase-js 대신 `dev/mock.js`(가짜 로그인·물건)를 끼워 넣음.

## 꼭 지킬 것
- 화면 파일(styles.css, config.js, zones.js, app.js)을 고치면 `web/index.html`의 `?v=YYYYMMDDHHMM` 숫자를 **전부** 새 값으로 올릴 것. 안 하면 가족 폰에 예전 파일이 섞여 "아무것도 안 됨" 증상.
- secret / service_role 키는 절대 `config.js`나 저장소에 넣지 말고, 사용자에게 달라고 하지도 말 것. GitHub Secrets 등 비밀값은 사용자가 직접 입력.
- 사용자 이메일 등 개인정보를 커밋(SQL 포함)이나 외부 요청에 넣지 말 것.
- 커밋 메시지는 한국어 한 줄 요약 + 끝에 `Co-Authored-By` 줄.
- 구역 `id`는 items.room 에 그대로 저장됨. 이름을 바꾸거나 나누면 `zones.js`의 `legacy`에 예전 이름 → 새 구역을 추가해 기존 물건이 "위치 미지정"으로 빠지지 않게 할 것.

## 평면도 (zones.js)
- viewBox 800×1000, 실제 집 평면도를 **좌우 반전**한 배치. 홈 화면에서는 접혀 있고 누르면 펼쳐짐.
- room: 뒷발코니, 작은방, 주방, 컴퓨터방, 화장실, 현관, 거실(다각형), 안방, 다용도실, 베란다.
- storage 옵션: `short`(표시 이름, `\n`으로 두 줄), `small`(작은 글씨), `fridge`(하늘색), `badge:'bottom'`, 세로로 길면 라벨 회전.
- 현재 수납 구역: 세탁기 선반, 주방 창문 서랍장, 주방 상부장/하부장, 냉장고(2층 냉장실) + 냉동고 왼쪽/오른쪽(1층), 컴퓨터방 서랍장, 컴퓨터 책상 서랍, 화장실 상부장, 안방 화장대 상부장/하부장 + 붙박이장 1·2·3통, 현관 신발장, 베란다 창고.
- 추측으로 정한 것(사용자 확인 전): 냉장고 위치(주방 오른쪽 아래), 붙박이장 방향(평면도 위쪽 = 장을 볼 때 왼쪽).

## 기능 메모
- 로그인: 비밀번호 / 메일 링크. 가족 계정은 Supabase에서 Add user + Auto Confirm 으로 직접 만듦(기본 메일 발송이 잘 안 옴).
- 유통기한: 페이지 열 때 임박·지난 물건 팝업(세션당 1회, "오늘 하루 보지 않기" = localStorage `expPopupHiddenOn`). 휴대폰 푸시 알림은 원하지 않음.
- 알림 기준 일수는 설정 시트(헤더 톱니)에 있음, 가족 공통(settings 테이블).

## 보류 중인 아이디어
- 장 안의 선반·층 표현: 사용자가 "일단 써보고" 정하기로 함. 먼저 제안하지 말고 요청 오면 진행.
- 평면도 펼침 상태 기억, 냉장고 위치·붙박이장 순서 조정 — 요청 시.

## 도구 메모 (Windows)
- GitHub CLI: PowerShell 에서는 `& "C:\Program Files\GitHub CLI\gh.exe" ...` (PATH에 없을 수 있음). 새 PC면 `gh auth login` 필요.
- Node 없음. 로컬 서버는 Python.
