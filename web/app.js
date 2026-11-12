'use strict';

const CATS = ['식료품', '의약품', '생활용품', '주방용품', '공구', '전자기기', '의류', '서류·귀중품', '기타'];
const UNPLACED = '__unplaced';
const PLAN = window.HOME_PLAN || { viewBox: '0 0 800 1000', zones: [] };
const ZONES = PLAN.zones;
const ZONE = new Map(ZONES.map((z) => [z.id, z]));
const ROOMS = ZONES.filter((z) => z.kind === 'room');
const childrenOf = (roomId) => ZONES.filter((z) => z.room === roomId);

const $ = (s) => document.querySelector(s);
const state = {
  items: [], alertDays: 3, q: '', selected: null, foodOnly: false, sort: 'recent',
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
  $('#pwBtn').hidden = !inApp;
}

/* ---------- zones ---------- */
const LEGACY = PLAN.legacy || {};
const zoneOf = (it) => {
  const raw = (it.room || '').trim();
  if (ZONE.has(raw)) return raw;
  if (ZONE.has(LEGACY[raw])) return LEGACY[raw];
  return UNPLACED;
};
const roomOfZone = (zid) => (ZONE.get(zid)?.kind === 'storage' ? ZONE.get(zid).room : zid);
const placeName = (it) => (it.room || '').trim() || '위치 미정';
function whereText(it) {
  return [placeName(it), it.spot].filter(Boolean).join(' › ');
}
function inSelection(it, sel) {
  if (!sel) return true;
  const z = zoneOf(it);
  if (sel === UNPLACED) return z === UNPLACED;
  if (ZONE.get(sel)?.kind === 'room') return z === sel || roomOfZone(z) === sel;
  return z === sel;
}
function termsOf() { return state.q.toLowerCase().split(/\s+/).filter(Boolean); }
const isFoodish = (it) => daysLeft(it.expiry) !== null || it.category === '식료품';
function passesFilters(it, terms) {
  if (state.foodOnly && !isFoodish(it)) return false;
  if (!terms.length) return true;
  const hay = [it.name, it.room, it.spot, it.memo, it.category, roomOfZone(zoneOf(it))].join(' ').toLowerCase();
  return terms.every((t) => hay.includes(t));
}
function worstTone(list) {
  if (list.some((it) => statusOf(it) === 'expired')) return 'expired';
  if (list.some((it) => statusOf(it) === 'soon')) return 'soon';
  return '';
}

/* ---------- 선입선출: 같은 물건끼리 기한 빠른 것부터 ---------- */
const normName = (s) => String(s || '').toLowerCase().replace(/\s+/g, '');
const byExpiry = (a, b) => daysLeft(a.expiry) - daysLeft(b.expiry);
// 이름이 같은 물건 중 유통기한이 있는 것들을 기한 순으로 묶어요. 2개 이상일 때만 순서가 의미 있어요.
function computeFifo() {
  const groups = new Map();
  for (const it of state.items) {
    if (daysLeft(it.expiry) === null) continue;
    const k = normName(it.name);
    if (!k) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(it);
  }
  const info = new Map();
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort(byExpiry);
    list.forEach((it, i) => info.set(it.id, { rank: i, total: list.length, first: list[0] }));
  }
  state.fifo = info;
}
const sameNameOthers = (name, exceptId) =>
  state.items.filter((it) => it.id !== exceptId && normName(it.name) === normName(name) && normName(name));

/* ---------- render ---------- */
function render() { computeFifo(); renderAlerts(); renderMap(); renderPanel(); }

function flaggedItems() {
  return state.items.filter((it) => ['expired', 'soon'].includes(statusOf(it)))
    .sort((a, b) => daysLeft(a.expiry) - daysLeft(b.expiry));
}
function alertRow(it) {
  const n = daysLeft(it.expiry), s = statusOf(it);
  return `<li><button type="button" class="alert-row" data-id="${esc(it.id)}">
      <span class="pill ${s}">${dLabel(n)}</span>
      <span><strong>${esc(it.name)}</strong> <span class="where">· ${esc(whereText(it))}</span></span>
      <span class="date">${esc(it.expiry)}</span>
    </button></li>`;
}

