// ── 자음 그룹: 대표 자음 입력 직후 다음키(K)를 누르면 그룹 내에서 순차 전환 ──
const consonantGroups = {
  'क': ['क','ख'],
  'ग': ['ग','घ'],
  'च': ['च','छ'],
  'ज': ['ज','झ'],
  'ट': ['ट','ठ'],
  'ड': ['ड','ढ'],
  'त': ['त','थ'],
  'द': ['द','ध'],
  'न': ['न','ण','ञ'],
  'प': ['प','फ'],
  'ब': ['ब','भ'],
  'म': ['म','ङ'],
  'र': ['र','ल','ळ'],
  'ह': ['ह','य','व'],
  'स': ['स','श','ष'],
};

const leftKeys = [
  ['ब','द','त','न','च'],
  ['प','क','ह','र','ड'],
  ['ग','ज','स','म','ट'],
];

// 다음키(K, 홈로우 우측 중지 위치)를 중심으로 상/하/좌/우/대각선에 배치되는 모음·부호키
// indep: 독립모음 모드일 때 대체 표시/입력되는 문자 (없으면 chars 그대로 유지)
const rightKeys = [
  [
    { id:'U', type:'sign', chars:['ं','ँ'], indep:['ॐ'] },
    { id:'I', type:'sign', chars:['े','ै'], indep:['ए','ऐ'] },
    { id:'O', type:'sign', chars:['ो','ौ'], indep:['ओ','औ'] },
  ],
  [
    { id:'J', type:'sign', chars:['ि'], indep:['इ'] },
    { id:'K', type:'next' },
    { id:'L', type:'sign', chars:['ा','ी','ः'], indep:['आ','ई'] },
  ],
  [
    { id:'N', type:'sign', chars:['्','़'], indep:['卐','卍'] },
    { id:'M', type:'sign', chars:['ु','ू','ृ'], indep:['उ','ऊ','ऋ'] },
    { id:'DANDA', type:'danda' }, // 삭제키 폐지, 그 자리로 danda(।/॥/…/.)가 이동
  ],
];

let state = {
  activeRoot: null,
  activeCharIdx: 0,
  lastSignKey: null,
  signTapIdx: 0,
  signIndepMode: false,
  independentMode: false,
  // 영문(로마자) 모드 상태
  engActive: false,       // true면 쿼티 자판 표시 중
  engShiftState: 'off',   // 'lock'(캡스락) | 'once'(다음 한 글자만 대문자) | 'off'(소문자)
};

// 상용구(즐겨찾기) 패널이 좌측 스와이프로 열려 있는 동안, 가운데 스와이프의 "다른
// 모드일 때는 복귀" 판정에 쓰인다(숫자판과 동일한 패턴). 패널을 여는/닫는 경로가
// 여러 곳(좌측 스와이프, 물리 버튼, 상용구 삽입, 패널 안 닫기 버튼)이라 showFavorites/
// hideFavorites 두 함수에만 플래그 관리를 몰아두고 나머지는 그 함수를 거치게 한다.
let favoritesMode = false;

// ── 숫자/기호 자판 상태 ──
let numericMode = false;

// 힌디 또는 영문 소문자만 "기본 모드"로 친다 — 대문자(약어)/숫자·기호/상용구는 전부
// "기타(임시) 모드"다. 임시 모드 안에서 중앙 스와이프 1회("나가기")나 각 모드 자체의
// 닫기 제스처는 항상 임시 모드에 처음 들어가기 직전의 기본 모드로 돌아가야 하고,
// 임시 모드끼리 서로 넘나들어도(예: 대문자 상태에서 숫자판으로) 이 기억은 안 바뀌어야
// 한다 — 안 그러면 "대문자 모드가 복귀 대상으로 잘못 먹혀서" 대문자에서 숫자판 갔다가
// 나가면 힌디/영문이 아니라 다시 대문자로 돌아와버리는 문제가 생긴다. 그래서 기본
// 모드에서 실제로 벗어나는 그 순간에만(아직 임시 모드가 아닐 때만) 갱신한다.
let baseModeIsEnglish = false; // false=힌디, true=영문 소문자

// 호스트 페이지가 지정하지 않으면 #editor 엘리먼트를 기본 입력 대상으로 삼는다
// (mobile_demo.html의 원래 방식). 상용구 편집 화면처럼 여러 입력 대상이 있는
// 페이지는 KB_setEditorAdapter로 "현재 포커스된 대상"을 갈아 끼운다.
let editorAdapter = {
  getText() {
    const el = document.getElementById('editor');
    return el ? (el.dataset.text || '') : '';
  },
  setText(t) {
    const el = document.getElementById('editor');
    if (!el) return;
    el.dataset.text = t;
    const esc = t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    el.innerHTML = esc + `<span class="cursor">|</span>`;
  },
};
function KB_setEditorAdapter(adapter) { editorAdapter = adapter; }
function getText() { return editorAdapter.getText(); }
function setText(t) { editorAdapter.setText(t); }
function appendText(c) { setText(getText() + c); }
function replaceLastChar(c) { const t=getText(); if(!t.length)return; setText(t.slice(0,-1)+c); }
function backspace() { const t=getText(); if(!t.length)return; setText(t.slice(0,-1)); }

function getRootOf(char) {
  for (const [root, arr] of Object.entries(consonantGroups)) if (arr.includes(char)) return root;
  return null;
}

// 독립모음 모드는 오직 스페이스바를 눌렀을 때만 진입한다
function independentActive() {
  if (state.independentMode) return true;
  return getText().endsWith(' ');
}

function handleConsonant(root) {
  appendText(root);
  state.activeRoot = root; state.activeCharIdx = 0;
  state.lastSignKey = null; state.signTapIdx = 0;
  state.independentMode = false;
  render();
}

function handleNext() {
  if (independentActive()) {
    if (state.lastSignKey === 'K' && state.signIndepMode) { return; } // 'अ' 하나뿐, 재입력 없음
    const t = getText();
    if (t.endsWith(' ')) setText(t.slice(0, -1));
    appendText('अ');
    state.independentMode = true;
    state.lastSignKey = 'K'; state.signTapIdx = 0; state.signIndepMode = true;
    state.activeRoot = null; state.activeCharIdx = 0;
    render(); return;
  }
  if (!state.activeRoot) return;
  const arr = consonantGroups[state.activeRoot];
  const nextIdx = (state.activeCharIdx + 1) % arr.length;
  replaceLastChar(arr[nextIdx]);
  state.activeCharIdx = nextIdx;
  state.lastSignKey = null; state.signTapIdx = 0;
  render();
}

function handleVowelKey(def) {
  const isIndep = independentActive();
  // 독립모음 모드에서는 독립모음 한 바퀴를 다 돈 다음 의존모음 한 바퀴, 다시 독립모음 순으로 순환한다
  const chars = isIndep ? (def.indep ? def.indep.concat(def.chars) : def.chars) : def.chars;

  if (state.lastSignKey === def.id && state.signIndepMode === isIndep) {
    state.signTapIdx = (state.signTapIdx + 1) % chars.length;
    const t = getText(); setText(t.slice(0, -1) + chars[state.signTapIdx]);
  } else {
    if (isIndep) {
      const t = getText();
      if (t.endsWith(' ')) setText(t.slice(0, -1));
      appendText(chars[0]);
      state.independentMode = true;
    } else {
      appendText(chars[0]);
    }
    state.lastSignKey = def.id; state.signTapIdx = 0; state.signIndepMode = isIndep;
  }
  state.activeRoot = null; state.activeCharIdx = 0;
  render();
}

// ● 키(스페이스와 엔터 사이): 다이렉트로 단다(।)/이중단다(॥)/줄임표(...)를 순환
// 입력한다. 3연타부터는 점을 하나씩 계속 추가한다(상한 없음). 독립모음 모드와
// 무관하게 항상 같은 동작이며, 다른 키를 누르면(lastSignKey가 바뀌면) 처음부터
// 다시 시작한다.
function dandaSeq(idx) {
  if (idx === 0) return '।';
  if (idx === 1) return '॥';
  return '.'.repeat(idx + 1);
}

