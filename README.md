# 우리집 물건 지도

집안 물건이 어디 있는지 적어 두고 검색하는 가족용 웹 페이지예요. 식료품·의약품은 유통기한을 넣어 두면 페이지 위쪽에서 임박한 물건을 보여 주고, 매일 아침 휴대폰으로 푸시 알림을 보내요.

- **웹 페이지**: `web/` — 빌드 과정 없는 정적 사이트. GitHub Pages로 게시됩니다.
- **데이터**: [Supabase](https://supabase.com) (Postgres + 이메일 로그인). 가족 명단에 있는 이메일만 읽고 쓸 수 있어요.
- **알림**: GitHub Actions가 매일 08:00(KST)에 확인해서 [ntfy](https://ntfy.sh)로 푸시를 보내요.

```
web/                  정적 사이트 (index.html, styles.css, app.js, config.js)
supabase/schema.sql   테이블·보안 정책
scripts/expiry-alert.mjs  유통기한 확인 + ntfy 전송
.github/workflows/    pages.yml(게시), expiry-alert.yml(매일 알림)
```

## 처음 설정하기

### 1. Supabase 프로젝트
1. supabase.com 에서 새 프로젝트를 만듭니다 (무료 플랜, 지역은 Seoul 권장).
2. **SQL Editor**에 `supabase/schema.sql` 내용을 붙여넣고 Run.
3. 같은 SQL Editor에서 가족 이메일을 등록합니다.
   ```sql
   insert into public.household_members (email) values ('me@example.com'), ('family@example.com');
   ```
4. **Authentication → URL Configuration**
   - Site URL: `https://<GitHub 아이디>.github.io/<저장소 이름>/`
   - Redirect URLs 에도 같은 주소를 추가합니다.
5. **Project Settings → API** 에서 `Project URL`, `anon public` 키를 `web/config.js`에 넣고 커밋합니다.
   anon 키는 공개용이라 깃에 올려도 됩니다. `service_role` 키는 절대 넣지 마세요.

### 2. GitHub Pages
저장소 **Settings → Pages → Source: GitHub Actions**. `main`에 푸시하면 `web/`이 게시됩니다.

### 3. 유통기한 푸시 알림 (ntfy)
1. 휴대폰에 ntfy 앱을 설치하고, 남이 추측하기 어려운 주제 이름(예: `home-inv-8f3k2q9xw1`)을 구독합니다. 가족도 같은 주제를 구독하면 함께 받아요.
2. 저장소 **Settings → Secrets and variables → Actions** 에 추가:
   | 종류 | 이름 | 값 |
   |---|---|---|
   | Secret | `SUPABASE_URL` | Supabase Project URL |
   | Secret | `SUPABASE_SERVICE_ROLE_KEY` | Supabase `service_role` 키 |
   | Secret | `NTFY_TOPIC` | 구독한 주제 이름 |
   | Variable | `SITE_URL` | 게시된 페이지 주소 (알림을 누르면 열림, 선택) |
3. **Actions → 유통기한 알림 → Run workflow** 로 바로 시험해 볼 수 있어요 (`dry_run`을 켜면 보내지 않고 결과만 출력).

## 알아둘 점
- ntfy.sh의 주제는 이름을 아는 사람이면 누구나 구독할 수 있어요. 주제 이름을 비밀번호처럼 길고 무작위로 정하세요.
- GitHub은 저장소에 60일 동안 커밋이 없으면 예약된 워크플로를 멈춰요. 멈추면 Actions 탭에서 다시 켜면 됩니다.
- Supabase 무료 프로젝트는 일주일 동안 요청이 없으면 일시 중지되는데, 매일 알림 확인이 요청을 보내므로 보통 유지돼요.
- 웹 페이지의 "남은 기간 ○일 이하면 알림" 설정이 푸시 알림 기준으로도 쓰여요.
