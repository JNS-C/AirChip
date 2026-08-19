/* ==========================================================================
   grade.js — 등급 계산 · 표현 · 정적 조언 폴백
   웹(index.html)과 확장(popup.html)이 공유한다. 모듈이 아니라 전역 스크립트다.
   경계값의 원본은 PRD §4.5 (환경부 4단계). api/_lib.js에도 같은 표가 있다.
   ========================================================================== */
(function (global) {
  'use strict';

  /* PRD §4.5 — PM10 0~30 / 31~80 / 81~150 / 151+, PM2.5 0~15 / 16~35 / 36~75 / 76+ */
  var THRESHOLDS = {
    pm10: [30, 80, 150],
    pm25: [15, 35, 75]
  };

  var GRADE_LABEL = { 0: '측정 불가', 1: '좋음', 2: '보통', 3: '나쁨', 4: '매우나쁨' };

  /* 등급 아이콘 — 색 단독 구분 금지(§12.1). 흑백에서도 형태로 구분된다.
     1 원 / 2 사각 / 3 삼각 / 4 삼각+느낌표 */
  var GRADE_ICON = {
    0: '<path d="M2 6.5h9v2H2z"/>',
    1: '<circle cx="6.5" cy="6.5" r="4.5"/>',
    2: '<rect x="2.5" y="2.5" width="8" height="8" rx="1.5"/>',
    3: '<path d="M6.5 1.5 12 11.5H1z"/>',
    4: '<path d="M6.5 1.5 12 11.5H1z"/><path d="M6.5 5v3.1" stroke="#fff" stroke-width="1.4" stroke-linecap="round" fill="none"/><circle cx="6.5" cy="9.9" r=".8" fill="#fff"/>'
  };

  /* 문자열 예보 등급 → 숫자. 예보 응답은 등급이 이미 문자열로 온다(§4.5) */
  var TEXT_TO_GRADE = {
    '좋음': 1, '보통': 2, '나쁨': 3, '매우나쁨': 4,
    '매우 나쁨': 4, '한때나쁨': 3, '한때 나쁨': 3
  };

  function gradeOf(kind, value) {
    if (value === null || value === undefined || value === '' || Number.isNaN(value)) return 0;
    var t = THRESHOLDS[kind];
    if (!t) return 0;
    var n = Number(value);
    if (!Number.isFinite(n)) return 0;
    if (n <= t[0]) return 1;
    if (n <= t[1]) return 2;
    if (n <= t[2]) return 3;
    return 4;
  }

  function gradeFromText(text) {
    if (!text) return 0;
    var key = String(text).trim();
    return TEXT_TO_GRADE[key] || 0;
  }

  function gradeLabel(g) { return GRADE_LABEL[g] || GRADE_LABEL[0]; }

  /* 배지 마크업 — 색 + 텍스트 + 아이콘 3중 */
  function badgeHTML(g, extraText) {
    var label = gradeLabel(g);
    return '<span class="badge" data-grade="' + g + '">' +
           '<svg viewBox="0 0 13 13" aria-hidden="true">' + (GRADE_ICON[g] || '') + '</svg>' +
           '<span>' + label + (extraText ? ' ' + extraText : '') + '</span>' +
           '</span>';
  }

  /* ------------------------------------------------------------------------
     정적 조언 폴백 테이블 (PRD §5.2)
     AI보다 먼저 존재한다. Gemini가 죽어도 화면은 절대 비우지 않는다.
     기준: PM10·PM2.5 중 더 나쁜 등급
     ------------------------------------------------------------------------ */
  var FALLBACK_ADVICE = {
    0: {
      ventilation: '측정값이 없어 환기 판단이 어렵습니다.',
      mask: '외출 시 마스크를 챙기면 안전합니다.',
      exercise: '실외 운동은 상황을 보고 정하세요.'
    },
    1: {
      ventilation: '공기가 좋습니다. 창문을 활짝 열어도 됩니다.',
      mask: '마스크 없이 다녀도 괜찮습니다.',
      exercise: '실외 운동하기 좋은 날입니다.'
    },
    2: {
      ventilation: '짧게 환기하는 정도가 적당합니다.',
      mask: '민감군만 마스크를 쓰면 충분합니다.',
      exercise: '실외 운동은 무리하지 않는 선에서 하세요.'
    },
    3: {
      ventilation: '환기는 짧게, 공기청정기를 함께 켜세요.',
      mask: 'KF80 이상 마스크를 쓰고 나가세요.',
      exercise: '실외 운동은 실내로 옮기는 편이 좋습니다.'
    },
    4: {
      ventilation: '창문을 닫고 실내 공기를 지키세요.',
      mask: 'KF94 마스크 착용을 권합니다.',
      exercise: '실외 운동은 오늘 쉬는 것이 좋습니다.'
    }
  };

  function fallbackAdvice(pm10Grade, pm25Grade) {
    var worst = Math.max(pm10Grade || 0, pm25Grade || 0);
    return Object.assign({}, FALLBACK_ADVICE[worst] || FALLBACK_ADVICE[0]);
  }

  var API = {
    THRESHOLDS: THRESHOLDS,
    gradeOf: gradeOf,
    gradeFromText: gradeFromText,
    gradeLabel: gradeLabel,
    badgeHTML: badgeHTML,
    fallbackAdvice: fallbackAdvice
  };

  global.AirGrade = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