function handleDanda() {
  if (state.lastSignKey === 'DANDA') {
    const prev = dandaSeq(state.signTapIdx);
    const t = getText();
    setText(t.slice(0, -prev.length));
    state.signTapIdx += 1;
    appendText(dandaSeq(state.signTapIdx));
  } else {
    appendText(dandaSeq(0));
    state.lastSignKey = 'DANDA'; state.signTapIdx = 0; state.signIndepMode = false;
  }
  state.activeRoot = null; state.activeCharIdx = 0;
  state.independentMode = false;
  render();
}

function handleBS() {
  backspace();
  state.lastSignKey = null; state.signTapIdx = 0; state.independentMode = false;
  const t = getText();
  const last = t.length ? t[t.length - 1] : null;
  const root = last ? getRootOf(last) : null;
  state.activeRoot = root;
  state.activeCharIdx = root ? consonantGroups[root].indexOf(last) : 0;
  render();
}

function handleSpace() {
  appendText(' ');
  state.activeRoot = null; state.activeCharIdx = 0;
  state.lastSignKey = null; state.signTapIdx = 0;
  state.independentMode = false;
  render();
}

// 하단바의 쉼표/느낌표/물음표 키 공용 핸들러 — 셋 다 멀티탭 없이 한 글자만 입력한다.
function handlePunct(ch) {
  appendText(ch);
  state.activeRoot = null; state.activeCharIdx = 0;
  state.lastSignKey = null; state.signTapIdx = 0;
  state.independentMode = false;
  render();
}

// 엔터키 라벨: 배경 이미지엔 일부러 안 그려 넣는다(실제 제품에서는 return/go/search/
// send/done처럼 OS·입력 상황에 따라 라벨이 바뀌므로 항상 런타임에 그려야 함) — 힌디/
// 영문 모드가 공유해서 쓰는 헬퍼. [left,right]는 BOT_SECTIONS.enter/ENG_BOT.enter처럼
// 실제 키 시각적 위치(확장 전 히트박스가 아니라)를 넘겨준다.
function makeEnterLabel(rect, top, height) {
  const label = document.createElement('div');
  label.className = 'kbd-enter-label';
  Object.assign(label.style, { left: rect[0] + '%', top: top + '%', width: (rect[1] - rect[0]) + '%', height: height + '%' });
  label.textContent = 'Enter';
  return label;
}

function handleEnter() {
  appendText('\n');
  state.activeRoot = null; state.activeCharIdx = 0;
  state.lastSignKey = null; state.signTapIdx = 0;
  state.independentMode = false;
  render();
}

// ── 숫자/기호 자판 데이터 (images/bg_numeric_keyboard.png 실측 기준, 칸마다 글자 하나씩
// 이미 그려져 있어 멀티탭/순환 없이 그대로 한 글자만 입력한다) ──────────────
const NUM_ROWS = [
  ['!','@','#','₹','%','^','&','*','(',')'],
  ['1','2','3','4','5','6','7','8','9','0'],
  ['`','~','{','}','\\','|',';',':',"'",'"'],
  ['_','+','[',']','<','>',',','.','/','?'],
];

function handleNumSingle(ch) { appendText(ch); render(); }
function handleNumSpace() { appendText(' '); render(); }
function handleNumEnter() { appendText('\n'); render(); }

// 스와이프 삭제(handleSwipeDelete)가 숫자판 모드일 때 재사용한다 — 물리 키는 없다.
function handleNumBS() {
  backspace();
  render();
}

// 자판 이미지는 numericMode/engActive 조합에 따라 셋 중 하나만 있을 수 있다 —
// 모드 전환 함수마다 따로 계산하면 한 곳만 고치고 잊어버리기 쉬워서(실제로 숫자판을
// 한 번 거친 뒤 약어 모드를 껐다 켜면 화면이 안 맞는 버그가 났었다) 한 군데로 모았다.
function updateKbdImage() {
  document.getElementById('kbd-image').src = numericMode
    ? 'images/bg_numeric_keyboard.png'
    : (state.engActive ? 'images/keyboard_eng.png' : 'images/keyboard.png');
}

// 우측 1/3 스와이프로 진입. 이미 다른 임시 모드(대문자/상용구) 안이었다면 기본 모드
// 기억(baseModeIsEnglish)을 건드리지 않는다 — 대문자에서 숫자판으로 넘어온 경우처럼.
function enterNumericMode() {
  if (numericMode) return;
  if (!isTemporaryMode()) baseModeIsEnglish = state.engActive;
  numericMode = true;
  updateKbdImage();
  render();
}

// ── 좌표 (이미지 1421×778 픽셀 실측 기준 %) ──────────────────────────────
const KEY_COLS = [1.55, 14.00, 26.39, 38.78, 51.16, 63.62, 76.14, 88.60];
const KEY_ROWS = [3.09, 27.89, 52.44];
const KEY_W = 9.53, KEY_H = 19.97;
const BOT_Y = 76.94, BOT_H = 19.84;
// 상용구키 자리엔 느낌표/물음표 두 칸, danda 자리엔 쉼표(danda 본체는 3행8열로 이동) —
// 하단바가 5칸(!, ?, 스페이스, 쉼표, 엔터)이 됨. images/keyboard.png 실측 기준 %.
const BOT_SECTIONS = { excl:[1.11,11.87], quest:[13.58,24.33], space:[25.96,66.25], comma:[67.80,78.71], enter:[80.34,98.89] };

// ── 영문(쿼티) 자판 좌표 (images/keyboard_eng.png 2176×1182 실측 기준 %) ──
const ENG_ROW_TOP = [2.45, 27.50, 52.54];
const ENG_ROW_H = 20.13;
const ENG_KEY_W = 8.594;
const ENG_ROW1 = ['Q','W','E','R','T','Y','U','I','O','P'];
const ENG_ROW2 = ['A','S','D','F','G','H','J','K','L'];
const ENG_ROW3 = ['Z','X','C','V','B','N','M'];
const ENG_ROW1_COLS = [1.06,10.94,20.86,30.76,40.67,50.55,60.48,70.36,80.29,90.17];
const ENG_ROW2_COLS = [6.07,15.95,25.87,35.76,45.64,55.56,65.44,75.37,85.25];
const ENG_ROW3_COLS = [15.86,25.78,35.66,45.54,55.47,65.35,75.28];
const ENG_SHIFT = { left:1.01, width:11.90 };
const ENG_PERIOD = { left:86.99, width:11.90 }; // 3행 마지막 칸: 백스페이스 폐지, 마침표로 대체(이미지에 이미 "." 그려져 있음)
const ENG_BOT_Y = 77.08, ENG_BOT_H = 20.13;
// 힌디어 모드와 동일하게 하단바 5칸(!, ?, 스페이스, 쉼표, 엔터) — images/keyboard_eng.png 실측 기준 %.
const ENG_BOT_SECTIONS = { excl:[1.11,11.87], quest:[13.58,24.33], space:[25.96,66.17], comma:[67.80,78.64], enter:[80.27,98.81] };

// ── 히트박스 확장: 이미지엔 키 사이 여백이 그려져 있지만, 실제 터치 영역은 그
// 여백까지 이웃 키와 절반씩 나눠 가져서 화면 전체(0~100%)를 빈틈없이 덮게 만든다.
// 안 그러면 여백 줄을 누를 때마다 어떤 키도 반응하지 않는 죽은 영역이 생긴다.
// starts/sizes는 같은 길이의 배열(각 칸의 시작 위치%, 크기%) — 폭이 다른 칸이
// 섞여 있어도(예: 영문 3행의 시프트/글자/백스페이스) 그대로 쓸 수 있다.
function expandAxisHitboxes(starts, sizes, total = 100) {
  const n = starts.length;
  const bounds = new Array(n + 1);
  bounds[0] = 0;
  for (let i = 1; i < n; i++) bounds[i] = (starts[i - 1] + sizes[i - 1] + starts[i]) / 2;
  bounds[n] = total;
  return starts.map((_, i) => ({ start: bounds[i], size: bounds[i + 1] - bounds[i] }));
}

