'use strict';

const CATS = ['식료품', '의약품', '생활용품', '주방용품', '공구', '전자기기', '의류', '서류·귀중품', '기타'];
const $ = (s) => document.querySelector(s);
const state = {
  items: [], alertDays: 3, q: '', room: '__all', sort: 'recent',
  loaded: false, editing: null, session: null, channel: null,
};

/* ---------- helpers ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function today0() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function fmtDate(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function daysLeft(exp) {
  if (!exp || !/^\d{4}-\d{2}-\d{2}$/.test(exp)) return null;
  const [y, m, d] = exp.split('-').map(Number);
  return Math.round((new Date(y, m - 1, d) - today0()) / 86400000);
}
function statusOf(it) {
  const n = daysLeft(it.expiry);
  if (n === null) return null;
  if (n < 0) return 'expired';
  if (n <= state.alertDays) return 'soon';
  return 'ok';
}
function dLabel(n) { return n < 0 ? `${-n}일 지남` : n === 0 ? '오늘까지' : `D-${n}`; }
function hl(text, terms) {
  let out = esc(text);
  for (const t of terms) {
    const re = new RegExp(esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    out = out.replace(re, (m) => `<mark>${m}</mark>`);
  }
  return out;
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2200);
}
function setStatus(msg) { const s = $('#status'); s.textContent = msg || ''; s.hidden = !msg; }
function show(view) {
  for (const id of ['loginView', 'deniedView', 'appView']) $('#' + id).hidden = id !== view;
  const inApp = view === 'appView';
  $('#searchBox').hidden = !inApp;
  $('#addBtn').hidden = !inApp;
  $('#signOutBtn').hidden = view === 'loginView' || !view;
  $('#pwBtn').hidden = !inApp;
}

/* ---------- render ---------- */
function render() { renderAlerts(); renderFilters(); renderList(); }

function renderAlerts() {
  const withExp = state.items.filter((it) => daysLeft(it.expiry) !== null);
  const flagged = withExp.filter((it) => ['expired', 'soon'].includes(statusOf(it)))
    .sort((a, b) => daysLeft(a.expiry) - daysLeft(b.expiry));
  const nExp = flagged.filter((it) => statusOf(it) === 'expired').length;
  const nSoon = flagged.length - nExp;
  $('#alertCounts').innerHTML =
    (nExp ? `<span class="pill expired">지남 ${nExp}</span>` : '') +
    (nSoon ? `<span class="pill soon">임박 ${nSoon}</span>` : '') +
    (!flagged.length && withExp.length ? `<span class="pill ok">모두 여유</span>` : '');
  const list = $('#alertList');
  if (!state.loaded) { list.innerHTML = `<li class="alert-empty">불러오는 중…</li>`; return; }
  if (!withExp.length) { list.innerHTML = `<li class="alert-empty">유통기한을 입력한 물건이 아직 없어요. 식료품을 추가할 때 날짜를 넣으면 여기서 챙겨드려요.</li>`; return; }
  if (!flagged.length) { list.innerHTML = `<li class="alert-empty">${state.alertDays}일 안에 기한이 끝나는 물건이 없어요.</li>`; return; }
  list.innerHTML = flagged.map((it) => {
    const n = daysLeft(it.expiry), s = statusOf(it);
    return `<li><button type="button" class="alert-row" data-id="${esc(it.id)}">
      <span class="pill ${s}">${dLabel(n)}</span>
      <span><strong>${esc(it.name)}</strong> <span class="where">· ${esc([it.room, it.spot].filter(Boolean).join(' › ') || '위치 미정')}</span></span>
      <span class="date">${esc(it.expiry)}</span>
    </button></li>`;
  }).join('');
}

