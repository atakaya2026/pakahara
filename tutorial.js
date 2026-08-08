// ── 첫 실행 튜토리얼 ────────────────────────────────────────────────────
// 1단계: 좌/중/우 1/3 스와이프 + 삭제(우측 좌향 가로 스와이프)로 모드 전환/삭제하는
// 법을 몸으로 익힌다.
// 2단계: 자음(क→ख) + 모음 멀티탭(ी)을 실제로 조합해본다.
// keyboard.js와 같은 전역 스코프를 공유하므로(둘 다 모듈이 아닌 일반 <script>),
// state/HIT_COLS/HIT_ROWS/consonantGroups/render()/isShortformActive() 등을
// 그대로 참조한다.

// 새로 추가된 멘트(capsDouble/leftSwipe/deleteSwipe)는 일단 한글 그대로 두고
// 나중에 힌디어로 교체한다. 나머지는 기존 힌디어 멘트를 그대로 쓴다.
const TUT = {
  welcome:      'स्वागत है! आइए, इसका आसान तरीका सीखें।',
  centerSwipe1: 'अब कीबोर्ड के बीच से ऊपर स्वाइप करें।',
  centerSwipe2: 'शाबाश! यह हिंदी और अंग्रेजी के बीच बदलने के लिए है। एक बार फिर स्वाइप करें।',
  capsDouble:   '2번 연속 스와이프를 하면 약어 모드로 됩니다.',
  rightSwipe:   'बहुत बढ़िया! अब दाईं तरफ से ऊपर की ओर स्वाइप करें।',
  leftSwipe:    '왼쪽에서 스와이프를 하면 상용구가 호출됩니다.',
  typeKha:      "अब 'ख' टाइप करें।",
  typeKhi:      "अब 'ख' के बाद 'ी' टाइप करें।",
  tapAgain:     'एक बार और दबाएं।',
  deleteSwipe:  '우측에서 좌측으로 스와이프를 하면 한 글자를 지울 수 있어요.',
  outro:        'बहुत-बहुत धन्यवाद! अब पाकाहारा का उपयोग शुरू करें।',
};

// 스와이프 존 단계에서 각 단계가 기다리는 존. 여기 없는 단계(조합 단계 등)에서는
// 어떤 스와이프가 와도 막고 흔들기만 한다. 'delete'는 세로 우측 스와이프(숫자판)와
// 구분하기 위해 keyboard.js가 삭제 스와이프에만 붙이는 전용 태그다.
const ZONE_STEP_TARGET = {
  'center-1': 'center', 'center-2': 'center', 'caps-double': 'center',
  'right-1': 'right', 'left-1': 'left', 'delete-1': 'delete',
};
const ZONE_RECT = {
  left:   { left: '0%',      width: '33.333%' },
  center: { left: '33.333%', width: '33.333%' },
  right:  { left: '66.666%', width: '33.334%' },
};

let tutorialActive = false;
// 'center-1' | 'center-2' | 'caps-double' | 'right-1' | 'left-1' |
// 'kha-cons' | 'kha-next' | 'khi-1' | 'khi-2' | 'delete-1' | 'outro'
let tutorialStep = null;
const els = {};

function q(id) { return document.getElementById(id); }

function initTutorialDom() {
  els.actionBar = q('action-bar');
  els.topbar = q('tutorial-topbar');
  els.backBtn = q('tutorial-back-btn');
  els.introOverlay = q('tutorial-intro-overlay');
  els.introText = q('tutorial-intro-text');
  els.startBtn = q('tutorial-start-btn');
  els.banner = q('tutorial-banner');
  els.text = q('tutorial-text');
  els.segs = Array.from(q('tutorial-progress').querySelectorAll('.seg'));
  els.zoneArrow = q('tutorial-zone-arrow');
  els.swipeBgArrow = q('tutorial-swipe-bg-arrow');
  els.thumbWrap = q('tutorial-thumb-wrap');
  els.thumbImg = q('tutorial-thumb-img');
  els.keyArrow = q('tutorial-key-arrow');
  els.demoBox = q('tutorial-demo-box');
  els.demoText = q('tutorial-demo-text');
  els.startBtn.addEventListener('click', beginZoneSteps);
  els.backBtn.addEventListener('click', restartTutorial);
}