// 힌디/숫자 자판이 공유하는 그리드 히트박스 (8열 x (3행+하단바 1행))
const HIT_COLS = expandAxisHitboxes(KEY_COLS, KEY_COLS.map(() => KEY_W));
const HIT_ROWS = expandAxisHitboxes([...KEY_ROWS, BOT_Y], [KEY_H, KEY_H, KEY_H, BOT_H]);
// 순서: [0]!, [1]?, [2]스페이스, [3]쉼표, [4]엔터
const HIT_BOT_SECTIONS = expandAxisHitboxes(
  [BOT_SECTIONS.excl[0], BOT_SECTIONS.quest[0], BOT_SECTIONS.space[0], BOT_SECTIONS.comma[0], BOT_SECTIONS.enter[0]],
  [BOT_SECTIONS.excl[1] - BOT_SECTIONS.excl[0], BOT_SECTIONS.quest[1] - BOT_SECTIONS.quest[0], BOT_SECTIONS.space[1] - BOT_SECTIONS.space[0], BOT_SECTIONS.comma[1] - BOT_SECTIONS.comma[0], BOT_SECTIONS.enter[1] - BOT_SECTIONS.enter[0]]
);

// 영문 자판 히트박스 (행마다 칸 폭이 달라서 행별로 따로 계산)
const ENG_HIT_ROW1 = expandAxisHitboxes(ENG_ROW1_COLS, ENG_ROW1_COLS.map(() => ENG_KEY_W));
const ENG_HIT_ROW2 = expandAxisHitboxes(ENG_ROW2_COLS, ENG_ROW2_COLS.map(() => ENG_KEY_W));
const ENG_HIT_ROW3 = expandAxisHitboxes(
  [ENG_SHIFT.left, ...ENG_ROW3_COLS, ENG_PERIOD.left],
  [ENG_SHIFT.width, ...ENG_ROW3_COLS.map(() => ENG_KEY_W), ENG_PERIOD.width]
);
const ENG_HIT_ROWS = expandAxisHitboxes([...ENG_ROW_TOP, ENG_BOT_Y], [ENG_ROW_H, ENG_ROW_H, ENG_ROW_H, ENG_BOT_H]);
// 순서: [0]!, [1]?, [2]스페이스, [3]쉼표, [4]엔터 (힌디 모드와 동일)
const ENG_HIT_BOT = expandAxisHitboxes(
  [ENG_BOT_SECTIONS.excl[0], ENG_BOT_SECTIONS.quest[0], ENG_BOT_SECTIONS.space[0], ENG_BOT_SECTIONS.comma[0], ENG_BOT_SECTIONS.enter[0]],
  [ENG_BOT_SECTIONS.excl[1] - ENG_BOT_SECTIONS.excl[0], ENG_BOT_SECTIONS.quest[1] - ENG_BOT_SECTIONS.quest[0], ENG_BOT_SECTIONS.space[1] - ENG_BOT_SECTIONS.space[0], ENG_BOT_SECTIONS.comma[1] - ENG_BOT_SECTIONS.comma[0], ENG_BOT_SECTIONS.enter[1] - ENG_BOT_SECTIONS.enter[0]]
);

// ── 숫자/기호 자판 좌표 (images/bg_numeric_keyboard.png 918×620 실측 기준 %) ──
// 1~4행은 10열 균등 그리드를 공유하고(칸마다 글자 하나씩 그려져 있어 순환 없이 단일
// 탭으로 입력), 5행(하단바)만 폭이 다른 5칸(-, =, 스페이스, $, 엔터)이다.
const NUM_COLS = [1.20, 11.11, 21.02, 30.94, 40.85, 50.76, 60.68, 70.59, 80.50, 90.31];
const NUM_KEY_W = 8.60;
const NUM_ROW_TOP = [2.74, 21.29, 41.29, 61.13, 80.81];
const NUM_ROW_H = [14.84, 16.61, 16.61, 16.61, 16.45]; // 실측상 1행만 나머지보다 살짝 낮다
const NUM_BOT_SECTIONS = { minus:[1.31,10.02], equals:[11.33,19.83], space:[21.13,67.65], dollar:[69.28,78.43], enter:[80.17,98.58] };

const NUM_HIT_COLS = expandAxisHitboxes(NUM_COLS, NUM_COLS.map(() => NUM_KEY_W));
const NUM_HIT_ROWS = expandAxisHitboxes(NUM_ROW_TOP, NUM_ROW_H);
// 순서: [0]-, [1]=, [2]스페이스, [3]$, [4]엔터
const NUM_HIT_BOT = expandAxisHitboxes(
  [NUM_BOT_SECTIONS.minus[0], NUM_BOT_SECTIONS.equals[0], NUM_BOT_SECTIONS.space[0], NUM_BOT_SECTIONS.dollar[0], NUM_BOT_SECTIONS.enter[0]],
  [NUM_BOT_SECTIONS.minus[1] - NUM_BOT_SECTIONS.minus[0], NUM_BOT_SECTIONS.equals[1] - NUM_BOT_SECTIONS.equals[0], NUM_BOT_SECTIONS.space[1] - NUM_BOT_SECTIONS.space[0], NUM_BOT_SECTIONS.dollar[1] - NUM_BOT_SECTIONS.dollar[0], NUM_BOT_SECTIONS.enter[1] - NUM_BOT_SECTIONS.enter[0]]
);

// 키 입력 확정을 누르는 순간(pointerdown)이 아니라 떼는 순간(pointerup)으로 미룬다.
// 예전엔 pointerdown 후 고정 시간(70ms)만 유예하고 그 사이 스와이프 움직임이 있었는지로
// 판단했는데, 마우스로 천천히 스와이프하면 임계 거리(28px)에 도달하기 전에 그 유예 시간이
// 끝나버려 스와이프 시작 지점의 키가 그대로 입력돼버리는 경쟁 상태가 있었다. pointerup
// 시점엔 스와이프가 실제로 발동했는지(kbdGestureActive)가 이미 확정돼 있으므로 이 경쟁이
// 원천적으로 생기지 않는다. 같은 손가락(pointerId)이 눌렀다 뗀 경우에만 반응한다 —
// 스와이프로 자리를 옮겨 다른 키 위에서 손을 떼도 그 키가 잘못 눌리지 않도록.
let kbdGestureActive = false;

// 첫 실행 튜토리얼이 스와이프 존 동작을 가로챌 때 쓰는 훅. tutorial.js가 설정한다.
// (zone, defaultFn) => 튜토리얼이 그 존을 기대하고 있으면 defaultFn()을 실행해 실제
// 모드를 바꾸고, 아닌 존이면 defaultFn()을 호출하지 않아 모드 전환 자체를 막는다.
// 튜토리얼이 비활성 상태면 항상 null이라 평소처럼 defaultFn()이 그대로 실행된다.
let zoneSwipeInterceptor = null;
// 자모 조합 튜토리얼 단계에서 render() 직후 진행 상황을 확인할 때 쓰는 훅.
let onTutorialRender = null;