function roomOf(it) { return (it.room || '').trim() || '위치 미정'; }
function rooms() {
  const m = new Map();
  for (const it of state.items) { const r = roomOf(it); m.set(r, (m.get(r) || 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'));
}
const isFoodish = (it) => daysLeft(it.expiry) !== null || it.category === '식료품';

function renderFilters() {
  const rs = rooms();
  if (!state.room.startsWith('__') && !rs.some(([r]) => r === state.room)) state.room = '__all';
  const chip = (key, label, n) => `<button type="button" class="chip" data-room="${esc(key)}" aria-pressed="${state.room === key}">${esc(label)}<span class="n">${n}</span></button>`;
  $('#filters').innerHTML =
    chip('__all', '전체', state.items.length) +
    chip('__food', '유통기한 있는 것', state.items.filter(isFoodish).length) +
    rs.map(([r, n]) => chip(r, r, n)).join('') +
    `<span class="spacer"></span>
     <label class="note sortlabel" for="sort">정렬
       <select id="sort">
         <option value="recent">최근 수정순</option>
         <option value="expiry">유통기한 빠른순</option>
         <option value="name">이름순</option>
         <option value="room">공간별</option>
       </select></label>`;
  $('#sort').value = state.sort;
  $('#roomList').innerHTML = rs.filter(([r]) => r !== '위치 미정').map(([r]) => `<option value="${esc(r)}">`).join('');
}

function renderList() {
  const ul = $('#items');
  const terms = state.q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!state.loaded) { ul.innerHTML = ''; $('#listCount').textContent = ''; return; }
  if (!state.items.length) {
    ul.innerHTML = `<li class="empty">
      <strong>아직 등록된 물건이 없어요</strong>
      <span>‘물건 추가’를 눌러 첫 물건과 그 자리를 적어 두세요.<br>공간(주방·안방)과 세부 위치(냉장고 2번째 칸)를 나눠 적으면 찾기 쉬워요.</span>
      <button type="button" class="btn primary" data-action="add">물건 추가</button>
    </li>`;
    $('#listCount').textContent = '';
    return;
  }
  const rows = state.items.filter((it) => {
    if (state.room === '__food') { if (!isFoodish(it)) return false; }
    else if (state.room !== '__all' && roomOf(it) !== state.room) return false;
    const hay = [it.name, it.room, it.spot, it.memo, it.category].join(' ').toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
  const byName = (a, b) => (a.name || '').localeCompare(b.name || '', 'ko');
  const sorters = {
    recent: (a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')),
    name: byName,
    room: (a, b) => roomOf(a).localeCompare(roomOf(b), 'ko') || (a.spot || '').localeCompare(b.spot || '', 'ko') || byName(a, b),
    expiry: (a, b) => (daysLeft(a.expiry) ?? 1e9) - (daysLeft(b.expiry) ?? 1e9) || byName(a, b),
  };
  rows.sort(sorters[state.sort] || sorters.recent);
  $('#listCount').textContent = terms.length || state.room !== '__all' ? `${rows.length}개 찾음 / 전체 ${state.items.length}개` : `${state.items.length}개`;
  if (!rows.length) {
    ul.innerHTML = `<li class="empty"><strong>${state.q ? `‘${esc(state.q)}’에 맞는 물건이 없어요` : '이 조건에 맞는 물건이 없어요'}</strong><span>다른 이름이나 공간 이름으로 찾아보세요.</span></li>`;
    return;
  }
  ul.innerHTML = rows.map((it) => {
    const n = daysLeft(it.expiry), s = statusOf(it);
    const qty = it.qty != null && Number(it.qty) !== 1 ? `<span class="qty">×${esc(it.qty)}</span>` : '';
    return `<li><button type="button" class="item" data-id="${esc(it.id)}" aria-label="${esc(it.name)} 편집">
      <span class="tag">${hl(it.room || '위치 미정', terms)}</span>
      <span class="body">
        <div class="name">${hl(it.name, terms)}${qty}</div>
        ${it.spot ? `<div class="spot">${hl(it.spot, terms)}</div>` : ''}
        ${it.memo ? `<div class="memo">${hl(it.memo, terms)}</div>` : ''}
        ${it.category ? `<div class="cat">${hl(it.category, terms)}</div>` : ''}
      </span>
      <span class="dd">${n === null ? '' : `<span class="pill ${s}">${dLabel(n)}</span><span class="date">${esc(it.expiry)}</span>`}</span>
    </button></li>`;
  }).join('');
}

/* ---------- edit sheet ---------- */
$('#f-cat').innerHTML = CATS.map((c) => `<option>${c}</option>`).join('');

function openSheet(item) {
  state.editing = item ? item.id : null;
  $('#formTitle').textContent = item ? '물건 편집' : '물건 추가';
  $('#f-name').value = item?.name || '';
  $('#f-cat').value = item?.category || (state.room === '__food' ? '식료품' : '생활용품');
  $('#f-qty').value = item?.qty ?? 1;
  $('#f-room').value = item?.room || (state.room.startsWith('__') || state.room === '위치 미정' ? '' : state.room);
  $('#f-spot').value = item?.spot || '';
  $('#f-expiry').value = item?.expiry || '';
  $('#f-memo').value = item?.memo || '';
  $('#formErr').hidden = true;
  const del = $('#delBtn'); del.hidden = !item; del.classList.remove('armed'); del.textContent = '다 썼어요 (삭제)';
  syncSpots();
  $('#scrim').hidden = false;
  setTimeout(() => $('#f-name').focus(), 30);
}
function closeSheet() { $('#scrim').hidden = true; state.editing = null; }
function syncSpots() {
  const room = $('#f-room').value.trim();
  const spots = [...new Set(state.items.filter((it) => !room || it.room === room).map((it) => it.spot).filter(Boolean))];
  $('#spotList').innerHTML = spots.map((s) => `<option value="${esc(s)}">`).join('');
}

$('#f-room').addEventListener('input', syncSpots);
$('#qtyMinus').addEventListener('click', () => { $('#f-qty').value = Math.max(0, (Number($('#f-qty').value) || 0) - 1); });
$('#qtyPlus').addEventListener('click', () => { $('#f-qty').value = (Number($('#f-qty').value) || 0) + 1; });
document.querySelectorAll('.quick button').forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.add === '') { $('#f-expiry').value = ''; return; }
  const d = today0(); d.setDate(d.getDate() + Number(b.dataset.add)); $('#f-expiry').value = fmtDate(d);
}));
$('#cancelBtn').addEventListener('click', closeSheet);
$('#scrim').addEventListener('click', (e) => { if (e.target === $('#scrim')) closeSheet(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#scrim').hidden) closeSheet(); });

function dbErrorText(error) {
  if (!error) return '';
  if (error.code === '42501' || /row-level security/i.test(error.message || '')) return '권한이 없어요. 가족 명단에 등록된 계정인지 확인해 주세요.';
  return '저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.';
}

$('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#f-name').value.trim();
  const err = $('#formErr');
  if (!name) { err.textContent = '이름을 적어 주세요.'; err.hidden = false; $('#f-name').focus(); return; }
  const data = {
    name,
    category: $('#f-cat').value,
    qty: $('#f-qty').value === '' ? 1 : Number($('#f-qty').value),
    room: $('#f-room').value.trim(),
    spot: $('#f-spot').value.trim(),
    expiry: $('#f-expiry').value || null,
    memo: $('#f-memo').value.trim(),
  };
  const btn = $('#saveBtn'); btn.disabled = true;
  const editing = state.editing;
  const { error } = editing
    ? await sb.from('items').update(data).eq('id', editing)
    : await sb.from('items').insert(data);
  btn.disabled = false;
  if (error) { err.textContent = dbErrorText(error); err.hidden = false; return; }
  closeSheet();
  toast(editing ? '수정했어요' : `‘${name}’ 저장했어요`);
  loadItems();
});

$('#delBtn').addEventListener('click', async () => {
  const b = $('#delBtn');
  if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = '한 번 더 누르면 삭제'; return; }
  if (!state.editing) return;
  const name = state.items.find((it) => it.id === state.editing)?.name || '';
  const { error } = await sb.from('items').delete().eq('id', state.editing);
  if (error) { $('#formErr').textContent = '삭제하지 못했어요.'; $('#formErr').hidden = false; return; }
  closeSheet(); toast(`‘${name}’ 삭제했어요`); loadItems();
});

/* ---------- interactions ---------- */
$('#addBtn').addEventListener('click', () => openSheet(null));
let qTimer;
$('#q').addEventListener('input', (e) => { clearTimeout(qTimer); qTimer = setTimeout(() => { state.q = e.target.value.trim(); renderList(); }, 80); });
document.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (chip) { state.room = chip.dataset.room; renderFilters(); renderList(); return; }
  const row = e.target.closest('[data-id]');
  if (row && !row.closest('#scrim')) { const it = state.items.find((x) => x.id === row.dataset.id); if (it) openSheet(it); return; }
  if (e.target.closest('[data-action="add"]')) openSheet(null);
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'sort') { state.sort = e.target.value; try { localStorage.setItem('sort', state.sort); } catch {} renderList(); }
});
$('#alertDays').addEventListener('change', async (e) => {
  state.alertDays = Number(e.target.value); render();
  const { error } = await sb.from('settings').update({ alert_days: state.alertDays }).eq('id', 1);
  if (error) toast('알림 기준을 저장하지 못했어요');
});
try { const s = localStorage.getItem('sort'); if (s) state.sort = s; } catch {}

