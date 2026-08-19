/* ==========================================================================
   bootstrap.js — DESIGN 부록 E
   <head>에서 렌더 차단으로 실행해 FOUC를 막는다.
   확장(MV3)은 인라인 스크립트를 금지하므로 웹·확장 모두 이 파일을 쓴다.
   ========================================================================== */
(function () {
  var root = document.documentElement;

  /* 티어 A — 굴절.
     Chromium만 backdrop-filter에서 SVG 필터 참조를 실제로 렌더한다.
     @supports는 파싱 가능성만 검사하므로 감지에 쓸 수 없다 (DESIGN §11.1) */
  var ua = navigator.userAgent;
  var isWebKit = /AppleWebKit/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua);
  var isGecko  = /Gecko\//.test(ua) && /Firefox/.test(ua);
  root.classList.toggle('lg-refract',
    CSS.supports('backdrop-filter', 'blur(1px)') && !isWebKit && !isGecko);

  /* 티어 D — 저사양 / 배터리 절약 */
  var conn = navigator.connection;
  root.classList.toggle('lg-lowend',
    (conn && conn.saveData === true)
    || (navigator.deviceMemory === undefined ? 8 : navigator.deviceMemory) <= 4
    || (navigator.hardwareConcurrency === undefined ? 8 : navigator.hardwareConcurrency) <= 4);

  /* 티어 C — 사용자 저장 설정. 미디어 쿼리 신호는 CSS가 처리한다 (§12.2) */
  try {
    if (localStorage.getItem('transparency') === 'off') root.dataset.transparency = 'off';
    if (localStorage.getItem('motion') === 'off') root.dataset.motion = 'off';
    var t = localStorage.getItem('theme');
    if (t === 'light' || t === 'dark') root.dataset.theme = t;

    /* 유리 투명도 — 첫 페인트 전에 복원해야 값이 튀지 않는다.
       접근성 분기가 켜져 있으면 CSS가 불투명으로 덮으므로 여기서 따로 막지 않는다 */
    var g = parseFloat(localStorage.getItem('glassLevel'));
    if (isFinite(g) && g >= 0.25 && g <= 1.6) {
      root.style.setProperty('--glass-level', String(g));
    }
  } catch (e) {}
})();