// 롱프레스 안내: 자음키(→다음키 안내)/부호키(→멀티탭 안내)에서 손가락을 떼지 않고
// 오래 누르고 있으면 팝업으로 올바른 조작법을 짚어준다. 교육 없이 바로 써보게 했을 때
// 요즘 유저들은 한 키에 여러 문자가 있으면 반사적으로 롱프레스부터 시도하는 경향이
// 확인되어 추가함. 스페이스처럼 매 입력마다 걸리는 동작이 아니라 유저가 헷갈릴 때만
// 드물게 시도하는 제스처라 노출 빈도를 제한할 필요는 없다 — 매번 보여준다. 롱프레스여도
// 손을 떼면(pointerup) 원래 탭 동작은 그대로 실행된다(안내는 부가 정보일 뿐 입력을 막지 않음).
const LONG_PRESS_MS = 500;
const LONGPRESS_HINT_CONSONANT = 'दाईं ओर वाला तीर का बटन दबाएं।';
const LONGPRESS_HINT_SIGN = 'बार-बार टैप करें।';
let longPressToastTimer = null;
// 손가락이 자음/부호키 위에서 눌린 채로 시작해 스와이프로 이어지면, 그 키의 롱프레스
// 타이머가 스와이프와 무관하게 계속 돌고 있다가 500ms를 넘기는 순간 "롱프레스" 안내
// 팝업을 띄워버렸다(스와이프 자체가 손을 500ms 넘게 붙이고 있는 동작이라 흔히 걸림).
// initSwipeGesture가 스와이프를 확정하는 순간 이 콜백으로 그 키의 타이머를 꺼서 막는다.
let pendingLongPressCancel = null;
function showLongPressHint(text) {
  const el = document.getElementById('longpress-toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  if (longPressToastTimer) clearTimeout(longPressToastTimer);
  longPressToastTimer = setTimeout(() => el.classList.remove('show'), 1600);
}

function makeBtn(cls, style, onClick, longPressText) {
  const b = document.createElement('button');
  b.className = 'kbd-btn ' + cls;
  Object.assign(b.style, style);
  if (onClick) {
    let downPointerId = null;
    let longPressTimer = null;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      downPointerId = e.pointerId;
      // 손가락이 살짝 흔들려 이웃 키 쪽으로 pointerup이 잡혀도 이 키가 눌린 걸로
      // 인식하도록 포인터를 붙잡아둔다(캡처해도 wrap까지의 버블링은 그대로 유지됨).
      try { b.setPointerCapture(e.pointerId); } catch (err) {}
      if (longPressText) {
        longPressTimer = setTimeout(() => { longPressTimer = null; showLongPressHint(longPressText); }, LONG_PRESS_MS);
        pendingLongPressCancel = () => { if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; } };
      }
    });
    b.addEventListener('pointerup', (e) => {
      if (e.pointerId !== downPointerId) return;
      downPointerId = null;
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      pendingLongPressCancel = null;
      if (!kbdGestureActive) onClick();
    });
    b.addEventListener('pointercancel', (e) => {
      if (e.pointerId === downPointerId) downPointerId = null;
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      pendingLongPressCancel = null;
    });
  }
  return b;
}

// 히트박스가 확장되면서 줄 양 끝 글자(예: 홈로우의 A, L)는 원래 그림 속 키보다
// 훨씬 넓은 버튼 안에 놓이게 돼, 버튼 중앙(=넓어진 히트박스 중앙)으로 flex-정렬된
// 글자가 그림 속 키 칸에서 벗어나 보였다. 그래서 클릭만 받는 투명 버튼(hitStyle)과
// 그림 속 키 위치 그대로 놓이는 순수 표시용 라벨(visualStyle)을 따로 둔다 —
// 둘 다 #kbd의 같은 %좌표계를 공유하니 별도 환산 없이 그대로 쓸 수 있다.
function makeLetterBtn(ch, hitStyle, visualStyle, onClick) {
  const frag = document.createDocumentFragment();
  frag.appendChild(makeBtn('kbd-eng-hit', hitStyle, onClick));

  const label = document.createElement('div');
  label.className = 'kbd-label kbd-eng-letter';
  Object.assign(label.style, visualStyle, { position: 'absolute', display: 'flex', pointerEvents: 'none' });
  const sp = document.createElement('span');
  sp.className = 'label-item';
  sp.textContent = ch;
  label.appendChild(sp);
  frag.appendChild(label);

  return frag;
}

// ── 영문 모드 진입/이탈 (한 손가락 상하 스와이프, 방향 무관 토글) ──
function enterEnglishMode() {
  if (shiftTapTimer) { clearTimeout(shiftTapTimer); shiftTapTimer = null; }
  state.engActive = true;
  state.engShiftState = 'off'; // 영문은 소문자로 시작(대문자보다 쓸 일이 훨씬 많음)
  state.activeRoot = null; state.activeCharIdx = 0;
  state.lastSignKey = null; state.signTapIdx = 0;
  state.independentMode = false;
  updateKbdImage();
  render();
}

function exitEnglishMode() {
  if (shiftTapTimer) { clearTimeout(shiftTapTimer); shiftTapTimer = null; }
  state.engActive = false;
  state.engShiftState = 'off';
  updateKbdImage();
  render();
}

// 지금 "기타(임시) 모드"(대문자/숫자·기호/상용구) 안에 있는지. 임시 모드에 처음
// 들어갈 때 기본 모드 기억(baseModeIsEnglish)을 갱신해도 되는지 판단하는 데 쓴다.
function isTemporaryMode() {
  return numericMode || favoritesMode || isShortformActive();
}

// 임시 모드(대문자/숫자·기호/상용구, 뭐가 됐든)에서 "나가기": 진입 직전 상태가 아니라
// 항상 그 임시 모드 체인이 시작되기 전의 기본 모드(힌디 또는 영문 소문자)로 곧장
// 돌아간다. 임시 모드끼리 넘나든 경우(대문자 → 숫자판 등)에도 baseModeIsEnglish는
// 안 바뀌어 있으므로 항상 맨 처음 기본 모드로 정확히 복귀한다.
function exitToBaseMode() {
  numericMode = false;
  if (favoritesMode) hideFavorites();
  state.engActive = baseModeIsEnglish;
  state.engShiftState = 'off';
  state.activeRoot = null; state.activeCharIdx = 0;
  state.lastSignKey = null; state.signTapIdx = 0;
  state.independentMode = false;
  updateKbdImage();
  render();
}

// 가운데 1/3 스와이프(1회): 힌디/영문 소문자 사이의 토글이다. 지금 임시 모드(대문자/
// 숫자·기호/상용구) 안에 있다면 토글이 아니라 그 임시 모드에서 "나가기"로 취급한다 —
// 대문자 모드도 engActive===true인 상태지만 여기서는 절대 "그냥 영문"으로 오인해
// 토글시키지 않는다(그러면 항상 힌디로만 나가져서, 영문 소문자에서 대문자로 들어왔을
// 때는 잘못된 기본 모드로 돌아가 버린다).
function toggleEnglishMode() {
  if (isTemporaryMode()) { exitToBaseMode(); return; }
  if (state.engActive) exitEnglishMode(); else enterEnglishMode();
}

// 가운데 1/3 스와이프. 규칙은 단순하다: 짧은 시간 안에 연이어 두 번이면 이전에 뭘
// 하고 있었든 상관없이 무조건 대문자(약어) 모드로 진입하고(enterShortformMode),
// 그게 아니면(1회) toggleEnglishMode — 힌디/영문이면 토글, 숫자판/상용구면 그냥
// 나가기 — 을 그대로 부른다.
// 함정 하나: 더블스와이프의 첫 스와이프도 "1회"로 먼저 처리되면서 toggleEnglishMode가
// 곧바로 힌디/영문을 뒤집어버린다. 그래서 힌디에서 더블스와이프를 하면 ― 1차 스와이프가
// 힌디→영문으로 토글해놓은 다음, 2차 스와이프가 "지금 상태(영문)"를 기본 모드로
// 잘못 저장해버려서, 나중에 대문자에서 나가면 힌디가 아니라 영문으로 돌아가는 버그가
// 있었다. 그래서 1회 스와이프 시점에 아직 기본 모드였다면(임시 모드가 아니었다면)
// toggleEnglishMode가 뒤집기 "직전" 값을 centerSwipeBaseSnapshot에 따로 적어뒀다가,
// 두 번째 스와이프가 대문자 모드로 확정될 때 이 값을 넘겨준다(state.engActive를 그
// 시점에 다시 읽으면 이미 1차 스와이프가 바꿔놓은 뒤라 늦다). 이미 임시 모드였다면
// 1차 스와이프가 exitToBaseMode로 알아서 기본 모드를 복원해두므로 스냅샷이 필요 없다
// (null로 표시해두면 enterShortformMode가 그 시점의 state.engActive를 그대로 쓴다).
let lastCenterSwipeTime = 0;
let centerSwipeBaseSnapshot = null;
const CENTER_DOUBLE_SWIPE_MS = 1500;
function handleCenterSwipe() {
  const now = Date.now();
  if (now - lastCenterSwipeTime < CENTER_DOUBLE_SWIPE_MS) {
    lastCenterSwipeTime = 0; // 세 번째 연속 스와이프가 또 더블로 잡히지 않도록
    enterShortformMode(centerSwipeBaseSnapshot);
    centerSwipeBaseSnapshot = null;
  } else {
    lastCenterSwipeTime = now;
    centerSwipeBaseSnapshot = isTemporaryMode() ? null : state.engActive;
    toggleEnglishMode();
  }
}

