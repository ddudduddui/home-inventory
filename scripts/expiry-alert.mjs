// 유통기한 임박/지난 물건을 확인해 ntfy 로 푸시를 보냅니다.
// GitHub Actions(.github/workflows/expiry-alert.yml)에서 매일 실행됩니다.
// 필요한 환경 변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NTFY_TOPIC
// 선택: NTFY_SERVER (기본 https://ntfy.sh), SITE_URL (알림을 누르면 열 주소), TZ_NAME (기본 Asia/Seoul)

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  NTFY_TOPIC,
  NTFY_SERVER = 'https://ntfy.sh',
  SITE_URL = '',
  TZ_NAME = 'Asia/Seoul',
  DRY_RUN = '',
} = process.env;

for (const [k, v] of Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NTFY_TOPIC })) {
  if (!v) { console.error(`환경 변수 ${k} 가 비어 있어요.`); process.exit(1); }
}

const headers = { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` };
async function rest(path) {
  const res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${path}`, { headers });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: TZ_NAME, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const toUTC = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const today = toUTC(todayStr);

const [settings] = await rest('settings?id=eq.1&select=alert_days');
const alertDays = Number.isFinite(settings?.alert_days) ? settings.alert_days : 3;
const items = await rest('items?select=name,room,spot,expiry&expiry=not.is.null&order=expiry.asc');

const flagged = items
  .map((it) => ({ ...it, days: Math.round((toUTC(it.expiry) - today) / 86400000) }))
  .filter((it) => it.days <= alertDays);

const expired = flagged.filter((it) => it.days < 0);
const soon = flagged.filter((it) => it.days >= 0);
const dLabel = (n) => (n < 0 ? `${-n}일 지남` : n === 0 ? '오늘까지' : `D-${n}`);
const where = (it) => [it.room, it.spot].filter(Boolean).join(' › ') || '위치 미정';

console.log(`${todayStr} 기준, 알림 기준 ${alertDays}일: 지남 ${expired.length}, 임박 ${soon.length}`);
for (const it of flagged) console.log(` - ${dLabel(it.days)}  ${it.name} (${where(it)}) ${it.expiry}`);

if (!flagged.length) { console.log('보낼 알림 없음'); process.exit(0); }

const lines = flagged.slice(0, 15).map((it) => `${dLabel(it.days)} · ${it.name} — ${where(it)}`);
if (flagged.length > 15) lines.push(`외 ${flagged.length - 15}개`);
const titleParts = [];
if (expired.length) titleParts.push(`지남 ${expired.length}`);
if (soon.length) titleParts.push(`임박 ${soon.length}`);

const payload = {
  topic: NTFY_TOPIC,
  title: `유통기한 알림: ${titleParts.join(' · ')}`,
  message: lines.join('\n'),
  tags: [expired.length ? 'warning' : 'hourglass_flowing_sand'],
  priority: expired.length ? 4 : 3,
  ...(SITE_URL ? { click: SITE_URL } : {}),
};

if (DRY_RUN) { console.log('DRY_RUN: 보내지 않음', payload); process.exit(0); }

const res = await fetch(NTFY_SERVER.replace(/\/$/, ''), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
if (!res.ok) { console.error(`ntfy ${res.status}: ${await res.text()}`); process.exit(1); }
console.log('알림 보냄');