function renderAlerts() {
  const withExp = state.items.filter((it) => daysLeft(it.expiry) !== null);
  const flagged = flaggedItems();
  const nExp = flagged.filter((it) => statusOf(it) === 'expired').length;
  const nSoon = flagged.length - nExp;
  $('#alertCounts').innerHTML =
    (nExp ? `<span class="pill expired">지남 ${nExp}</span>` : '') +
    (nSoon ? `<span class="pill soon">임박 ${nSoon}</span>` : '') +
    (!flagged.length && withExp.length ? `<span class="pill ok">모두 여유</span>` : '');
  const list = $('#alertList');
  if (!state.loaded) { list.innerHTML = `<li class="alert-empty">불러오는 중…</li>`; renderNextUp(); return; }
  if (!withExp.length) { list.innerHTML = `<li class="alert-empty">유통기한을 입력한 물건이 아직 없어요. 식료품을 추가할 때 날짜를 넣으면 여기서 챙겨드려요.</li>`; renderNextUp(); return; }
  if (!flagged.length) { list.innerHTML = `<li class="alert-empty">${state.alertDays}일 안에 기한이 끝나는 물건이 없어요.</li>`; renderNextUp(); return; }
  list.innerHTML = flagged.map(alertRow).join('');
  renderNextUp();
}

// 알림 기준 밖이지만 기한이 가까운 순서로 다음에 쓸 물건 3개
function renderNextUp() {
  const next = state.items.filter((it) => statusOf(it) === 'ok').sort(byExpiry).slice(0, 3);
  $('#nextUp').hidden = !state.loaded || !next.length;
  $('#nextList').innerHTML = next.map(alertRow).join('');
}

/* 평면도 */
function zoneCenter(z) {
  if (z.label) return z.label;
  const [x, y, w, h] = z.rect;
  return [x + w / 2, y + h / 2];
}
function shapeSVG(z) {
  if (z.rect) {
    const [x, y, w, h] = z.rect;
    return `<rect class="shape" x="${x}" y="${y}" width="${w}" height="${h}" rx="${z.kind === 'storage' ? 4 : 0}"/>`;
  }
  return `<polygon class="shape" points="${z.points}"/>`;
}
function badgeSVG(cx, cy, n, tone) {
  return `<g class="badge ${tone}" aria-hidden="true"><circle cx="${cx}" cy="${cy}" r="17"/><text x="${cx}" y="${cy}">${n > 99 ? '99+' : n}</text></g>`;
}

function renderMap() {
  const terms = termsOf();
  const searching = terms.length > 0 || state.foodOnly;
  const visible = state.items.filter((it) => passesFilters(it, terms));
  const direct = new Map();
  for (const it of visible) { const z = zoneOf(it); if (!direct.has(z)) direct.set(z, []); direct.get(z).push(it); }
  const totalOf = (z) => z.kind === 'room'
    ? [...(direct.get(z.id) || []), ...childrenOf(z.id).flatMap((c) => direct.get(c.id) || [])]
    : (direct.get(z.id) || []);

  const sel = state.selected;
  const selRoom = sel && sel !== UNPLACED ? roomOfZone(sel) : null;
  const zoneG = (z) => {
    const list = totalOf(z);
    const n = list.length;
    const cls = ['zone', z.kind, z.balcony ? 'balcony' : '', z.tile ? 'tile' : '', z.fridge ? 'fridge' : '',
      sel === z.id ? 'selected' : '', selRoom === z.id && sel !== z.id ? 'parent' : '',
      searching ? (n ? 'hit' : 'dim') : ''].filter(Boolean).join(' ');
    const label = `${z.id}, 물건 ${n}개${worstTone(list) === 'expired' ? ', 기한 지난 물건 있음' : worstTone(list) === 'soon' ? ', 기한 임박 물건 있음' : ''}`;
    let inner = shapeSVG(z);
    if (z.kind === 'room') {
      const [cx, cy] = zoneCenter(z);
      const tone = worstTone(list);
      inner += `<text class="room-name${z.small ? ' small' : ''}" x="${cx}" y="${cy - 10}">${esc(z.id)}</text>`;
      inner += `<text class="room-count ${tone}" x="${cx}" y="${cy + 22}">${n ? `${n}개` : '비어 있음'}</text>`;
    } else {
      const [x, y, w, h] = z.rect;
      const vertical = h > w * 1.5;
      const cx = x + w / 2, cy = y + h / 2;
      const lines = String(z.short || z.id).split('\n');
      const cls = `store-name${z.small ? ' small' : ''}`;
      const rot = vertical ? ` transform="rotate(-90 ${cx} ${cy})"` : '';
      inner += lines.length === 1
        ? `<text class="${cls}" x="${cx}" y="${cy}"${rot}>${esc(lines[0])}</text>`
        : `<text class="${cls}" x="${cx}" y="${cy}"${rot}>${lines.map((l, i) => `<tspan x="${cx}" dy="${i === 0 ? -(lines.length - 1) * 11 : 22}">${esc(l)}</tspan>`).join('')}</text>`;
      const dn = (direct.get(z.id) || []).length;
      if (dn) {
        const tone = worstTone(direct.get(z.id));
        inner += !vertical ? badgeSVG(x + w - 4, y + 4, dn, tone)
          : z.badge === 'bottom' ? badgeSVG(x + w / 2, y + h - 4, dn, tone)
          : badgeSVG(x + w / 2, y + 4, dn, tone);
      }
    }
    return `<g class="${cls}" data-zone="${esc(z.id)}" tabindex="0" role="button" aria-pressed="${sel === z.id}" aria-label="${esc(label)}">${inner}</g>`;
  };
  $('#plan').innerHTML = `<svg viewBox="${PLAN.viewBox}" xmlns="http://www.w3.org/2000/svg">
    ${ROOMS.map(zoneG).join('')}
    ${ZONES.filter((z) => z.kind === 'storage').map(zoneG).join('')}
  </svg>`;

  const unplaced = direct.get(UNPLACED) || [];
  const ub = $('#unplacedBtn');
  ub.hidden = !unplaced.length;
  ub.setAttribute('aria-pressed', String(sel === UNPLACED));
  ub.innerHTML = `위치 미지정<span class="n">${unplaced.length}</span>`;
  $('#allBtn').hidden = !sel;
}