// 우측 1/3 상하 스와이프: 무조건 숫자/기호 모드로 진입한다(대문자 모드의 더블스와이프와
// 같은 원칙 — 이 제스처 자체에는 "나가기/복귀"가 없다. 나가는 건 가운데 스와이프 1회
// 규칙(toggleEnglishMode → isTemporaryMode면 exitToBaseMode)이 맡는다). 이미 숫자판
// 안이어도 다시 스와이프하면 그냥 숫자판을 유지한다(enterNumericMode의 이미-진입 가드로
// 자연히 아무 일도 안 일어남). 상용구 패널이 열려 있었다면(예: 상용구를 고르려다 마음이
// 바뀐 경우) 패널만 닫고 그대로 숫자판 진입까지 이어간다.
function toggleNumericMode() {
  if (favoritesMode) hideFavorites();
  enterNumericMode();
}

function handleEngLetter(ch) {
  appendText(state.engShiftState === 'off' ? ch.toLowerCase() : ch.toUpperCase());
  if (state.engShiftState === 'once') state.engShiftState = 'off';
  render();
}

function handleEngSpace() { appendText(' '); render(); }

// 스와이프 삭제(handleSwipeDelete)가 영문 모드일 때 재사용한다 — 물리 키는 폐지됐다.
function handleEngBackspace() {
  backspace();
  render();
}

function handleEngEnter() { appendText('\n'); render(); }

// 하단바의 쉼표/느낌표/물음표 + 3행 마지막 칸의 마침표 키 공용 핸들러.
function handleEngPunct(ch) { appendText(ch); render(); }

// 시프트: 더블탭=캡스락 토글(다른 폰 키보드와 동일 관례), 싱글탭=임시 대문자 1글자.
// 더블탭 여부는 두 번째 탭이 실제로 오는지 지켜봐야 하므로, 첫 탭은 타이머로 유예한 뒤
// 유예 시간 안에 두 번째 탭이 오면 그 시점에 취소하고 토글로 대체한다(사후 시간차 비교 방식은
// 첫 탭에서 싱글 동작이 이미 실행돼버려 더블탭 시 엉뚱하게 겹쳐 적용되는 버그가 있었음).
// 물리 시프트키 탭에서만 이 타이머 방식을 쓴다 — 손가락을 떼고 다시 눌러야 하는 스와이프는
// 두 번째 동작이 300ms 안에 들어오기 어려워서, 타이머 방식을 그대로 쓰면 첫 스와이프의
// 타이머가 먼저 끝나 'once'가 됐다가 두 번째 스와이프가 그걸 다시 'off'로 되돌려버리는
// 문제가 있었다(2연속 스와이프인데 잠기기는커녕 풀려버림).
let shiftTapTimer = null;
function handleShiftTap() {
  if (shiftTapTimer) {
    clearTimeout(shiftTapTimer);
    shiftTapTimer = null;
    state.engShiftState = state.engShiftState === 'lock' ? 'off' : 'lock';
    render();
    return;
  }
  shiftTapTimer = setTimeout(() => {
    shiftTapTimer = null;
    state.engShiftState = state.engShiftState === 'off' ? 'once' : 'off';
    render();
  }, 300);
}

// 가운데 1/3 연속 2회 스와이프(handleCenterSwipe) 전용 — "약어 모드" 진입. 힌디/영문/
// 숫자/상용구 어느 상태에 있었든 상관없이 곧장 영문 대문자(시프트락) 상태로 보낸다 —
// 인도에서 약어를 대문자로 쓰는 관행을 반영해 "영문 모드"와는 별개 개념으로 취급하지만
// 실제로는 engActive+lock 상태일 뿐이다. 나가는 분기는 따로 없다 — 약어 모드도
// engActive===true지만 isTemporaryMode()가 걸러내므로 toggleEnglishMode의 1회 스와이프
// 규칙에서는 "그냥 영문"이 아니라 "임시 모드"로 취급돼 exitToBaseMode()로 나간다(대문자
// 모드 자신도 진입 전 기본 모드를 정확히 기억하고 있다가 그리로 돌아간다). 물리
// 시프트키로도 대문자를 풀 수 있다(기존 handleShiftTap, engShiftState만 바꿀 뿐 모드
// 자체는 안 나간다).
function isShortformActive() {
  return !numericMode && state.engActive && state.engShiftState === 'lock';
}

// baseSnapshot: handleCenterSwipe가 더블스와이프의 첫 스와이프 "직전" 기본 모드 여부를
// 미리 적어뒀다가 넘겨준다(불리언). null/undefined면 지금 이 순간의 state.engActive를
// 대신 쓴다(이미 임시 모드였다가 진입하는 경우 등, 첫 스와이프가 따로 기록하지 않은 케이스).
function enterShortformMode(baseSnapshot) {
  if (shiftTapTimer) { clearTimeout(shiftTapTimer); shiftTapTimer = null; }
  if (typeof baseSnapshot === 'boolean') baseModeIsEnglish = baseSnapshot;
  else if (!isTemporaryMode()) baseModeIsEnglish = state.engActive;
  if (favoritesMode) hideFavorites(); // 상용구 패널이 떠 있었다면 닫고 진입(숫자판 진입과 같은 패턴)
  numericMode = false;
  state.engActive = true;
  state.engShiftState = 'lock';
  state.activeRoot = null; state.activeCharIdx = 0;
  state.lastSignKey = null; state.signTapIdx = 0;
  state.independentMode = false;
  updateKbdImage();
  render();
}