/* ---------- auth ---------- */
function loginMsg(text) { const m = $('#loginMsg'); m.textContent = text; m.hidden = !text; }
function readEmail() {
  const email = $('#loginEmail').value.trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) { loginMsg('이메일 주소를 확인해 주세요.'); $('#loginEmail').focus(); return null; }
  try { localStorage.setItem('lastEmail', email); } catch {}
  return email;
}
try { const e = localStorage.getItem('lastEmail'); if (e) $('#loginEmail').value = e; } catch {}

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = readEmail(); if (!email) return;
  const password = $('#loginPw').value;
  if (!password) { loginMsg('비밀번호를 입력해 주세요. 아직 없다면 아래 ‘메일로 로그인 링크 받기’를 누르세요.'); $('#loginPw').focus(); return; }
  $('#loginBtn').disabled = true;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  $('#loginBtn').disabled = false;
  if (error) {
    loginMsg(error.status === 429 ? '시도가 너무 많아요. 잠시 뒤 다시 해 주세요.'
      : '이메일 또는 비밀번호가 맞지 않아요. 비밀번호를 정한 적이 없다면 아래 링크 로그인을 이용하세요.');
    return;
  }
  loginMsg(''); $('#loginPw').value = '';
});

let linkCooldown = 0, linkTimer;
function tickLink() {
  const b = $('#linkBtn');
  if (linkCooldown > 0) { b.disabled = true; b.textContent = `링크 다시 받기 (${linkCooldown}초 뒤)`; linkCooldown--; linkTimer = setTimeout(tickLink, 1000); }
  else { b.disabled = false; b.textContent = '메일로 로그인 링크 받기'; }
}
$('#linkBtn').addEventListener('click', async () => {
  const email = readEmail(); if (!email) return;
  $('#linkBtn').disabled = true;
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
  if (error) {
    const wait = Number((error.message || '').match(/(\d+)\s*seconds?/)?.[1]) || 60;
    loginMsg(error.status === 429
      ? `메일은 잠시 뒤에 다시 보낼 수 있어요. 받은 메일이 있다면 그 링크를 눌러 주세요.`
      : '로그인 메일을 보내지 못했어요: ' + error.message);
    linkCooldown = error.status === 429 ? wait : 0;
  } else {
    loginMsg(`${email} 로 로그인 링크를 보냈어요. 메일함(스팸함 포함)을 확인해 주세요.`);
    linkCooldown = 60;
  }
  clearTimeout(linkTimer); tickLink();
});
$('#signOutBtn').addEventListener('click', async () => { await sb.auth.signOut(); });