/* 오른쪽(아래쪽) 목록 */
function itemRow(it, terms) {
  const n = daysLeft(it.expiry), s = statusOf(it);
  const qty = it.qty != null && Number(it.qty) !== 1 ? `<span class="qty">×${esc(it.qty)}</span>` : '';
  const z = zoneOf(it);
  const tag = placeName(it);
  const meta = [it.category ? hl(it.category, terms) : '', it.memo ? hl(it.memo, terms) : ''].filter(Boolean).join(' · ');
  const f = state.fifo?.get(it.id);
  const fifoBadge = f && f.rank === 0 ? `<span class="fifo-badge">먼저 쓰기</span>` : '';
  const fifoNote = f && f.rank > 0
    ? `<span class="fifo-note">먼저 쓸 것: ${esc(whereText(f.first))} (${dLabel(daysLeft(f.first.expiry))})</span>` : '';
  return `<li><button type="button" class="item" data-id="${esc(it.id)}" aria-label="${esc(it.name)} 편집">
      <span class="body">
        <span class="name">${hl(it.name, terms)}${qty}${fifoBadge}</span>
        <span class="loc"><span class="tag">${hl(tag, terms)}</span>${it.spot ? `<span class="spot">${hl(it.spot, terms)}</span>` : ''}</span>
        ${fifoNote}
        ${meta ? `<span class="meta">${meta}</span>` : ''}
      </span>
      <span class="dd">${n === null ? '' : `<span class="pill ${s}">${dLabel(n)}</span><span class="date">${esc(it.expiry)}</span>`}</span>
    </button></li>`;
}

