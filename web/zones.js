// 우리집 평면도와 수납 구역.
// 좌표는 viewBox(800 x 1000) 기준이에요. rect: [x, y, 너비, 높이], points: 다각형 꼭짓점, label: 방 이름 위치.
// kind: 'room'(방·공간) 또는 'storage'(수납장). storage 는 room 에 속한 방 이름을 적어요.
// short: 평면도 위에 짧게 표시할 이름 (없으면 id).
// 물건의 위치(items.room)에는 id(이름)가 그대로 저장돼요. id를 바꾸면 기존 물건은 '위치 미지정'으로 보이니 주의하세요.
window.HOME_PLAN = {
  viewBox: '0 0 800 1000',
  zones: [
    // ---- 방·공간 ----
    { id: '뒷발코니', kind: 'room', balcony: true, rect: [135, 30, 650, 120], label: [225, 92] },
    { id: '작은방',   kind: 'room', rect: [575, 160, 210, 225] },
    { id: '주방',     kind: 'room', rect: [345, 160, 220, 275], label: [500, 297] },
    { id: '컴퓨터방', kind: 'room', rect: [135, 165, 195, 265], label: [255, 297] },
    { id: '화장실',   kind: 'room', tile: true, rect: [565, 400, 175, 140], label: [632, 470] },
    { id: '현관',     kind: 'room', tile: true, rect: [165, 440, 100, 130], label: [215, 518] },
    { id: '거실',     kind: 'room', points: '555,445 275,445 275,580 160,580 160,855 455,855 455,555 555,555', label: [308, 715] },
    { id: '안방',     kind: 'room', rect: [465, 560, 320, 295], label: [605, 707] },
    { id: '다용도실', kind: 'room', small: true, balcony: true, rect: [680, 870, 105, 105] },
    { id: '베란다',   kind: 'room', balcony: true, rect: [25, 865, 645, 110], label: [400, 920] },

    // ---- 수납장 ----
    { id: '세탁기 선반',     short: '세탁기',     kind: 'storage', room: '뒷발코니', rect: [712, 38, 64, 104] },
    { id: '주방 창문 서랍장', short: '창문 서랍장', kind: 'storage', room: '뒷발코니', rect: [340, 38, 220, 42] },
    { id: '주방 상부장',      short: '상부장',      kind: 'storage', room: '주방',     rect: [350, 170, 42, 255] },
    { id: '주방 하부장',      short: '하부장',      kind: 'storage', room: '주방',     rect: [394, 170, 42, 255], badge: 'bottom' },
    { id: '컴퓨터방 서랍장',  short: '서랍장',      kind: 'storage', room: '컴퓨터방', rect: [140, 175, 34, 245] },
    { id: '컴퓨터 책상 서랍', short: '책상 서랍',   kind: 'storage', room: '컴퓨터방', rect: [188, 384, 116, 36] },
    { id: '화장실 상부장',    short: '상부장',      kind: 'storage', room: '화장실',   rect: [700, 406, 34, 128] },
    // 안방 붙박이장: 안에서 장을 바라볼 때 왼쪽(평면도 위쪽)부터 화장대 상부장·하부장, 1통, 2통, 3통
    { id: '안방 화장대 상부장', short: '화장대\n상부장', small: true, kind: 'storage', room: '안방', rect: [713, 566, 66, 56] },
    { id: '안방 화장대 하부장', short: '화장대\n하부장', small: true, kind: 'storage', room: '안방', rect: [713, 623, 66, 56] },
    { id: '붙박이장 1통',       short: '1통',                       kind: 'storage', room: '안방', rect: [713, 680, 66, 56] },
    { id: '붙박이장 2통',       short: '2통',                       kind: 'storage', room: '안방', rect: [713, 737, 66, 56] },
    { id: '붙박이장 3통',       short: '3통',                       kind: 'storage', room: '안방', rect: [713, 794, 66, 55] },
    { id: '현관 신발장',      short: '신발장',      kind: 'storage', room: '현관',     rect: [171, 446, 88, 32] },
    { id: '베란다 창고',      short: '창고',        kind: 'storage', room: '베란다',   rect: [32, 872, 100, 96] },
  ],
  // 예전에 쓰던 구역 이름 → 지금 보여줄 구역. 구역을 나누거나 이름을 바꿨을 때, 예전 물건이 '위치 미지정'으로 빠지지 않게 해요.
  legacy: {
    '주방 상/하부장': '주방',
    '안방 붙박이장': '안방',
  },
};
