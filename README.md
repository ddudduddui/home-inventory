# 우리집 물건 지도

집안 물건이 어디 있는지 적어 두고 검색하는 가족용 웹 페이지예요. 식료품·의약품은 유통기한을 넣어 두면, 페이지에 들어왔을 때 기한이 지났거나 임박한 물건을 팝업과 위쪽 알림 칸으로 보여 줘요.

- **웹 페이지**: `web/` — 빌드 과정 없는 정적 사이트. GitHub Pages로 게시됩니다.
- **데이터**: [Supabase](https://supabase.com) (Postgres + 로그인). 가족 명단에 있는 이메일만 읽고 쓸 수 있어요.

```
web/                       정적 사이트 (index.html, styles.css, app.js, config.js)
supabase/schema.sql        테이블·보안 정책
.github/workflows/pages.yml      main 에 푸시하면 web/ 게시
.github/workflows/keepalive.yml  사흘마다 Supabase 에 요청 (무료 프로젝트 일시 중지 방지)
```

## 처음 설정하기

### 1. Supabase 프로젝트
1. supabase.com 에서 새 프로젝트를 만듭니다 (무료 플랜, Asia-Pacific).
2. **SQL Editor**에 `supabase/schema.sql` 내용을 붙여넣고 Run.
3. 같은 SQL Editor에서 가족 이메일을 등록합니다.
   ```sql
   insert into public.household_members (email) values ('me@example.com'), ('family@example.com');
   ```
4. **Authentication → URL Configuration**
   - Site URL 과 Redirect URLs: `https://<GitHub 아이디>.github.io/<저장소 이름>/`
5. **Project Settings → API Keys** 의 Project URL 과 publishable(anon) 키를 `web/config.js`에 넣고 커밋합니다.
   공개용 키라 깃에 올려도 됩니다. secret / service_role 키는 절대 넣지 마세요.

### 2. GitHub Pages
저장소 **Settings → Pages → Source: GitHub Actions**. `main`에 푸시하면 `web/`이 게시됩니다.

## 가족 계정 만들기
Supabase 기본 메일은 보낼 수 있는 양이 아주 적고 회사 메일로는 잘 안 가요. 그래서 계정을 직접 만드는 게 편해요.

1. `household_members`에 이메일을 추가합니다 (위 SQL).
2. **Authentication → Users → Add user → Create new user**: 이메일, 비밀번호, **Auto Confirm User** 체크.
3. 사이트에서 그 이메일과 비밀번호로 로그인합니다. 비밀번호는 사이트 위쪽 **설정**에서 바꿀 수 있어요.

## 알아둘 점
- 유통기한 팝업은 사이트를 새로 열 때마다 한 번 떠요. 팝업의 "오늘 하루 보지 않기"를 누르면 그 브라우저에서는 그날 더 띄우지 않아요.
- 알림 기준("남은 기간 ○일 이하면 알림")은 위쪽 **설정** 버튼에 있고, 가족 모두에게 같이 적용돼요.
- Supabase 무료 프로젝트는 7일 동안 요청이 없으면 일시 중지돼요. `keepalive.yml`이 사흘마다 요청을 보내 막아 줘요. 다만 GitHub은 저장소에 60일 동안 커밋이 없으면 예약 워크플로를 멈추니, 멈췄다는 메일이 오면 Actions 탭에서 다시 켜 주세요.
- 화면을 고친 뒤에는 `web/index.html`의 `?v=` 숫자를 바꿔야 가족 브라우저가 새 파일을 받아요.

## 구역(평면도) 바꾸기
평면도와 수납 구역은 `web/zones.js`에 있어요. 방·수납장을 추가하거나 위치를 옮기려면 이 파일의 좌표를 고치면 돼요.
물건에는 구역 이름(`id`)이 그대로 저장되니, 이미 물건이 있는 구역의 이름을 바꾸면 그 물건들은 "위치 미지정"으로 보여요. 그때는 물건을 열어 새 구역을 골라 주세요.