function renderPanel() {
  const ul = $('#items');
  const terms = termsOf();
  const sel = state.selected;
  const z = sel && sel !== UNPLACED ? ZONE.get(sel) : null;

  $('#panelEyebrow').textContent = !sel ? (terms.length ? '검색 결과' : '집 전체')
    : sel === UNPLACED ? '구역이 정해지지 않은 물건'
    : z.kind === 'storage' ? `${z.room} 안의 수납장` : (childrenOf(z.id).length ? `${childrenOf(z.id).map((c) => c.id).join(', ')} 포함` : '방');
  $('#listTitle').textContent = !sel ? (terms.length ? `‘${state.q}’` : '모든 물건') : sel === UNPLACED ? '위치 미지정' : sel;
  $('#panelAdd').hidden = !sel || sel === UNPLACED;
  $('#panelAdd').textContent = sel && sel !== UNPLACED ? `＋ ${sel}에 추가` : '＋ 물건 추가';
  $('#foodToggle').setAttribute('aria-pressed', String(state.foodOnly));
  $('#sort').value = state.sort;

  if (!state.loaded) { ul.innerHTML = ''; $('#listCount').textContent = ''; return; }
  if (!state.items.length) {
    ul.innerHTML = `<li class="empty">
      <strong>아직 등록된 물건이 없어요</strong>
      <span>평면도에서 방이나 수납장을 누른 뒤 ‘여기에 추가’로 첫 물건을 넣어 보세요.</span>
      <button type="button" class="btn primary" data-action="add">물건 추가</button>
    </li>`;
    $('#listCount').textContent = '';
    return;
  }

  const rows = state.items.filter((it) => inSelection(it, sel) && passesFilters(it, terms));
  const byName = (a, b) => (a.name || '').localeCompare(b.name || '', 'ko');
  const sorters = {
    recent: (a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')),
    name: byName,
    expiry: (a, b) => (daysLeft(a.expiry) ?? 1e9) - (daysLeft(b.expiry) ?? 1e9) || byName(a, b),
  };
  rows.sort(sorters[state.sort] || sorters.recent);
  $('#listCount').textContent = String(rows.length);

  if (!rows.length) {
    const what = terms.length ? `‘${esc(state.q)}’에 맞는 물건이 없어요` : state.foodOnly ? '유통기한 있는 물건이 없어요' : '아직 여기에 둔 물건이 없어요';
    ul.innerHTML = `<li class="empty"><strong>${what}</strong>
      <span>${sel && sel !== UNPLACED && !terms.length ? `‘${esc(sel)}’에 무엇이 있는지 적어 두세요.` : '다른 이름이나 구역으로 찾아보세요.'}</span>
      ${sel && sel !== UNPLACED && !terms.length ? `<button type="button" class="btn primary" data-action="add">${esc(sel)}에 추가</button>` : ''}
    </li>`;
    return;
  }

  // 방을 골랐으면 방 바닥 / 수납장별로 묶어서 보여줌
  if (z && z.kind === 'room' && childrenOf(z.id).length) {
    const groups = [z.id, ...childrenOf(z.id).map((c) => c.id)]
      .map((gid) => [gid, rows.filter((it) => zoneOf(it) === gid)])
      .filter(([, list]) => list.length);
    ul.innerHTML = groups.map(([gid, list]) =>
      `<li class="group-head"><button type="button" class="linklike" data-zone-pick="${esc(gid)}">${esc(gid === z.id ? `${gid} (수납장 밖)` : gid)}</button><span class="n">${list.length}</span></li>` +
      list.map((it) => itemRow(it, terms)).join('')).join('');
    return;
  }
  ul.innerHTML = rows.map((it) => itemRow(it, terms)).join('');
}

function selectZone(id) {
  state.selected = state.selected === id ? null : id;
  renderMap(); renderPanel();
  if (state.selected) {
    $('.zone-panel').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }
}

/* 접속했을 때 띄우는 유통기한 팝업: 브라우저 탭마다 한 번, '오늘 하루 보지 않기'를 누르면 그날은 안 띄움 */
function maybeShowExpiryPopup() {
  const flagged = flaggedItems();
  if (!flagged.length) return;
  const today = fmtDate(today0());
  try {
    if (localStorage.getItem('expPopupHiddenOn') === today) return;
    if (sessionStorage.getItem('expPopupShown')) return;
    sessionStorage.setItem('expPopupShown', '1');
  } catch {}
  const nExp = flagged.filter((it) => statusOf(it) === 'expired').length;
  const nSoon = flagged.length - nExp;
  $('#expSummary').textContent = [
    nExp ? `기한이 지난 물건 ${nExp}개` : '',
    nSoon ? `${state.alertDays}일 안에 기한이 끝나는 물건 ${nSoon}개` : '',
  ].filter(Boolean).join(', ') + '가 있어요. 누르면 편집할 수 있어요.';
  $('#expList').innerHTML = flagged.map(alertRow).join('');
  $('#expScrim').hidden = false;
  setTimeout(() => $('#expOk').focus(), 30);
}
function closeExp() { $('#expScrim').hidden = true; }
$('#expOk').addEventListener('click', closeExp);
$('#expHideToday').addEventListener('click', () => {
  try { localStorage.setItem('expPopupHiddenOn', fmtDate(today0())); } catch {}
  closeExp();
  toast('오늘은 알림 팝업을 띄우지 않을게요');
});
$('#expScrim').addEventListener('click', (e) => {
  if (e.target === $('#expScrim')) { closeExp(); return; }
  const row = e.target.closest('[data-id]');
  if (row) { closeExp(); const it = state.items.find((x) => x.id === row.dataset.id); if (it) openSheet(it); }
});

/* ---------- edit sheet ---------- */
$('#f-cat').innerHTML = CATS.map((c) => `<option>${c}</option>`).join('');

function fillZoneSelect(current) {
  const opts = ['<option value="">구역 선택 안 함</option>'];
  if (current && !ZONE.has(current)) opts.push(`<option value="${esc(current)}">${esc(current)} (예전 위치)</option>`);
  for (const r of ROOMS) {
    const kids = childrenOf(r.id);
    opts.push(`<optgroup label="${esc(r.id)}"><option value="${esc(r.id)}">${esc(r.id)}${kids.length ? ' (바닥·기타)' : ''}</option>${kids.map((k) => `<option value="${esc(k.id)}">${esc(k.id)}</option>`).join('')}</optgroup>`);
  }
  $('#f-room').innerHTML = opts.join('');
  $('#f-room').value = current || '';
}

function openSheet(item) {
  state.editing = item ? item.id : null;
  $('#formTitle').textContent = item ? '물건 편집' : '물건 추가';
  $('#f-name').value = item?.name || '';
  $('#f-cat').value = item?.category || (state.foodOnly ? '식료품' : '생활용품');
  $('#f-qty').value = item?.qty ?? 1;
  const sel = state.selected && state.selected !== UNPLACED ? state.selected : '';
  fillZoneSelect(item ? (item.room || '').trim() : sel);
  $('#f-spot').value = item?.spot || '';
  $('#f-expiry').value = item?.expiry || '';
  $('#f-memo').value = item?.memo || '';
  $('#formErr').hidden = true;
  const del = $('#delBtn'); del.hidden = !item; del.classList.remove('armed'); del.textContent = '다 썼어요 (삭제)';
  const q = Number(item?.qty);
  const use = $('#useBtn'); use.hidden = !item || !(q > 1); use.disabled = false;
  if (!use.hidden) use.textContent = `1개 썼어요 (남은 ${q}개 → ${q - 1}개)`;
  syncSpots();
  updateFifoHint();
  $('#scrim').hidden = false;
  setTimeout(() => $('#f-name').focus(), 30);
}
function closeSheet() { $('#scrim').hidden = true; state.editing = null; }
function syncSpots() {
  const room = $('#f-room').value;
  const spots = [...new Set(state.items.filter((it) => !room || (it.room || '').trim() === room).map((it) => it.spot).filter(Boolean))];
  $('#spotList').innerHTML = spots.map((s) => `<option value="${esc(s)}">`).join('');
}

// 같은 이름의 물건이 이미 있으면, 어디 있는지와 어느 것부터 쓸지 알려줘요.
function updateFifoHint() {
  const box = $('#fifoHint');
  const name = $('#f-name').value.trim();
  const others = name ? sameNameOthers(name, state.editing) : [];
  if (!others.length) { box.hidden = true; box.innerHTML = ''; return; }
  const dated = others.filter((it) => daysLeft(it.expiry) !== null).sort(byExpiry);
  const shown = (dated.length ? dated : others).slice(0, 3);
  const row = (it) => `<li>${esc(whereText(it))}${daysLeft(it.expiry) !== null ? ` <span class="pill ${statusOf(it)}">${dLabel(daysLeft(it.expiry))}</span>` : ''}${Number(it.qty) > 1 ? ` ×${esc(it.qty)}` : ''}</li>`;
  const mine = daysLeft($('#f-expiry').value);
  const earliest = dated[0];
  let advice = '';
  if (earliest && mine !== null) {
    advice = mine < daysLeft(earliest.expiry)
      ? (state.editing ? '이게 기한이 가장 빨라요. 이것부터 쓰세요.' : '새로 넣는 게 기한이 더 빨라요. 이것부터 쓰세요.')
      : (state.editing ? `‘${esc(whereText(earliest))}’ 것을 먼저 쓰세요.` : '새 것은 안쪽·뒤쪽에 두고, 있던 것부터 쓰세요.');
  } else if (earliest && !state.editing) {
    advice = '유통기한을 넣으면 어느 것부터 쓸지 알려드려요.';
  }
  box.innerHTML = `<strong>${state.editing ? '같은 물건이 더 있어요' : '집에 같은 물건이 있어요'}</strong>
    <ul>${shown.map(row).join('')}${others.length > shown.length ? `<li>외 ${others.length - shown.length}개</li>` : ''}</ul>
    ${advice ? `<p>${advice}</p>` : ''}`;
  box.hidden = false;
}
let hintTimer;
$('#f-name').addEventListener('input', () => { clearTimeout(hintTimer); hintTimer = setTimeout(updateFifoHint, 150); });
$('#f-expiry').addEventListener('change', updateFifoHint);
$('#f-room').addEventListener('change', syncSpots);
$('#qtyMinus').addEventListener('click', () => { $('#f-qty').value = Math.max(0, (Number($('#f-qty').value) || 0) - 1); });
$('#qtyPlus').addEventListener('click', () => { $('#f-qty').value = (Number($('#f-qty').value) || 0) + 1; });
document.querySelectorAll('.quick button').forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.add === '') { $('#f-expiry').value = ''; return; }
  const d = today0(); d.setDate(d.getDate() + Number(b.dataset.add)); $('#f-expiry').value = fmtDate(d);
  updateFifoHint();
}));
$('#cancelBtn').addEventListener('click', closeSheet);
$('#scrim').addEventListener('click', (e) => { if (e.target === $('#scrim')) closeSheet(); });

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
    room: $('#f-room').value,
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
  toast(editing ? '수정했어요' : `‘${name}’${data.room ? `을(를) ${data.room}에` : ''} 저장했어요`);
  loadItems();
});