function renderEng() {
  const kbd = document.getElementById('kbd');
  kbd.innerHTML = '';
  const upper = state.engShiftState !== 'off';
  const rowY = ENG_HIT_ROWS;

  ENG_ROW1.forEach((ch, i) => kbd.appendChild(makeLetterBtn(upper ? ch : ch.toLowerCase(), {
    left: ENG_HIT_ROW1[i].start + '%', top: rowY[0].start + '%', width: ENG_HIT_ROW1[i].size + '%', height: rowY[0].size + '%'
  }, {
    left: ENG_ROW1_COLS[i] + '%', top: ENG_ROW_TOP[0] + '%', width: ENG_KEY_W + '%', height: ENG_ROW_H + '%'
  }, () => handleEngLetter(ch))));

  ENG_ROW2.forEach((ch, i) => kbd.appendChild(makeLetterBtn(upper ? ch : ch.toLowerCase(), {
    left: ENG_HIT_ROW2[i].start + '%', top: rowY[1].start + '%', width: ENG_HIT_ROW2[i].size + '%', height: rowY[1].size + '%'
  }, {
    left: ENG_ROW2_COLS[i] + '%', top: ENG_ROW_TOP[1] + '%', width: ENG_KEY_W + '%', height: ENG_ROW_H + '%'
  }, () => handleEngLetter(ch))));

  ENG_ROW3.forEach((ch, i) => kbd.appendChild(makeLetterBtn(upper ? ch : ch.toLowerCase(), {
    left: ENG_HIT_ROW3[i + 1].start + '%', top: rowY[2].start + '%', width: ENG_HIT_ROW3[i + 1].size + '%', height: rowY[2].size + '%'
  }, {
    left: ENG_ROW3_COLS[i] + '%', top: ENG_ROW_TOP[2] + '%', width: ENG_KEY_W + '%', height: ENG_ROW_H + '%'
  }, () => handleEngLetter(ch))));

  // 시프트 키도 글자키와 같은 문제였다: 확장된 히트박스 기준으로 "우상단 12%/10%"를
  // 계산하니 초록 점이 그림 속 키 테두리를 넘어가 버렸다. 클릭 전용 투명 버튼(확장
  // 히트박스)과 점을 얹는 표시용 레이어(그림 속 키 위치 그대로)를 분리해서 고친다.
  kbd.appendChild(makeBtn('kbd-eng-hit', {
    left: ENG_HIT_ROW3[0].start + '%', top: rowY[2].start + '%', width: ENG_HIT_ROW3[0].size + '%', height: rowY[2].size + '%'
  }, handleShiftTap));

  const shiftCls = 'kbd-shift' + (state.engShiftState === 'lock' ? ' locked' : state.engShiftState === 'once' ? ' once' : '');
  const shiftVisual = document.createElement('div');
  shiftVisual.className = shiftCls;
  Object.assign(shiftVisual.style, {
    position: 'absolute', pointerEvents: 'none',
    left: ENG_SHIFT.left + '%', top: ENG_ROW_TOP[2] + '%', width: ENG_SHIFT.width + '%', height: ENG_ROW_H + '%'
  });
  const dot = document.createElement('span');
  dot.className = 'shift-dot';
  shiftVisual.appendChild(dot);
  kbd.appendChild(shiftVisual);

  // 3행 마지막 칸: 백스페이스 폐지, 마침표로 대체(이미지에 라벨 이미 그려져 있음)
  kbd.appendChild(makeBtn('kbd-func', {
    left: ENG_HIT_ROW3[8].start + '%', top: rowY[2].start + '%', width: ENG_HIT_ROW3[8].size + '%', height: rowY[2].size + '%'
  }, () => handleEngPunct('.')));

  // 하단바: ! | ? | space | , | 엔터 — 힌디 모드와 동일 구성. !, ?, 쉼표, "space" 라벨은
  // 모두 이미지에 이미 그려져 있어(영문은 힌디처럼 स्वर 겸용 라벨이 필요 없다) 투명
  // 버튼만 얹으면 된다.
  kbd.appendChild(makeBtn('kbd-func', {
    left: ENG_HIT_BOT[0].start + '%', top: rowY[3].start + '%', width: ENG_HIT_BOT[0].size + '%', height: rowY[3].size + '%'
  }, () => handleEngPunct('!')));

  kbd.appendChild(makeBtn('kbd-func', {
    left: ENG_HIT_BOT[1].start + '%', top: rowY[3].start + '%', width: ENG_HIT_BOT[1].size + '%', height: rowY[3].size + '%'
  }, () => handleEngPunct('?')));

  kbd.appendChild(makeBtn('kbd-space', {
    left: ENG_HIT_BOT[2].start + '%', top: rowY[3].start + '%', width: ENG_HIT_BOT[2].size + '%', height: rowY[3].size + '%'
  }, handleEngSpace));

  kbd.appendChild(makeBtn('kbd-func', {
    left: ENG_HIT_BOT[3].start + '%', top: rowY[3].start + '%', width: ENG_HIT_BOT[3].size + '%', height: rowY[3].size + '%'
  }, () => handleEngPunct(',')));

  kbd.appendChild(makeBtn('kbd-enter', {
    left: ENG_HIT_BOT[4].start + '%', top: rowY[3].start + '%', width: ENG_HIT_BOT[4].size + '%', height: rowY[3].size + '%'
  }, handleEngEnter));
  kbd.appendChild(makeEnterLabel([ENG_BOT_SECTIONS.enter[0], ENG_BOT_SECTIONS.enter[1]], ENG_BOT_Y, ENG_BOT_H));
}

// 오른쪽 1/3 좌향(가로) 스와이프 = 삭제. 힌디/영문/숫자 어느 모드에 있든 지금 그
// 모드의 백스페이스 키를 누른 것과 똑같이 동작하게, 각 모드의 기존 핸들러를 그대로
// 재사용한다(state 정리 로직까지 모드별로 다르므로 backspace()만 단독으로 부르지 않음).
function handleSwipeDelete() {
  if (numericMode) handleNumBS();
  else if (state.engActive) handleEngBackspace();
  else handleBS();
  render();
}

// ── 간편 모드 전환: 자판 영역을 좌/중/우 1/3로 나눠 각 구역의 스와이프에 서로 다른
// 동작을 배정한다 (좌: 상용구, 중앙: 힌디↔영문(1회)/약어모드(연속 2회), 우: 세로
// 스와이프=숫자/기호, 좌향 가로 스와이프=삭제). 세로는 방향 상관없이 일정 거리 이상
// 이동하면 발동하는 예전 방식 그대로이고, 가로(삭제)는 우측 1/3에서만, 왼쪽으로
// 일정 거리 이상 이동해야 발동한다.
// 이제 한 지점(포인터 1개)만 있으면 되므로 터치 전용 이벤트 대신 Pointer Events를
// 쓴다 — 폰 터치와 PC 마우스 드래그를 같은 코드로 함께 지원하기 위함(PC에서도
// 마우스로 클릭+드래그하면 테스트 가능).
// 좌/우 구역은 파카하라/영문/숫자 어느 자판 위에서든 항상 똑같이 동작하는 "모드 전환"
// 스위치다 — 각자 목표 모드로 곧장 보내고, 이미 그 모드라면 토글로 진입 직전 상태로
// 되돌린다(좌: 상용구, 우: 숫자판, 둘 다 같은 패턴).
(function initSwipeGesture() {
  const wrap = document.getElementById('keyboard-wrap');
  let activePointerId = null;
  let startX = null, startY = null, triggered = false, zone = null;
  const SWIPE_MIN_PX = 28;       // 최소 이동 거리
  const SWIPE_V_H_RATIO = 1.3;   // 두 축 중 하나가 반대축보다 이 배 이상이어야 스와이프로 인정(대각선 오조작 방지)

  function zoneOf(clientX) {
    const r = wrap.getBoundingClientRect();
    const ratio = (clientX - r.left) / r.width;
    if (ratio < 1 / 3) return 'left';
    if (ratio < 2 / 3) return 'center';
    return 'right';
  }

  wrap.addEventListener('pointerdown', (e) => {
    // 상용구 패널이 열려 있어도 모든 스와이프를 그대로 통과시킨다 — 좌/중앙은 닫기/복귀,
    // 우측은 (예: 상용구를 고르려다 마음이 바뀐 경우) 패널을 닫고 그 모드로 바로 들어간다.
    if (activePointerId !== null) return; // 이미 다른 포인터를 추적 중이면 무시(오조작 방지)
    activePointerId = e.pointerId;
    startX = e.clientX; startY = e.clientY;
    triggered = false;
    zone = zoneOf(e.clientX);
  });

  // 스와이프가 확정된 순간 공통으로 해줘야 하는 뒷정리(롱프레스 취소, 포인터 강제 캡처).
  // 캡처가 없으면 손가락이 wrap 밖(예: 바로 위 입력창)으로 빠져나간 채로 손을 뗄 때
  // pointerup이 wrap까지 전달되지 않아 kbdGestureActive가 true로 영원히 걸려버리고,
  // 그 순간부터 모든 키 입력이 무시되는 "먹통" 상태가 됐었다.
  function armGesture(e) {
    triggered = true;
    kbdGestureActive = true;
    if (pendingLongPressCancel) { pendingLongPressCancel(); pendingLongPressCancel = null; }
    try { wrap.setPointerCapture(e.pointerId); } catch (err) {}
  }

  wrap.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activePointerId || startX == null || triggered) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    // 오른쪽 1/3 좌향 가로 스와이프 = 삭제. 세로 판정보다 먼저 검사한다(두 축 dominance
    // 조건은 SWIPE_V_H_RATIO>1이라 어차피 동시에 참일 수 없어 순서 자체는 결과에 영향 없음).
    // zone 태그를 'right'가 아니라 'delete'로 넘긴다 — 세로 우측 스와이프(숫자판)와
    // 구분해야 튜토리얼이 "지금은 삭제 스와이프 단계"임을 구별해 게이트를 걸 수 있다
    // (실사용 중엔 zoneSwipeInterceptor가 없으면 태그와 무관하게 바로 실행되니 영향 없음).
    if (zone === 'right' && dx < 0 && Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * SWIPE_V_H_RATIO) {
      armGesture(e);
      runZoneAction('delete', handleSwipeDelete);
      return;
    }

    if (Math.abs(dy) < SWIPE_MIN_PX) return;
    if (Math.abs(dy) < Math.abs(dx) * SWIPE_V_H_RATIO) return;
    armGesture(e);
    if (zone === 'left') runZoneAction('left', toggleFavoritesMode);
    else if (zone === 'center') runZoneAction('center', handleCenterSwipe);
    else runZoneAction('right', toggleNumericMode);
  });

  function runZoneAction(zone, fn) {
    if (zoneSwipeInterceptor) zoneSwipeInterceptor(zone, fn);
    else fn();
  }

  function endGesture(e) {
    if (e.pointerId !== activePointerId) return;
    try { wrap.releasePointerCapture(e.pointerId); } catch (err) {}
    activePointerId = null; startX = null; startY = null; triggered = false; zone = null; kbdGestureActive = false;
  }
  wrap.addEventListener('pointerup', endGesture);
  wrap.addEventListener('pointercancel', endGesture);
})();