/* 비밀번호 설정 */
function closePw() { $('#pwScrim').hidden = true; }
$('#pwBtn').addEventListener('click', () => {
  const email = state.session?.user?.email || '';
  $('#pwEmail').textContent = email; $('#pwUser').value = email;
  $('#pwNew').value = ''; $('#pwNew2').value = ''; $('#pwErr').hidden = true;
  $('#pwScrim').hidden = false;
  setTimeout(() => $('#pwNew').focus(), 30);
});
$('#pwCancel').addEventListener('click', closePw);
$('#pwScrim').addEventListener('click', (e) => { if (e.target === $('#pwScrim')) closePw(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#pwScrim').hidden) closePw(); });
$('#pwForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const a = $('#pwNew').value, b = $('#pwNew2').value, err = $('#pwErr');
  const fail = (t) => { err.textContent = t; err.hidden = false; };
  if (a.length < 8) return fail('8자 이상으로 정해 주세요.');
  if (a !== b) return fail('두 칸의 비밀번호가 달라요.');
  $('#pwSave').disabled = true;
  const { error } = await sb.auth.updateUser({ password: a });
  $('#pwSave').disabled = false;
  if (error) {
    return fail(/reauth|recent/i.test(error.message) ? '보안을 위해 로그아웃 후 메일 링크로 다시 들어와서 설정해 주세요.'
      : /weak|short|characters/i.test(error.message) ? '더 길거나 복잡한 비밀번호로 정해 주세요.'
      : /same|different/i.test(error.message) ? '지금 쓰는 비밀번호와 같아요.'
      : '비밀번호를 저장하지 못했어요: ' + error.message);
  }
  closePw();
  toast('비밀번호를 정했어요. 다음부터 메일 없이 로그인할 수 있어요');
});

/* ---------- data ---------- */
async function loadItems() {
  const { data, error } = await sb.from('items').select('*').order('updated_at', { ascending: false }).limit(5000);
  if (error) { setStatus('목록을 불러오지 못했어요. 새로고침해 주세요.'); return; }
  setStatus('');
  state.items = data || [];
  state.loaded = true;
  render();
}
async function loadSettings() {
  const { data } = await sb.from('settings').select('alert_days').eq('id', 1).maybeSingle();
  if (data?.alert_days) { state.alertDays = data.alert_days; $('#alertDays').value = String(data.alert_days); render(); }
}
let reloadTimer;
function scheduleReload() { clearTimeout(reloadTimer); reloadTimer = setTimeout(() => { loadItems(); loadSettings(); }, 300); }

async function enterApp(session) {
  const { data: member, error } = await sb.rpc('is_member');
  if (error || !member) {
    $('#deniedEmail').textContent = session.user.email || '';
    show('deniedView');
    return;
  }
  show('appView');
  render();
  await Promise.all([loadItems(), loadSettings()]);
  if (!state.channel) {
    state.channel = sb.channel('household')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, scheduleReload)
      .subscribe();
  }
}
function leaveApp() {
  if (state.channel) { sb.removeChannel(state.channel); state.channel = null; }
  state.items = []; state.loaded = false;
  show('loginView');
}

/* ---------- boot ---------- */
const cfg = window.APP_CONFIG || {};
let sb = null;
if (!window.supabase || !cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes('YOUR-PROJECT')) {
  setStatus('web/config.js 에 Supabase 주소와 anon 키를 넣어야 사용할 수 있어요.');
} else {
  sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  sb.auth.onAuthStateChange((event, session) => {
    // 콜백 안에서 바로 DB를 호출하면 교착될 수 있어 다음 틱으로 미룹니다.
    setTimeout(() => {
      const prev = state.session?.user?.id;
      state.session = session;
      if (!session) { leaveApp(); return; }
      if (prev !== session.user.id || $('#appView').hidden) enterApp(session);
    }, 0);
  });
  // 다른 탭에서 돌아왔을 때 날짜(D-day)가 바뀌었을 수 있으니 다시 그립니다.
  document.addEventListener('visibilitychange', () => { if (!document.hidden && state.loaded) scheduleReload(); });
}