$('#delBtn').addEventListener('click', async () => {
  const b = $('#delBtn');
  if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = '한 번 더 누르면 삭제'; return; }
  if (!state.editing) return;
  const name = state.items.find((it) => it.id === state.editing)?.name || '';
  const nextHint = nextOfText(name, state.editing);
  const { error } = await sb.from('items').delete().eq('id', state.editing);
  if (error) { $('#formErr').textContent = '삭제하지 못했어요.'; $('#formErr').hidden = false; return; }
  closeSheet(); toast(`‘${name}’ 다 썼어요${nextHint}`); loadItems();
});

// 하나를 다 썼을 때 다음에 쓸 같은 물건 안내
function nextOfText(name, exceptId) {
  const next = sameNameOthers(name, exceptId).filter((it) => daysLeft(it.expiry) !== null).sort(byExpiry)[0]
    || sameNameOthers(name, exceptId)[0];
  return next ? ` · 다음은 ${whereText(next)}${daysLeft(next.expiry) !== null ? ` (${dLabel(daysLeft(next.expiry))})` : ''}` : '';
}

// 수량 하나만 줄이기 (여러 개 있는 물건)
$('#useBtn').addEventListener('click', async () => {
  const it = state.items.find((x) => x.id === state.editing);
  if (!it) return;
  const left = Math.max(0, Number(it.qty) - 1);
  $('#useBtn').disabled = true;
  const { error } = await sb.from('items').update({ qty: left }).eq('id', it.id);
  $('#useBtn').disabled = false;
  if (error) { $('#formErr').textContent = dbErrorText(error); $('#formErr').hidden = false; return; }
  closeSheet(); toast(`‘${it.name}’ 1개 썼어요 · 남은 ${left}개`); loadItems();
});