function render() {
  if (numericMode) { renderNumeric(); }
  else if (state.engActive) { renderEng(); }
  else { renderDevanagari(); }
  if (onTutorialRender) onTutorialRender();
}

function renderNumeric() {
  const kbd = document.getElementById('kbd');
  kbd.innerHTML = '';

  // 1~4행: 10열 균등 그리드, 칸마다 글자 하나 — 전부 이미지에 이미 그려져 있어 투명
  // 버튼만 얹으면 된다.
  for (let r = 0; r < 4; r++) {
    const rowTop = NUM_HIT_ROWS[r].start;
    const rowH = NUM_HIT_ROWS[r].size;
    NUM_ROWS[r].forEach((ch, c) => {
      const style = { left: NUM_HIT_COLS[c].start + '%', top: rowTop + '%', width: NUM_HIT_COLS[c].size + '%', height: rowH + '%' };
      kbd.appendChild(makeBtn('kbd-func', style, () => handleNumSingle(ch)));
    });
  }

  // 5행(하단바): - | = | 스페이스 | $ | 엔터
  const botRow = NUM_HIT_ROWS[4];
  kbd.appendChild(makeBtn('kbd-func', {
    left: NUM_HIT_BOT[0].start + '%', top: botRow.start + '%', width: NUM_HIT_BOT[0].size + '%', height: botRow.size + '%'
  }, () => handleNumSingle('-')));

  kbd.appendChild(makeBtn('kbd-func', {
    left: NUM_HIT_BOT[1].start + '%', top: botRow.start + '%', width: NUM_HIT_BOT[1].size + '%', height: botRow.size + '%'
  }, () => handleNumSingle('=')));

  kbd.appendChild(makeBtn('kbd-space', {
    left: NUM_HIT_BOT[2].start + '%', top: botRow.start + '%', width: NUM_HIT_BOT[2].size + '%', height: botRow.size + '%'
  }, handleNumSpace));

  // 스페이스바 라벨: 이미지가 공란이라(영문 모드의 "space"와 달리) 직접 그려 넣는다.
  const numSpaceLabel = document.createElement('div');
  numSpaceLabel.className = 'kbd-space-label';
  Object.assign(numSpaceLabel.style, {
    left: NUM_BOT_SECTIONS.space[0] + '%', top: NUM_ROW_TOP[4] + '%',
    width: (NUM_BOT_SECTIONS.space[1] - NUM_BOT_SECTIONS.space[0]) + '%', height: NUM_ROW_H[4] + '%',
  });
  const numSpWord = document.createElement('span'); numSpWord.className = 'sp-part dark'; numSpWord.textContent = 'स्पेस';
  numSpaceLabel.appendChild(numSpWord);
  kbd.appendChild(numSpaceLabel);

  kbd.appendChild(makeBtn('kbd-func', {
    left: NUM_HIT_BOT[3].start + '%', top: botRow.start + '%', width: NUM_HIT_BOT[3].size + '%', height: botRow.size + '%'
  }, () => handleNumSingle('$')));

  kbd.appendChild(makeBtn('kbd-enter', {
    left: NUM_HIT_BOT[4].start + '%', top: botRow.start + '%', width: NUM_HIT_BOT[4].size + '%', height: botRow.size + '%'
  }, handleNumEnter));
  kbd.appendChild(makeEnterLabel([NUM_BOT_SECTIONS.enter[0], NUM_BOT_SECTIONS.enter[1]], NUM_ROW_TOP[4], NUM_ROW_H[4]));
}

// ── 상용구(즐겨찾기) 패널 ──────────────────────────────────────────────
// fav.png 실측(1356×750) 기준 % 좌표. 9칸(3x3) + 하단 가운데 넓은 칸 1개 = 10개.
const FAV_SLOTS = [
  { left:1.18,  top:3.20,  width:31.34, height:19.73 },
  { left:34.37, top:3.20,  width:31.34, height:19.73 },
  { left:67.48, top:3.20,  width:31.34, height:19.73 },
  { left:1.18,  top:28.00, width:31.34, height:19.60 },
  { left:34.29, top:28.00, width:31.42, height:19.60 },
  { left:67.48, top:28.00, width:31.34, height:19.60 },
  { left:1.18,  top:52.40, width:31.34, height:19.73 },
  { left:34.37, top:52.40, width:31.34, height:19.73 },
  { left:67.48, top:52.27, width:31.34, height:19.60 },
  { left:25.96, top:76.80, width:48.16, height:19.73 },
];
const FAV_CLOSE_RECT = { left:1.03,  top:76.93, width:23.23, height:19.60 };
const FAV_EDIT_RECT  = { left:75.74, top:76.80, width:23.30, height:19.73 };

const DEFAULT_FAVORITES = [
  'नमस्ते', 'ठीक है', 'क्या हाल है?', 'धन्यवाद', 'शुक्रिया',
  'कोई बात नहीं', 'क्या चल रहा है?', 'बाद में बात करते हैं', 'शुभ रात्रि', 'मुझे समझ नहीं आया',
];
const FAV_STORAGE_KEY = 'pakahara_fav_phrases';

function loadFavorites() {
  try {
    const raw = JSON.parse(localStorage.getItem(FAV_STORAGE_KEY));
    if (Array.isArray(raw) && raw.length === 10) return raw;
  } catch (e) {}
  return DEFAULT_FAVORITES.slice();
}

function rectStyle(r) {
  return { left: r.left + '%', top: r.top + '%', width: r.width + '%', height: r.height + '%' };
}

function renderFavorites() {
  const wrap = document.getElementById('fav-slots');
  wrap.innerHTML = '';
  loadFavorites().forEach((text, i) => {
    const b = makeBtn('fav-slot', rectStyle(FAV_SLOTS[i]), () => insertFavorite(text));
    const sp = document.createElement('span');
    sp.textContent = text;
    b.appendChild(sp);
    wrap.appendChild(b);
  });
  wrap.appendChild(makeBtn('fav-close', rectStyle(FAV_CLOSE_RECT), hideFavorites));
  wrap.appendChild(makeBtn('fav-edit', rectStyle(FAV_EDIT_RECT), openFavoriteEditor));
}

function showFavorites() {
  if (!isTemporaryMode()) baseModeIsEnglish = state.engActive;
  favoritesMode = true;
  renderFavorites();
  document.getElementById('fav-overlay').classList.add('show');
}
function hideFavorites() {
  favoritesMode = false;
  document.getElementById('fav-overlay').classList.remove('show');
}

// 좌측 1/3 스와이프 = 상용구 모드 토글. 이미 열려 있으면 닫기만 한다(숫자판과 동일 패턴).
function toggleFavoritesMode() {
  if (favoritesMode) hideFavorites(); else showFavorites();
}

// 상용구는 항상 커서(=문장 끝)에 삽입한 뒤 패널을 곧바로 닫는다.
function insertFavorite(text) {
  appendText(text);
  state.activeRoot = null; state.activeCharIdx = 0;
  state.lastSignKey = null; state.signTapIdx = 0;
  state.independentMode = false;
  hideFavorites();
  render();
}