function startTutorial() {
  initTutorialDom();
  tutorialActive = true;
  zoneSwipeInterceptor = handleZoneSwipe;
  els.actionBar.classList.add('tutorial-hidden');
  els.topbar.classList.add('show');
  restartTutorial();
}

// 뒤로가기 버튼: 지금까지의 진행을 버리고 튜토리얼을 맨 처음(환영 카드)부터 다시 시작한다.
function restartTutorial() {
  clearThumbTimers();
  if (keyArrowTimer) clearTimeout(keyArrowTimer);
  onTutorialRender = null;
  tutorialStep = null;
  resetAll();
  els.zoneArrow.classList.add('hidden');
  els.keyArrow.classList.add('hidden');
  els.demoText.textContent = '';
  els.banner.classList.remove('shake');
  setProgress(0);
  els.introText.textContent = TUT.welcome;
  els.introOverlay.classList.add('show');
}

function beginZoneSteps() {
  els.introOverlay.classList.remove('show');
  setProgress(0);
  tutorialStep = 'center-1';
  showZoneStep('center', TUT.centerSwipe1);
}

function setProgress(n) {
  els.segs.forEach((s, i) => s.classList.toggle('done', i < n));
}

// 문구가 뜨자마자 엄지/화살표가 같이 나오면 아직 문구도 다 못 읽었는데 리듬이 어색해서,
// 문구를 먼저 보여주고 한 박자 쉬었다가 엄지 스와이프나 키 화살표를 보여준다.
const READ_DELAY_MS = 2000;
let thumbTimer = null;

// 예약해둔 자동 시범 재생(thumbTimer/capsDemoTimer)을 한꺼번에 취소한다. 유저가 이미
// 실제로 스와이프해서 다음 화면으로 넘어갔거나 다른 피드백이 즉시 나가는 상황인데
// 예전 단계에서 걸어둔 타이머가 나중에 뒤늦게 발동하면, 이미 지나간 단계의 애니메이션이
// 뜬금없이 다시 튀어나오는 것처럼 보인다 — 그래서 새로 뭔가 보여줄 때마다 항상 먼저 정리한다.
function clearThumbTimers() {
  if (thumbTimer) { clearTimeout(thumbTimer); thumbTimer = null; }
  if (capsDemoTimer) { clearTimeout(capsDemoTimer); capsDemoTimer = null; }
}

// 지금 단계에서 "다시 보여줘야 할" 애니메이션 함수 — 오답 피드백/자동재생이 공용으로
// 쓴다. 세로 스와이프 단계면 playThumb, 삭제(가로) 단계면 playThumbHorizontal.
let currentReplayFn = () => {};

function showZoneStep(zone, text) {
  els.text.textContent = text;
  els.keyArrow.classList.add('hidden');
  Object.assign(els.zoneArrow.style, ZONE_RECT[zone]);
  els.zoneArrow.classList.remove('hidden');
  // 왼쪽 스와이프만 왼손 엄지 그림으로 보여준다(나머지는 오른손)
  const isLeft = zone === 'left';
  els.thumbImg.src = isLeft ? 'images/l-thumb.png' : 'images/r-thumb.png';
  els.thumbWrap.classList.remove('shift-h'); // 삭제 단계에서 넘어온 경우 잔여 클래스 정리
  els.thumbWrap.classList.toggle('shift-left', isLeft);
  els.thumbWrap.classList.toggle('shift-right', !isLeft);
  els.thumbWrap.classList.remove('play');
  els.swipeBgArrow.src = 'images/swipe.png'; // 삭제 단계에서 넘어온 경우 가로 화살표 잔여 정리
  els.swipeBgArrow.classList.remove('horiz', 'play');
  currentReplayFn = playThumb;
  clearThumbTimers();
  thumbTimer = setTimeout(currentReplayFn, READ_DELAY_MS);
}