// 홈의 '기한 순서 전체 보기': 유통기한 있는 물건만, 기한 빠른 순으로
$('#fifoAllBtn').addEventListener('click', () => {
  state.foodOnly = true; state.sort = 'expiry'; state.selected = null;
  renderMap(); renderPanel();
  $('.zone-panel').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
});

/* ---------- interactions ---------- */
$('#addBtn').addEventListener('click', () => openSheet(null));
$('#panelAdd').addEventListener('click', () => openSheet(null));
$('#allBtn').addEventListener('click', () => { state.selected = null; renderMap(); renderPanel(); });
function setPlanOpen(open) {
  $('#planBody').hidden = !open;
  $('#planToggle').setAttribute('aria-expanded', String(open));
  $('#planLayout').classList.toggle('collapsed', !open);
  $('#planHint').textContent = open ? '눌러서 접기' : '눌러서 펼치기';
}
$('#planToggle').addEventListener('click', () => setPlanOpen($('#planBody').hidden));
$('#unplacedBtn').addEventListener('click', () => selectZone(UNPLACED));
$('#foodToggle').addEventListener('click', () => { state.foodOnly = !state.foodOnly; renderMap(); renderPanel(); });
let qTimer;
$('#q').addEventListener('input', (e) => { clearTimeout(qTimer); qTimer = setTimeout(() => { state.q = e.target.value.trim(); renderMap(); renderPanel(); }, 80); });
$('#plan').addEventListener('click', (e) => { const g = e.target.closest('[data-zone]'); if (g) selectZone(g.dataset.zone); });
$('#plan').addEventListener('keydown', (e) => {
  const g = e.target.closest('[data-zone]');
  if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selectZone(g.dataset.zone); }
});
document.addEventListener('click', (e) => {
  const pick = e.target.closest('[data-zone-pick]');
  if (pick) { selectZone(pick.dataset.zonePick); return; }
  const row = e.target.closest('[data-id]');
  if (row && !row.closest('.scrim')) { const it = state.items.find((x) => x.id === row.dataset.id); if (it) openSheet(it); return; }
  if (e.target.closest('[data-action="add"]')) openSheet(null);
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('#scrim').hidden) closeSheet();
  else if (!$('#pwScrim').hidden) closePw();
  else if (!$('#expScrim').hidden) closeExp();
});
$('#sort').addEventListener('change', (e) => { state.sort = e.target.value; try { localStorage.setItem('sort', state.sort); } catch {} renderPanel(); });
$('#alertDays').addEventListener('change', async (e) => {
  state.alertDays = Number(e.target.value); render();
  const { error } = await sb.from('settings').update({ alert_days: state.alertDays }).eq('id', 1);
  toast(error ? '알림 기준을 저장하지 못했어요' : `남은 기간 ${state.alertDays}일 이하면 알려드릴게요`);
});
try { const s = localStorage.getItem('sort'); if (s && ['recent', 'expiry', 'name'].includes(s)) state.sort = s; } catch {}

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
      ? '메일은 잠시 뒤에 다시 보낼 수 있어요. 받은 메일이 있다면 그 링크를 눌러 주세요.'
      : '로그인 메일을 보내지 못했어요: ' + error.message);
    linkCooldown = error.status === 429 ? wait : 0;
  } else {
    loginMsg(`${email} 로 로그인 링크를 보냈어요. 메일함(스팸함 포함)을 확인해 주세요.`);
    linkCooldown = 60;
  }
  clearTimeout(linkTimer); tickLink();
});
$('#signOutBtn').addEventListener('click', async () => { $('#pwScrim').hidden = true; await sb.auth.signOut(); });

