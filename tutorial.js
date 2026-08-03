// ── 첫 실행 튜토리얼 ────────────────────────────────────────────────────
// 1단계: 좌/중/우 1/3 스와이프로 모드 전환하는 법을 몸으로 익힌다.
// 2단계: 자음(क→ख) + 모음 멀티탭(ी)을 실제로 조합해본다.
// keyboard.js와 같은 전역 스코프를 공유하므로(둘 다 모듈이 아닌 일반 <script>),
// state/HIT_COLS/HIT_ROWS/consonantGroups/render() 등을 그대로 참조한다.

const TUT = {
  welcome:      'स्वागत है! आइए, इसका आसान तरीका सीखें।',
  centerSwipe1: 'अब कीबोर्ड के बीच से ऊपर स्वाइप करें।',
  centerSwipe2: 'शाबाश! यह हिंदी और अंग्रेजी के बीच बदलने के लिए है। एक बार फिर स्वाइप करें।',
  rightSwipe:   'बहुत बढ़िया! अब दाईं तरफ से ऊपर की ओर स्वाइप करें।',
  leftSwipe:    'बहुत बढ़िया! अब बाईं तरफ से ऊपर की ओर स्वाइप करें।',
  capsInfo:     'बहुत बढ़िया! यह कैपिटल मोड है। यह शॉर्ट फॉर्म टाइप करने के लिए उपयोगी है।',
  typeKha:      "अब 'ख' टाइप करें।",
  typeKhi:      "अब 'ख' के बाद 'ी' टाइप करें।",
  tapAgain:     'एक बार और दबाएं।',
  outro:        'बहुत-बहुत धन्यवाद! अब पाकाहारा का उपयोग शुरू करें।',
};

// 스와이프 존 단계에서 각 단계가 기다리는 존. 여기 없는 단계(조합 단계 등)에서는
// 어떤 스와이프가 와도 막고 흔들기만 한다.
const ZONE_STEP_TARGET = { 'center-1': 'center', 'center-2': 'center', 'right-1': 'right', 'left-1': 'left' };
const ZONE_RECT = {
  left:   { left: '0%',      width: '33.333%' },
  center: { left: '33.333%', width: '33.333%' },
  right:  { left: '66.666%', width: '33.334%' },
};

let tutorialActive = false;
let tutorialStep = null; // 'center-1' | 'center-2' | 'right-1' | 'left-1' | 'caps-info' | 'kha-cons' | 'kha-next' | 'khi-1' | 'khi-2' | 'outro'
const els = {};

function q(id) { return document.getElementById(id); }

function initTutorialDom() {
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
  els.startBtn.addEventListener('click', beginZoneSteps);
}