// 대문자(약어) 단계 전용 셋업. 메시지가 "2번 연속 스와이프"를 설명하므로, 유저가
// 시도하기도 전에 시범 자체를 스와이프 두 번으로 보여준다(playCapsDemo). 존/엄지
// 방향은 가운데 스와이프와 같아서 showZoneStep과 거의 같지만 재생 함수만 다르다.
function showCapsDoubleStep() {
  showZoneStep('center', TUT.capsDouble); // 존/엄지/화살표 세팅 재사용
  // showZoneStep이 이미 playThumb(단일 재생) 타이머를 예약해뒀으니, 그걸 취소하고
  // 이 단계 전용 재생 함수(playCapsDemo, 2회 재생)로 다시 예약한다.
  clearThumbTimers();
  currentReplayFn = playCapsDemo;
  thumbTimer = setTimeout(currentReplayFn, READ_DELAY_MS);
}

// 삭제 스와이프(우측 좌향 가로) 데모 단계 전용 셋업 — 세로 스와이프 단계들과 존/애니메이션
// 방향이 달라서 showZoneStep과 분리했다.
function showDeleteStep() {
  // 직전(khi-1/khi-2) 단계에서 걸어둔 키 화살표 예약을 취소한다 — 안 그러면 조합
  // 단계에서 쓰던 "모음키 누르라는" 화살표가 여기 hidden 처리 후에도 뒤늦게 다시
  // 나타난다(positionKeyArrow의 setTimeout이 아직 살아있어서).
  if (keyArrowTimer) { clearTimeout(keyArrowTimer); keyArrowTimer = null; }
  els.text.textContent = TUT.deleteSwipe;
  els.demoText.textContent = getText();
  els.keyArrow.classList.add('hidden');
  Object.assign(els.zoneArrow.style, ZONE_RECT.right);
  els.zoneArrow.classList.remove('hidden');
  els.thumbImg.src = 'images/r-thumb.png';
  els.thumbWrap.classList.remove('shift-left', 'shift-right', 'play');
  els.thumbWrap.classList.add('shift-h');
  els.swipeBgArrow.src = 'images/leftswipe.png'; // 좌향 전용 배경 화살표(swipe.png의 가로 버전)
  els.swipeBgArrow.classList.add('horiz');
  els.swipeBgArrow.classList.remove('play');
  currentReplayFn = playThumbHorizontal;
  clearThumbTimers();
  thumbTimer = setTimeout(currentReplayFn, READ_DELAY_MS);
}

// 엄지 스와이프 애니메이션을 한 번만 재생한다(반복 재생 X). 같은 단계에서 다시
// 보여줘야 할 때(오답 피드백 등)도 이 함수로 처음부터 재생시킨다. 엄지 밑에 깔리는
// 배경 화살표도 같이 재생시킨다 — 엄지가 사라진 뒤에도 화살표는 더 오래 남아 있다가
// 스스로 천천히 옅어진다(각자 애니메이션 길이가 달라서 따로 재생시켜야 한다).
function playThumb() {
  els.thumbWrap.classList.remove('play');
  void els.thumbWrap.offsetWidth; // 리플로우를 강제해 애니메이션을 처음부터 다시 재생시킨다
  els.thumbWrap.classList.add('play');

  els.swipeBgArrow.classList.remove('play');
  void els.swipeBgArrow.offsetWidth;
  els.swipeBgArrow.classList.add('play');
}

// 가로(삭제) 버전 — leftswipe.png 배경 화살표와 함께 엄지가 오른쪽에서 왼쪽으로 훑는다.
function playThumbHorizontal() {
  els.thumbWrap.classList.remove('play');
  void els.thumbWrap.offsetWidth;
  els.thumbWrap.classList.add('play');

  els.swipeBgArrow.classList.remove('play');
  void els.swipeBgArrow.offsetWidth;
  els.swipeBgArrow.classList.add('play');
}

