// 우리집 평면도와 수납 구역.
// 좌표는 viewBox(800 x 1000) 기준이에요. rect: [x, y, 너비, 높이], points: 다각형 꼭짓점.
// kind: 'room'(방·공간) 또는 'storage'(수납장). storage 는 room 에 속한 방 이름을 적어요.
// short: 평면도 위에 짧게 표시할 이름 (없으면 id).
// 물건의 위치(items.room)에는 id(이름)가 그대로 저장돼요. id를 바꾸면 기존 물건은 '위치 미지정'으로 보이니 주의하세요.
window.HOME_PLAN = {
  viewBox: '0 0 800 1000',
  zones: [
    // ---- 방·공간 ----
    { id: '뒷발코니', kind: 'room', balcony: true, rect: [15, 30, 650, 120], label: [575, 92] },
    { id: '작은방',   kind: 'room', rect: [15, 160, 210, 225] },
    { id: '주방',     kind: 'room', rect: [235, 160, 220, 275], label: [328, 297] },
    { id: '컴퓨터방', kind: 'room', rect: [470, 165, 195, 265], label: [545, 297] },
    { id: '화장실',   kind: 'room', tile: true, rect: [60, 400, 175, 140], label: [168, 470] },
    { id: '현관',     kind: 'room', tile: true, rect: [535, 440, 100, 130] },
    { id: '거실',     kind: 'room', points: '245,445 525,445 525,580 640,580 640,855 345,855 345,555 245,555', label: [492, 715] },
    { id: '안방',     kind: 'room', rect: [15, 560, 320, 295], label: [195, 707] },
    { id: '다용도실', kind: 'room', small: true, balcony: true, rect: [15, 870, 105, 105] },
    { id: '베란다',   kind: 'room', balcony: true, rect: [130, 865, 645, 110], label: [400, 920] },

    // ---- 수납장 ----
    { id: '세탁기 선반',     short: '세탁기', kind: 'storage', room: '뒷발코니', rect: [24, 38, 64, 104] },
    { id: '주방 창문 서랍장', short: '창문 서랍장', kind: 'storage', room: '뒷발코니', rect: [240, 38, 220, 42] },
    { id: '주방 상/하부장',   short: '상/하부장',   kind: 'storage', room: '주방',     rect: [416, 170, 34, 255] },
    { id: '컴퓨터방 서랍장',  short: '서랍장',      kind: 'storage', room: '컴퓨터방', rect: [626, 175, 34, 245] },
    { id: '화장실 상부장',    short: '상부장',      kind: 'storage', room: '화장실',   rect: [66, 406, 34, 128] },
    { id: '안방 붙박이장',    short: '붙박이장',    kind: 'storage', room: '안방',     rect: [21, 566, 40, 283] },
    { id: '베란다 창고',      short: '창고',        kind: 'storage', room: '베란다',   rect: [668, 872, 100, 96] },
  ],
};