// 키보드 앱은 자기 영역 밖(메인 앱 화면)을 그릴 수 없으므로, 실제 제품이라면 메인 앱의
// 상용구 편집 화면을 띄워야 한다. 이 데모에서는 그 화면을 흉내낸 별도 페이지로 이동한다.
// 이미 그 편집 페이지 위에 떠 있는 상용구 패널이라면(자기 자신을 다시 열게 되므로)
// 편집 중인 다른 칸의 내용을 잃지 않도록 그냥 패널만 닫는다.
function openFavoriteEditor() {
  if (/(^|\/)fav_edit\.html$/.test(location.pathname)) { hideFavorites(); return; }
  if (typeof onBeforeOpenFavoriteEditor === 'function') onBeforeOpenFavoriteEditor();
  location.href = 'fav_edit.html';
}

function renderDevanagari() {
  const kbd = document.getElementById('kbd');
  kbd.innerHTML = '';
  const isIndep = independentActive();

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      const root = leftKeys[row][col];
      kbd.appendChild(makeBtn('kbd-cons', {
        left: HIT_COLS[col].start + '%', top: HIT_ROWS[row].start + '%', width: HIT_COLS[col].size + '%', height: HIT_ROWS[row].size + '%'
      }, () => handleConsonant(root), LONGPRESS_HINT_CONSONANT));
    }

    for (let col = 0; col < 3; col++) {
      const rk = rightKeys[row][col];
      const imgCol = col + 5;
      const style = { left: HIT_COLS[imgCol].start + '%', top: HIT_ROWS[row].start + '%', width: HIT_COLS[imgCol].size + '%', height: HIT_ROWS[row].size + '%' };

      if (rk.type === 'next') {
        let labels = [];
        let extraCls = ' kbd-next';
        if (isIndep) { labels = ['अ']; extraCls += ' independent'; }
        else if (state.activeRoot) { labels = consonantGroups[state.activeRoot].slice(1); extraCls += ' next-active'; }
        else { labels = ['अ']; extraCls += ' next-idle'; } // 자음도 안 친 초기 상태: 같은 अ를 회색 힌트로만 미리 보여줌
        if (labels.length) extraCls += ' count-' + labels.length;
        const b = makeBtn('kbd-label' + extraCls, style, handleNext);
        labels.forEach(ch => {
          const sp = document.createElement('span');
          sp.className = 'label-item'; sp.textContent = ch;
          b.appendChild(sp);
        });
        kbd.appendChild(b);

      } else if (rk.type === 'danda') {
        // danda(।/॥/...) 키: 이미지가 공란이라 라벨을 직접 그린다. 다음키(K)와 같은
        // 원칙으로 "방금 입력된 것"이 아니라 "다음 탭에서 입력될 것"을 미리 보여준다 —
        // 기본(안 누른 상태)은 다음 탭이 ।이므로 ।, 한 번 누른 뒤에는 다음 탭이 ॥이므로
        // ॥, 두 번 누른 뒤에는 다음 탭이 세 점(...)째로 들어가므로 …, 세 번 이상
        // 누른 뒤에는 계속 점만 하나씩 늘어나므로 점(.) 하나로 고정 표시한다.
        const dandaNextIdx = state.lastSignKey === 'DANDA' ? state.signTapIdx + 1 : 0;
        const dandaCh = dandaNextIdx === 0 ? '।' : dandaNextIdx === 1 ? '॥' : dandaNextIdx === 2 ? '…' : '.';
        const b = makeBtn('kbd-label count-1', style, handleDanda);
        const sp = document.createElement('span');
        sp.className = 'label-item'; sp.textContent = dandaCh;
        b.appendChild(sp);
        kbd.appendChild(b);

      } else if (rk.type === 'sign') {
        const chars = isIndep ? (rk.indep || rk.chars) : rk.chars;
        const cls = 'kbd-label count-' + chars.length + (isIndep && rk.indep ? ' independent' : '');
        const b = makeBtn(cls, style, () => handleVowelKey(rk), LONGPRESS_HINT_SIGN);
        chars.forEach(ch => {
          const sp = document.createElement('span');
          sp.className = 'label-item'; sp.textContent = ch;
          b.appendChild(sp);
        });
        kbd.appendChild(b);
      }
    }
  }

  // 하단바: ! | ? | 스페이스/스와 | , | 엔터 — !, ?, 쉼표는 이미지에 이미 라벨이
  // 그려져 있어 투명 버튼(kbd-func)만 얹으면 된다.
  const botRow = HIT_ROWS[3];
  kbd.appendChild(makeBtn('kbd-func', {
    left: HIT_BOT_SECTIONS[0].start + '%', top: botRow.start + '%', width: HIT_BOT_SECTIONS[0].size + '%', height: botRow.size + '%'
  }, () => handlePunct('!')));

  kbd.appendChild(makeBtn('kbd-func', {
    left: HIT_BOT_SECTIONS[1].start + '%', top: botRow.start + '%', width: HIT_BOT_SECTIONS[1].size + '%', height: botRow.size + '%'
  }, () => handlePunct('?')));

  kbd.appendChild(makeBtn('kbd-space', {
    left: HIT_BOT_SECTIONS[2].start + '%', top: botRow.start + '%', width: HIT_BOT_SECTIONS[2].size + '%', height: botRow.size + '%'
  }, handleSpace));

  // 스페이스바 라벨: 실제 눌리는 영역(위 버튼)과 달리 그림에 그려진 키 모양 그대로의
  // 위치에 둔다 — 독립모음 모드(공란 이후)일 때만 전부 검게, 노멀일 때는 "स्वर" 부분만 회색으로.
  const [s0, s1] = BOT_SECTIONS.space;
  const spaceLabel = document.createElement('div');
  spaceLabel.className = 'kbd-space-label';
  Object.assign(spaceLabel.style, { left: s0 + '%', top: BOT_Y + '%', width: (s1 - s0) + '%', height: BOT_H + '%' });
  const spWord = document.createElement('span'); spWord.className = 'sp-part dark'; spWord.textContent = 'स्पेस';
  const slash = document.createElement('span'); slash.className = 'sp-part dark'; slash.textContent = '/';
  const svWord = document.createElement('span'); svWord.className = 'sp-part ' + (isIndep ? 'dark' : 'gray'); svWord.textContent = 'स्वर';
  spaceLabel.appendChild(spWord); spaceLabel.appendChild(slash); spaceLabel.appendChild(svWord);
  kbd.appendChild(spaceLabel);

  kbd.appendChild(makeBtn('kbd-func', {
    left: HIT_BOT_SECTIONS[3].start + '%', top: botRow.start + '%', width: HIT_BOT_SECTIONS[3].size + '%', height: botRow.size + '%'
  }, () => handlePunct(',')));

  kbd.appendChild(makeBtn('kbd-enter', {
    left: HIT_BOT_SECTIONS[4].start + '%', top: botRow.start + '%', width: HIT_BOT_SECTIONS[4].size + '%', height: botRow.size + '%'
  }, handleEnter));
  kbd.appendChild(makeEnterLabel(BOT_SECTIONS.enter, BOT_Y, BOT_H));
}

function resetAll() {
  if (shiftTapTimer) { clearTimeout(shiftTapTimer); shiftTapTimer = null; }
  kbdGestureActive = false; // 혹시 제스처 추적이 꼬여 키 입력이 막혀 있었더라도 리셋으로는 항상 풀리도록
  setText('');
  state = {
    activeRoot:null, activeCharIdx:0, lastSignKey:null, signTapIdx:0, signIndepMode:false, independentMode:false,
    engActive:false, engShiftState:'off',
  };
  numericMode = false; baseModeIsEnglish = false;
  lastCenterSwipeTime = 0;
  centerSwipeBaseSnapshot = null;
  hideFavorites();
  updateKbdImage();
  render();
}

// 영문/숫자 자판 이미지는 처음 그 모드로 스와이프해 들어가는 순간에야 브라우저가
// 불러오기 시작해서 그 첫 진입에서만 살짝 버퍼링이 생겼다. 시작하자마자 미리
// 받아 디코딩까지 끝내두면 실제로 전환할 때는 이미 캐시돼 있어 바로 나온다.
['images/keyboard_eng.png', 'images/bg_numeric_keyboard.png'].forEach(src => {
  const img = new Image();
  img.src = src;
});