// "2번 연속 스와이프"를 유저가 시도하기 전에 미리 시범으로 보여준다 — 손을 뗐다가
// 다시 짚는 리듬을 흉내내려고 짧은 간격(CAPS_DEMO_GAP_MS)을 두고 playThumb을 두 번
// 잇달아 재생한다. 오답 피드백이나 첫 스와이프 후 재시도 안내에도 이 함수를 그대로 쓴다.
const CAPS_DEMO_GAP_MS = 550;
let capsDemoTimer = null;
function playCapsDemo() {
  if (capsDemoTimer) clearTimeout(capsDemoTimer);
  playThumb();
  capsDemoTimer = setTimeout(playThumb, CAPS_DEMO_GAP_MS);
}

function shakeBanner() {
  els.banner.classList.remove('shake');
  void els.banner.offsetWidth; // 리플로우를 강제해 같은 애니메이션을 다시 재생시킨다
  els.banner.classList.add('shake');
}

// 스와이프 존 게이트: keyboard.js의 runZoneAction()이 스와이프가 확정될 때마다 호출한다.
function handleZoneSwipe(zone, defaultFn) {
  if (!tutorialActive) { defaultFn(); return; }
  // 유저가 실제로 스와이프를 했다는 뜻이므로, 결과가 맞았든 틀렸든 예약해둔 자동 시범
  // 재생은 여기서 취소한다 — 안 그러면 유저가 방금 자기 손으로 스와이프한 직후에
  // 예전에 걸어둔 자동재생 타이머가 뒤늦게 발동해서 애니메이션이 또 튀어나온다.
  clearThumbTimers();
  const expected = ZONE_STEP_TARGET[tutorialStep];
  if (!expected || zone !== expected) {
    shakeBanner();
    currentReplayFn(); // 이미 한 번 안내를 봤으니 지체 없이 바로 다시 보여준다
    return;
  }
  defaultFn();
  advanceZoneStep();
}

function advanceZoneStep() {
  if (tutorialStep === 'center-1') {
    tutorialStep = 'center-2';
    // center-1의 스와이프가 남긴 타이밍이 center-2의 스와이프와 우연히 더블로 묶이면
    // (윈도우가 1.5초라 유저가 좀 빠르게 반응하면 실제로 일어난다) center-2에서 아직
    // 배우지도 않은 약어 모드가 미리 켜져버린다. 매 center 단계 진입마다 리셋해서
    // 이전 단계의 스와이프가 다음 단계로 새어 들어가지 않게 한다.
    lastCenterSwipeTime = 0;
    showZoneStep('center', TUT.centerSwipe2);

  } else if (tutorialStep === 'center-2') {
    setProgress(1);
    tutorialStep = 'caps-double';
    lastCenterSwipeTime = 0; // 위와 같은 이유로, caps-double 진입 시점에도 다시 리셋

    showCapsDoubleStep();

  } else if (tutorialStep === 'caps-double') {
    // handleCenterSwipe(keyboard.js)가 단일/연속 2회 스와이프 판정을 이미 갖고 있어서,
    // 여기선 매 스와이프를 그냥 통과시키고 실제로 약어 모드에 들어갔는지(isShortformActive)만
    // 보고 다음 단계로 넘어갈지 정한다. 안 들어갔으면 방금 건 첫 스와이프였다는 뜻인데,
    // 유저가 방금 자기 손으로 스와이프한 것 자체가(실제 언어 토글이 눈에 보이니) 충분한
    // 피드백이라 여기서 시범 애니메이션을 또 재생하지 않는다 — 재생하면 "왜 자꾸 또
    // 나오지" 하고 헷갈린다. 조용히 두 번째 스와이프를 기다린다.
    if (isShortformActive()) {
      setProgress(2);
      tutorialStep = 'right-1';
      showZoneStep('right', TUT.rightSwipe);
    }

  } else if (tutorialStep === 'right-1') {
    setProgress(3);
    tutorialStep = 'left-1';
    showZoneStep('left', TUT.leftSwipe);

  } else if (tutorialStep === 'left-1') {
    setProgress(4);
    // 상용구 패널이 실제로 열리는 걸 눈으로 보여줘야 하니, 곧장 조합 단계로 넘어가지
    // 않고 잠깐 그대로 보여준 뒤에 닫는다 — beginComposeSteps()의 resetAll()이 패널을
    // 곧바로 닫아버려서, 지연 없이 바로 부르면 열렸다가 닫히는 게 한 프레임도 안
    // 그려진 채(같은 동기 실행 안에서) 지나가 버렸었다.
    setTimeout(beginComposeSteps, 1800);

  } else if (tutorialStep === 'delete-1') {
    setProgress(5);
    finishTutorial();
  }
}

