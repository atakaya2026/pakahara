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
    { id:'U', type:'sign', chars:['ं','ँ'], indep:['₹','卐'] },
    { id:'I', type:'sign', chars:['े','ै'], indep:['ए','ऐ'] },
    { id:'O', type:'sign', chars:['ो','ौ'], indep:['ओ','औ'] },
  ],
  [
    { id:'J', type:'sign', chars:['ि'], indep:['इ'] },
    { id:'K', type:'next' },
    { id:'L', type:'sign', chars:['ा','ी','ः'], indep:['आ','ई'] },
  ],
  [
    { id:'N', type:'sign', chars:['्','़'], indep:['ॐ','卍'] },
    { id:'M', type:'sign', chars:['ु','ू','ृ'], indep:['उ','ऊ','ऋ'] },
    { id:'BS', type:'bs' },
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

// ── 숫자/기호 자판 상태 (num.html 데모와 동기화) ──
let numericMode = false;
let lastNonNumericMode = false; // 숫자판 진입 직전 상태: false=파카하라, true=영문
let numLastKey = null;
let numTapIdx = 0;

// 좌측 1/3 스와이프로 들어가는 "약어 모드"(영문 대문자 고정) 진입 직전 상태 스냅샷.
// 다시 좌측 스와이프하면 이 스냅샷으로 되돌아간다(숫자판 토글과 같은 패턴).
let beforeShortform = null;

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

function handleEnter() {
  appendText('\n');
  state.activeRoot = null; state.activeCharIdx = 0;
  state.lastSignKey = null; state.signTapIdx = 0;
  state.independentMode = false;
  render();
}

// ── 숫자/기호 자판 데이터 (라오어 데모 num.html 그대로 이식) ──────────────
const numericRows = [
  [
    { type:'num-cycle', chars:['~','`'] },     // 1행 1열: ~ `
    { type:'num-cycle', chars:['@','*'] },     // 1행 2열: @ *
    { type:'num-cycle', chars:['#','$'] },     // 1행 3열: # $
    { type:'num-cycle', chars:['%','/'] },     // 1행 4열: % /
    { type:'num-next' },                        // 1행 5열: 힌디 모드의 다음키와 같은 역할(마지막 순환키 이어서 넘기기) — 기호키들과 같은 손에 몰리지 않도록 5열로 이동
    { type:'num-single', char:'7' },
    { type:'num-single', char:'8' },
    { type:'num-single', char:'9' },
  ],
  [
    { type:'num-cycle', chars:['^','&'] },     // 2행 1열: ^ &
    { type:'num-cycle', chars:['(', ')'] },   // 2행 2열: ( )
    { type:'num-cycle', chars:['<','>'] },    // 2행 3열: < >
    { type:'num-cycle', chars:['-','_'] },    // 2행 4열: - _
    { type:'num-cycle', chars:['+','='] },    // 2행 5열: + =
    { type:'num-single', char:'4' },
    { type:'num-single', char:'5' },
    { type:'num-single', char:'6' },
  ],
  [
    { type:'num-cycle', chars:['[',']'] },
    { type:'num-cycle', chars:['{','}'] },
    { type:'num-cycle', chars:['|','\\'] },
    { type:'num-cycle', chars:[':',';'] },
    { type:'num-cycle', chars:["'",'"'] },
    { type:'num-single', char:'1' },
    { type:'num-single', char:'2' },
    { type:'num-single', char:'3' },
  ],
  [
    { type:'num-single', char:',' },
    { type:'num-single', char:'.' },
    { type:'num-space' },                      // 4행 3-4열: 스페이스 (2칸)
    { type:'num-skip' },                       // 4행 4열: 스페이스 2번째 칸 더미
    { type:'num-single', char:'!' },
    { type:'num-single', char:'?' },
    { type:'num-single', char:'0' },
    { type:'num-bs' },
  ],
];

function handleNumSingle(char) {
  numLastKey = null; numTapIdx = 0;
  appendText(char);
}

// 힌디 모드의 자음키와 같은 원칙: 같은 키를 반복해서 눌러도 항상 기본 글자(chars[0])만
// 입력한다(멀티탭 없음) — 그래야 같은 문자를 겹쳐 입력할 수 있다(예: "~~"). 대체 후보로
// 넘어가려면 반드시 다음키(num-next)를 따로 눌러야 한다.
function handleNumCycle(keyId, chars) {
  numLastKey = keyId; numTapIdx = 0;
  appendText(chars[0]);
}

function handleNumBS() {
  numLastKey = null; numTapIdx = 0;
  backspace();
}

// 힌디 모드의 "다음키"와 같은 역할: 마지막으로 건드린 순환키(num-cycle)를 이어서
// 다음 후보로 넘긴다. 손가락이 원래 키에서 떨어져도 이 키로 계속 순환할 수 있다.
function handleNumNext() {
  if (!numLastKey) return;
  const m = /^n(\d)c(\d)$/.exec(numLastKey);
  if (!m) return;
  const key = numericRows[+m[1]][+m[2]];
  if (key.type !== 'num-cycle') return;
  numTapIdx = (numTapIdx + 1) % key.chars.length;
  backspace();
  appendText(key.chars[numTapIdx]);
}

function handleNumSpace() {
  numLastKey = null; numTapIdx = 0;
  appendText(' ');
}

// 자판 이미지는 numericMode/engActive 조합에 따라 셋 중 하나만 있을 수 있다 —
// 모드 전환 함수마다 따로 계산하면 한 곳만 고치고 잊어버리기 쉬워서(실제로 숫자판을
// 한 번 거친 뒤 약어 모드를 껐다 켜면 화면이 안 맞는 버그가 났었다) 한 군데로 모았다.
function updateKbdImage() {
  document.getElementById('kbd-image').src = numericMode
    ? 'images/bg_numeric_keyboard.png'
    : (state.engActive ? 'images/keyboard_eng.png' : 'images/keyboard.png');
}

// 우측 1/3 스와이프로 진입: 진입 직전이 영문이었는지 파카하라였는지 기억해뒀다가
// 닫기 키(handleNumDismiss)를 누르면 그 자리로 되돌아간다.
function enterNumericMode() {
  if (numericMode) return;
  lastNonNumericMode = state.engActive;
  numericMode = true;
  numLastKey = null; numTapIdx = 0;
  updateKbdImage();
  render();
}

function handleNumDismiss() {
  numericMode = false;
  numLastKey = null; numTapIdx = 0;
  state.engActive = lastNonNumericMode;
  updateKbdImage();
  render();
}

// ── 좌표 (이미지 1421×778 픽셀 실측 기준 %) ──────────────────────────────
const KEY_COLS = [1.55, 14.00, 26.39, 38.78, 51.16, 63.62, 76.14, 88.60];
const KEY_ROWS = [3.09, 27.89, 52.44];
const KEY_W = 9.53, KEY_H = 19.97;
const BOT_Y = 76.94, BOT_H = 19.84;
// 스페이스와 엔터 사이에 danda(।/॥/...) 전용 키가 새로 추가되면서 하단바가 4칸이 됨
const BOT_SECTIONS = { num:[1.18,21.13], space:[23.20,65.17], danda:[67.01,77.76], enter:[79.60,98.90] };

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
const ENG_BACKSPACE = { left:86.99, width:11.90 };
const ENG_BOT_Y = 77.08, ENG_BOT_H = 20.13;
const ENG_BOT = {
  num:   { left:1.29,  width:19.30 },
  space: { left:22.93, width:54.27 },
  enter: { left:79.46, width:19.12 },
};

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
const HIT_BOT_SECTIONS = expandAxisHitboxes(
  [BOT_SECTIONS.num[0], BOT_SECTIONS.space[0], BOT_SECTIONS.danda[0], BOT_SECTIONS.enter[0]],
  [BOT_SECTIONS.num[1] - BOT_SECTIONS.num[0], BOT_SECTIONS.space[1] - BOT_SECTIONS.space[0], BOT_SECTIONS.danda[1] - BOT_SECTIONS.danda[0], BOT_SECTIONS.enter[1] - BOT_SECTIONS.enter[0]]
);

// 영문 자판 히트박스 (행마다 칸 폭이 달라서 행별로 따로 계산)
const ENG_HIT_ROW1 = expandAxisHitboxes(ENG_ROW1_COLS, ENG_ROW1_COLS.map(() => ENG_KEY_W));
const ENG_HIT_ROW2 = expandAxisHitboxes(ENG_ROW2_COLS, ENG_ROW2_COLS.map(() => ENG_KEY_W));
const ENG_HIT_ROW3 = expandAxisHitboxes(
  [ENG_SHIFT.left, ...ENG_ROW3_COLS, ENG_BACKSPACE.left],
  [ENG_SHIFT.width, ...ENG_ROW3_COLS.map(() => ENG_KEY_W), ENG_BACKSPACE.width]
);
const ENG_HIT_ROWS = expandAxisHitboxes([...ENG_ROW_TOP, ENG_BOT_Y], [ENG_ROW_H, ENG_ROW_H, ENG_ROW_H, ENG_BOT_H]);
const ENG_HIT_BOT = expandAxisHitboxes(
  [ENG_BOT.num.left, ENG_BOT.space.left, ENG_BOT.enter.left],
  [ENG_BOT.num.width, ENG_BOT.space.width, ENG_BOT.enter.width]
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

// 숫자판이 떠 있는 동안의 중앙 스와이프는 "언어를 바꾸겠다"는 의도로 보기 어렵다 —
// 숫자판 진입 전이 힌디였든 영문이었든, 유저는 그냥 숫자판에서 빠져나가고 싶은
// 것뿐이지 굳이 반대 언어로 넘어가고 싶은 게 아니다(그러길 원했다면 애초에 우측
// 스와이프로 들어왔을 것). 그래서 숫자판 위에서는 우측 스와이프와 완전히 동일하게
// "진입 전 모드로 복귀"만 하고, 언어 자체를 뒤집지는 않는다.
function toggleEnglishMode() {
  if (numericMode) { handleNumDismiss(); return; }
  if (state.engActive) exitEnglishMode(); else enterEnglishMode();
}

// 우측 1/3 스와이프: 숫자판이 꺼져 있으면 진입, 이미 떠 있으면 진입 전 모드로 복귀
// (닫기 키와 동일한 동작) — 숫자판 안에서도 같은 스와이프로 다시 빠져나올 수 있어야 한다.
function toggleNumericMode() {
  if (numericMode) handleNumDismiss(); else enterNumericMode();
}

function handleEngLetter(ch) {
  appendText(state.engShiftState === 'off' ? ch.toLowerCase() : ch.toUpperCase());
  if (state.engShiftState === 'once') state.engShiftState = 'off';
  render();
}

function handleEngSpace() { appendText(' '); render(); }

function handleEngBackspace() {
  backspace();
  render();
}

function handleEngEnter() { appendText('\n'); render(); }

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

// 좌측 1/3 스와이프 = "약어 모드" 토글. 힌디/영문/숫자 어느 모드에 있든 상관없이
// 곧장 영문 대문자(시프트락) 상태로 보낸다 — 인도에서 약어를 대문자로 쓰는 관행을
// 반영해 "영문 모드"와는 별개 개념으로 취급한다(실제로는 engActive+lock 상태일 뿐).
// 이미 약어 모드라면 진입 직전 상태로 되돌아간다(숫자판 닫기와 같은 패턴).
// 약어 모드 안에서 대문자를 풀고 싶으면 물리 시프트키를 그대로 쓰면 된다(기존 handleShiftTap).
function isShortformActive() {
  return !numericMode && state.engActive && state.engShiftState === 'lock';
}

function toggleShortformMode() {
  if (shiftTapTimer) { clearTimeout(shiftTapTimer); shiftTapTimer = null; }
  if (isShortformActive()) {
    if (beforeShortform) {
      numericMode = beforeShortform.numericMode;
      state.engActive = beforeShortform.engActive;
      state.engShiftState = beforeShortform.engShiftState;
      beforeShortform = null;
    } else {
      numericMode = false; state.engActive = false; state.engShiftState = 'off';
    }
  } else {
    beforeShortform = { numericMode, engActive: state.engActive, engShiftState: state.engShiftState };
    numericMode = false;
    state.engActive = true;
    state.engShiftState = 'lock';
    state.activeRoot = null; state.activeCharIdx = 0;
    state.lastSignKey = null; state.signTapIdx = 0;
    state.independentMode = false;
  }
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

  kbd.appendChild(makeBtn('kbd-bs', {
    left: ENG_HIT_ROW3[8].start + '%', top: rowY[2].start + '%', width: ENG_HIT_ROW3[8].size + '%', height: rowY[2].size + '%'
  }, handleEngBackspace));

  kbd.appendChild(makeBtn('kbd-123', {
    left: ENG_HIT_BOT[0].start + '%', top: rowY[3].start + '%', width: ENG_HIT_BOT[0].size + '%', height: rowY[3].size + '%'
  }, showFavorites));

  kbd.appendChild(makeBtn('kbd-space', {
    left: ENG_HIT_BOT[1].start + '%', top: rowY[3].start + '%', width: ENG_HIT_BOT[1].size + '%', height: rowY[3].size + '%'
  }, handleEngSpace));

  kbd.appendChild(makeBtn('kbd-enter', {
    left: ENG_HIT_BOT[2].start + '%', top: rowY[3].start + '%', width: ENG_HIT_BOT[2].size + '%', height: rowY[3].size + '%'
  }, handleEngEnter));
}

// ── 간편 모드 전환: 자판 영역을 좌/중/우 1/3로 나눠 각 구역의 상하 스와이프에
// 서로 다른 동작을 배정한다 (좌: 약어 모드, 중앙: 힌디↔영문, 우: 숫자/기호).
// 방향은 상관없이 세로로 일정 거리 이상 스치면 발동하는 건 예전 방식 그대로다.
// 이제 한 지점(포인터 1개)만 있으면 되므로 터치 전용 이벤트 대신 Pointer Events를
// 쓴다 — 폰 터치와 PC 마우스 드래그를 같은 코드로 함께 지원하기 위함(PC에서도
// 마우스로 클릭+세로 드래그하면 테스트 가능).
// 세 구역 모두 파카하라/영문/숫자 어느 자판 위에서든 항상 똑같이 동작하는 "모드 전환"
// 스위치다 — 각자 목표 모드로 곧장 보내고, 이미 그 모드라면 토글로 진입 직전 상태로
// 되돌린다(좌: 약어 모드, 우: 숫자판과 동일한 패턴).
(function initSwipeGesture() {
  const wrap = document.getElementById('keyboard-wrap');
  let activePointerId = null;
  let startX = null, startY = null, triggered = false, zone = null;
  const SWIPE_MIN_PX = 28;       // 최소 이동 거리
  const SWIPE_V_H_RATIO = 1.3;   // 수직 이동이 수평 이동보다 이 배 이상이어야 스와이프로 인정(대각선 오조작 방지)

  function zoneOf(clientX) {
    const r = wrap.getBoundingClientRect();
    const ratio = (clientX - r.left) / r.width;
    if (ratio < 1 / 3) return 'left';
    if (ratio < 2 / 3) return 'center';
    return 'right';
  }

  wrap.addEventListener('pointerdown', (e) => {
    // 상용구 패널이 열려 있는 동안은 그 아래 자판으로 가는 모드 전환 스와이프가 함께
    // 발동하면 안 된다(패널 버튼 탭이 그대로 모드 전환으로 새는 걸 막기 위함).
    if (document.getElementById('fav-overlay').classList.contains('show')) return;
    if (activePointerId !== null) return; // 이미 다른 포인터를 추적 중이면 무시(오조작 방지)
    activePointerId = e.pointerId;
    startX = e.clientX; startY = e.clientY;
    triggered = false;
    zone = zoneOf(e.clientX);
  });

  wrap.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activePointerId || startX == null || triggered) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dy) < SWIPE_MIN_PX) return;
    if (Math.abs(dy) < Math.abs(dx) * SWIPE_V_H_RATIO) return;
    triggered = true;
    kbdGestureActive = true;
    // 이 스와이프가 시작된 키에 걸려 있던 롱프레스 타이머를 꺼서, 손을 오래 붙이고
    // 있는 스와이프가 "롱프레스" 안내 팝업으로 오인되지 않게 한다.
    if (pendingLongPressCancel) { pendingLongPressCancel(); pendingLongPressCancel = null; }
    // 스와이프가 확정된 순간 이 포인터를 wrap이 강제로 붙잡는다. 이게 없으면
    // 손가락이 wrap 밖(예: 바로 위 입력창)으로 빠져나간 채로 손을 뗄 때 pointerup이
    // wrap까지 전달되지 않아 kbdGestureActive가 true로 영원히 걸려버리고, 그 순간부터
    // 모든 키 입력이 무시되는 "먹통" 상태가 됐었다.
    try { wrap.setPointerCapture(e.pointerId); } catch (err) {}
    if (zone === 'left') runZoneAction('left', toggleShortformMode);
    else if (zone === 'center') runZoneAction('center', toggleEnglishMode);
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

  const handlers = {
    'num-single': (k) => () => handleNumSingle(k.char),
    'num-cycle':  (k, id) => () => handleNumCycle(id, k.chars),
    'num-bs':     () => handleNumBS(),
    'num-next':   () => handleNumNext(),
    'num-space':  () => handleNumSpace(),
  };

  for (let r = 0; r < 4; r++) {
    const rowTop = HIT_ROWS[r].start;
    const rowH   = HIT_ROWS[r].size;

    for (let c = 0; c < 8; c++) {
      const key = numericRows[r][c];
      if (key.type === 'num-skip') continue;

      const keyId = `n${r}c${c}`;
      const keyW = (key.type === 'num-space')
        ? (HIT_COLS[c].size + HIT_COLS[c + 1].size) + '%'  // 2칸 너비: 다음 칸 끝까지
        : HIT_COLS[c].size + '%';
      const style = { left: HIT_COLS[c].start + '%', top: rowTop + '%', width: keyW, height: rowH + '%' };
      const action = (key.type === 'num-single') ? handlers['num-single'](key)
                   : (key.type === 'num-cycle')  ? handlers['num-cycle'](key, keyId)
                   : handlers[key.type];
      kbd.appendChild(makeBtn('kbd-func', style, action));
    }
  }
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
  renderFavorites();
  document.getElementById('fav-overlay').classList.add('show');
}
function hideFavorites() {
  document.getElementById('fav-overlay').classList.remove('show');
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

      } else if (rk.type === 'bs') {
        kbd.appendChild(makeBtn('kbd-bs', style, handleBS));

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

  // 하단바: ☆(→상용구) | 스페이스/스와 | ●(단다) | 엔터
  const botRow = HIT_ROWS[3];
  kbd.appendChild(makeBtn('kbd-123', {
    left: HIT_BOT_SECTIONS[0].start + '%', top: botRow.start + '%', width: HIT_BOT_SECTIONS[0].size + '%', height: botRow.size + '%'
  }, showFavorites));

  kbd.appendChild(makeBtn('kbd-space', {
    left: HIT_BOT_SECTIONS[1].start + '%', top: botRow.start + '%', width: HIT_BOT_SECTIONS[1].size + '%', height: botRow.size + '%'
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

  // danda(।/॥/...) 키: 이미지가 공란이라 라벨을 직접 그린다. 다음키(K)와 같은 원칙으로
  // "방금 입력된 것"이 아니라 "다음 탭에서 입력될 것"을 미리 보여준다 — 기본(안 누른
  // 상태)은 다음 탭이 ।이므로 ।, 한 번 누른 뒤에는 다음 탭이 ॥이므로 ॥, 두 번 누른
  // 뒤에는 다음 탭이 세 점(...)째로 들어가므로 …, 세 번 이상 누른 뒤에는 계속 점만
  // 하나씩 늘어나므로 점(.) 하나로 고정 표시한다.
  const dandaNextIdx = state.lastSignKey === 'DANDA' ? state.signTapIdx + 1 : 0;
  const dandaCh = dandaNextIdx === 0 ? '।' : dandaNextIdx === 1 ? '॥' : dandaNextIdx === 2 ? '…' : '.';
  const dandaBtn = makeBtn('kbd-label count-1', {
    left: HIT_BOT_SECTIONS[2].start + '%', top: botRow.start + '%', width: HIT_BOT_SECTIONS[2].size + '%', height: botRow.size + '%'
  }, handleDanda);
  const dandaSp = document.createElement('span');
  dandaSp.className = 'label-item'; dandaSp.textContent = dandaCh;
  dandaBtn.appendChild(dandaSp);
  kbd.appendChild(dandaBtn);

  kbd.appendChild(makeBtn('kbd-enter', {
    left: HIT_BOT_SECTIONS[3].start + '%', top: botRow.start + '%', width: HIT_BOT_SECTIONS[3].size + '%', height: botRow.size + '%'
  }, handleEnter));
}

function resetAll() {
  if (shiftTapTimer) { clearTimeout(shiftTapTimer); shiftTapTimer = null; }
  kbdGestureActive = false; // 혹시 제스처 추적이 꼬여 키 입력이 막혀 있었더라도 리셋으로는 항상 풀리도록
  setText('');
  state = {
    activeRoot:null, activeCharIdx:0, lastSignKey:null, signTapIdx:0, signIndepMode:false, independentMode:false,
    engActive:false, engShiftState:'off',
  };
  numericMode = false; lastNonNumericMode = false; numLastKey = null; numTapIdx = 0;
  beforeShortform = null;
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