/* 설정 (알림 기준 + 비밀번호) */
function closePw() { $('#pwScrim').hidden = true; }
$('#pwBtn').addEventListener('click', () => {
  const email = state.session?.user?.email || '';
  $('#pwEmail').textContent = email; $('#pwUser').value = email;
  $('#pwNew').value = ''; $('#pwNew2').value = ''; $('#pwErr').hidden = true;
  $('#alertDays').value = String(state.alertDays);
  $('#pwScrim').hidden = false;
  setTimeout(() => $('#alertDays').focus(), 30);
});
$('#pwCancel').addEventListener('click', closePw);
$('#pwScrim').addEventListener('click', (e) => { if (e.target === $('#pwScrim')) closePw(); });
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
    return fail(/reauth|recent/i.test(error.message) ? '보안을 위해 로그아웃 후 다시 로그인해서 설정해 주세요.'
      : /weak|short|characters/i.test(error.message) ? '더 길거나 복잡한 비밀번호로 정해 주세요.'
      : /same|different/i.test(error.message) ? '지금 쓰는 비밀번호와 같아요.'
      : '비밀번호를 저장하지 못했어요: ' + error.message);
  }
  closePw();
  toast('비밀번호를 바꿨어요');
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
  maybeShowExpiryPopup();
  if (!state.channel) {
    state.channel = sb.channel('household')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, scheduleReload)
      .subscribe();
  }
}
function leaveApp() {
  if (state.channel) { sb.removeChannel(state.channel); state.channel = null; }
  state.items = []; state.loaded = false; state.selected = null;
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
  // 다른 탭에서 돌아왔을 때 날짜(D-day)가 바뀌었을 수 있으니 다시 불러옵니다.
  document.addEventListener('visibilitychange', () => { if (!document.hidden && state.loaded) scheduleReload(); });
}