// ── 2단계: ख + ी 조합 ──────────────────────────────────────────────────
function beginComposeSteps() {
  clearThumbTimers();
  els.zoneArrow.classList.add('hidden');
  resetAll(); // 빈 힌디 화면으로 되돌려서 조합 단계를 깨끗하게 시작
  tutorialStep = 'kha-cons';
  els.text.textContent = TUT.typeKha;
  positionKeyArrow(1, 1); // क (leftKeys 1행 1열)
  els.demoText.textContent = '';
  onTutorialRender = checkComposeProgress;
}

// 스와이프 엄지와 같은 리듬: 문구가 먼저 보이고, 한 박자 쉬었다가 화살표가 나타난다.
let keyArrowTimer = null;

function positionKeyArrow(row, col) {
  const c = HIT_COLS[col], r = HIT_ROWS[row];
  Object.assign(els.keyArrow.style, {
    left: c.start + '%', width: c.size + '%',
    top: (r.start - 9) + '%', height: '9%',
  });
  els.keyArrow.classList.add('hidden');
  if (keyArrowTimer) clearTimeout(keyArrowTimer);
  keyArrowTimer = setTimeout(() => els.keyArrow.classList.remove('hidden'), READ_DELAY_MS);
}

function checkComposeProgress() {
  els.demoText.textContent = getText();
  if (tutorialStep === 'kha-cons') {
    if (state.activeRoot === 'क' && state.activeCharIdx === 0) {
      tutorialStep = 'kha-next';
      positionKeyArrow(1, 6); // 다음키(K, rightKeys 1행 1열 → 이미지 6열)
    } else if (state.activeRoot || state.lastSignKey) {
      shakeBanner();
    }

  } else if (tutorialStep === 'kha-next') {
    if (state.activeRoot === 'क' && state.activeCharIdx === 1) {
      tutorialStep = 'khi-1';
      els.text.textContent = TUT.typeKhi;
      positionKeyArrow(1, 7); // L키(모음, rightKeys 1행 2열 → 이미지 7열)
    } else if (state.activeRoot !== 'क' || state.lastSignKey) {
      shakeBanner();
      tutorialStep = 'kha-cons';
      els.text.textContent = TUT.typeKha;
      positionKeyArrow(1, 1);
    }

  } else if (tutorialStep === 'khi-1') {
    if (state.lastSignKey === 'L' && state.signTapIdx === 0) {
      tutorialStep = 'khi-2';
      els.text.textContent = TUT.tapAgain;
    } else if ((state.lastSignKey && state.lastSignKey !== 'L') || state.activeRoot) {
      shakeBanner();
    }

  } else if (tutorialStep === 'khi-2') {
    if (state.lastSignKey === 'L' && state.signTapIdx === 1) {
      tutorialStep = 'delete-1';
      showDeleteStep(); // ख + ी가 완성된 상태(खी) 그대로 이어서 삭제 스와이프를 가르친다
    } else if ((state.lastSignKey && state.lastSignKey !== 'L') || state.activeRoot) {
      shakeBanner();
      tutorialStep = 'khi-1';
      els.text.textContent = TUT.typeKhi;
    }
  }
  // 'delete-1' 단계는 여기서 별도로 할 일이 없다 — 위 els.demoText 갱신이면 충분하고,
  // 실제 진행 판정은 스와이프 존 게이트(handleZoneSwipe → advanceZoneStep)가 맡는다.
}

function finishTutorial() {
  onTutorialRender = null;
  tutorialStep = 'outro';
  if (keyArrowTimer) clearTimeout(keyArrowTimer);
  els.keyArrow.classList.add('hidden');
  els.text.textContent = TUT.outro;
  setTimeout(() => {
    els.topbar.classList.remove('show');
    els.actionBar.classList.remove('tutorial-hidden');
    tutorialActive = false;
    resetAll();
  }, 2600);
}