function startTutorial() {
  initTutorialDom();
  tutorialActive = true;
  zoneSwipeInterceptor = handleZoneSwipe;
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

function showZoneStep(zone, text) {
  els.text.textContent = text;
  els.banner.classList.add('show');
  els.keyArrow.classList.add('hidden');
  Object.assign(els.zoneArrow.style, ZONE_RECT[zone]);
  els.zoneArrow.classList.remove('hidden');
  // 왼쪽 스와이프만 왼손 엄지 그림으로 보여준다(나머지는 오른손)
  const isLeft = zone === 'left';
  els.thumbImg.src = isLeft ? 'images/l-thumb.png' : 'images/r-thumb.png';
  els.thumbWrap.classList.toggle('shift-left', isLeft);
  els.thumbWrap.classList.toggle('shift-right', !isLeft);
  els.thumbWrap.classList.remove('play');
  els.swipeBgArrow.classList.remove('play');
  if (thumbTimer) clearTimeout(thumbTimer);
  thumbTimer = setTimeout(playThumb, READ_DELAY_MS);
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

function shakeBanner() {
  els.banner.classList.remove('shake');
  void els.banner.offsetWidth; // 리플로우를 강제해 같은 애니메이션을 다시 재생시킨다
  els.banner.classList.add('shake');
}

// 스와이프 존 게이트: keyboard.js의 runZoneAction()이 스와이프가 확정될 때마다 호출한다.
function handleZoneSwipe(zone, defaultFn) {
  if (!tutorialActive) { defaultFn(); return; }
  const expected = ZONE_STEP_TARGET[tutorialStep];
  if (!expected || zone !== expected) {
    shakeBanner();
    if (thumbTimer) clearTimeout(thumbTimer); // 이미 한 번 안내를 봤으니 지체 없이 바로 다시 보여준다
    playThumb();
    return;
  }
  defaultFn();
  advanceZoneStep();
}

function advanceZoneStep() {
  if (tutorialStep === 'center-1') {
    tutorialStep = 'center-2';
    showZoneStep('center', TUT.centerSwipe2);
  } else if (tutorialStep === 'center-2') {
    setProgress(1);
    tutorialStep = 'right-1';
    showZoneStep('right', TUT.rightSwipe);
  } else if (tutorialStep === 'right-1') {
    setProgress(2);
    tutorialStep = 'left-1';
    showZoneStep('left', TUT.leftSwipe);
  } else if (tutorialStep === 'left-1') {
    setProgress(3);
    tutorialStep = 'caps-info';
    els.text.textContent = TUT.capsInfo;
    if (thumbTimer) clearTimeout(thumbTimer);
    els.zoneArrow.classList.add('hidden');
    setTimeout(beginComposeSteps, 3000);
  }
}

// ── 2단계: ख + ी 조합 ──────────────────────────────────────────────────
function beginComposeSteps() {
  resetAll(); // 빈 힌디 화면으로 되돌려서 조합 단계를 깨끗하게 시작
  tutorialStep = 'kha-cons';
  els.text.textContent = TUT.typeKha;
  positionKeyArrow(1, 1); // क (leftKeys 1행 1열)
  els.demoBox.textContent = '';
  els.demoBox.classList.add('show'); // 조합 단계 동안만 크게 보여주는 데모 전용 글상자
  positionDemoBox();
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

// 배너 문구 길이(1~2줄)에 따라 배너 높이가 달라지므로, 데모 글상자를 배너 바로 위
// 일정 간격을 두고 다시 계산해서 배치한다 — 고정 %값으로는 겹치는 경우가 있었다.
function positionDemoBox() {
  const wrapRect = els.banner.offsetParent.getBoundingClientRect();
  const bannerRect = els.banner.getBoundingClientRect();
  const GAP = 16;
  els.demoBox.style.bottom = (wrapRect.bottom - bannerRect.top + GAP) + 'px';
}

function checkComposeProgress() {
  els.demoBox.textContent = getText();
  positionDemoBox();
  if (tutorialStep === 'kha-cons') {
    if (state.activeRoot === 'क' && state.activeCharIdx === 0) {
      tutorialStep = 'kha-next';
      positionKeyArrow(1, 6); // 다음키(K, rightKeys 1행 1열 → 이미지 6열)
    } else if (state.activeRoot || state.lastSignKey) {
      shakeBanner();
    }

  } else if (tutorialStep === 'kha-next') {
    if (state.activeRoot === 'क' && state.activeCharIdx === 1) {
      setProgress(4);
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
      setProgress(5);
      finishTutorial();
    } else if ((state.lastSignKey && state.lastSignKey !== 'L') || state.activeRoot) {
      shakeBanner();
      tutorialStep = 'khi-1';
      els.text.textContent = TUT.typeKhi;
    }
  }
}

function finishTutorial() {
  onTutorialRender = null;
  tutorialStep = 'outro';
  if (keyArrowTimer) clearTimeout(keyArrowTimer);
  els.keyArrow.classList.add('hidden');
  els.text.textContent = TUT.outro;
  setTimeout(() => {
    els.banner.classList.remove('show');
    els.demoBox.classList.remove('show');
    tutorialActive = false;
    resetAll();
  }, 2600);
}
