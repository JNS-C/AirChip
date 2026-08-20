/* ==========================================================================
   app.js — 오늘의 대기질
   웹과 크롬 확장이 같은 파일을 쓴다. 환경 차이는 아래 두 어댑터로만 흡수한다:
     · AIRCHIP_STORAGE  — 마지막 도시 저장 (localStorage ↔ chrome.storage.local)
     · AIRCHIP_DATA     — 데이터 출처 (서버 경유 ↔ 에어코리아 직접 호출)
   나머지 코드는 손대지 않는다 (PRD §6.6)
   ========================================================================== */
(function (global) {
  'use strict';

  var CFG = global.AIRCHIP_CONFIG || {};
  var G = global.AirGrade;

  /* API 허용값과 1:1. 17개 고정 (PRD §3.2) */
  var CITIES = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
                '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

  /* ------------------------------------------------------------------------
     어댑터 — 이식할 때 이 부분만 교체한다 (§6.6)
     ------------------------------------------------------------------------ */
  var Storage = global.AIRCHIP_STORAGE || {
    getLastCity: function () {
      try { return Promise.resolve(localStorage.getItem('lastCity')); }
      catch (e) { return Promise.resolve(null); }
    },
    setLastCity: function (v) {
      try { localStorage.setItem('lastCity', v); } catch (e) {}
      return Promise.resolve();
    }
  };

  function fetchJson(url, options) {
    return fetch(url, options).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (body) {
        if (!r.ok) {
          var err = new Error(body.message || ('HTTP ' + r.status));
          err.code = body.error || ('HTTP_' + r.status);
          throw err;
        }
        return body;
      });
    });
  }

  var Data = global.AIRCHIP_DATA || {
    air: function (sido, signal) {
      return fetchJson('/api/air?sido=' + encodeURIComponent(sido), { signal: signal });
    },
    station: function (name, signal) {
      return fetchJson('/api/station?station=' + encodeURIComponent(name), { signal: signal });
    },
    forecast: function () { return fetchJson('/api/forecast'); },
    advice: function (payload) {
      return fetchJson('/api/advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
  };

  /* ------------------------------------------------------------------------
     상태
     ------------------------------------------------------------------------ */
  var state = {
    sido: null,
    air: null,
    stationName: null,
    stationData: null,
    forecast: null,
    chart: null,
    adviceToken: 0
  };

  /* 측정소 목록을 끌어서 스크롤했는지. 드래그 직후의 click을 무시하는 데 쓴다 */
  var listDragged = false;

  /* ------------------------------------------------------------------------
     요청 수명 — 지역을 빠르게 바꿀 때가 문제다.

     예전에는 칩을 누를 때마다 새 체인을 시작하고 이전 요청을 그대로 뒀다.
     그 결과 (a) 상류에 동시 호출이 몰려 504 SERVICE TIME OUT을 자초하고,
     (b) 늦게 도착한 이전 지역의 응답이 state.air를 덮어써 카드가 누르지도 않은
     지역으로 되돌아갔다. 조언에는 이미 adviceToken 가드가 있었지만 본문에는 없었다.

     → 지역/측정소 전환은 "요청 세대"를 하나 올린다. 이전 세대는 즉시 취소하고,
       그래도 도착한 응답은 표식이 어긋나므로 화면에 반영하지 않는다.
     ------------------------------------------------------------------------ */
  var reqSeq = 0;        // 현재 세대. 늦게 온 응답을 걸러내는 표식
  var inflight = null;   // 현재 세대의 AbortController

  function beginRequest() {
    if (inflight) inflight.abort();
    inflight = global.AbortController ? new global.AbortController() : null;
    return ++reqSeq;
  }

  function signal() { return inflight ? inflight.signal : undefined; }
  function isStale(token) { return token !== reqSeq; }

  /* 취소는 오류가 아니다. 화면에 실패를 그리면 안 된다 */
  function isAbort(err) {
    return !!err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');
  }

  /* ------------------------------------------------------------------------
     응답 캐시 — 칩을 오갈 때마다 네트워크를 왕복하지 않는다.
     실시간 측정값은 1시간 단위로 갱신되므로 3분이면 충분히 신선하다.
     새로고침·다시 시도는 이 캐시를 건너뛴다 (fresh 옵션)
     ------------------------------------------------------------------------ */
  var CACHE_TTL = 180000;
  var cache = { air: {}, station: {} };

  function cacheGet(kind, key) {
    var hit = cache[kind][key];
    if (!hit || Date.now() - hit.at > CACHE_TTL) return null;
    return hit.data;
  }

  function cachePut(kind, key, data) {
    // stale 폴백(서버의 마지막 정상값)은 캐시하지 않는다. 낡은 값이 고착된다
    if (data && !data.stale) cache[kind][key] = { at: Date.now(), data: data };
  }

  function $(id) { return document.getElementById(id); }
  function announce(text) { var n = $('live-region'); if (n) n.textContent = text; }

  /* ------------------------------------------------------------------------
     칩 — 컨테이너 하나만 유리다. 개별 칩에 배경을 얹지 않는다 (DESIGN §1.4)
     ------------------------------------------------------------------------ */
  function renderChips() {
    var list = $('chiplist');
    var indicator = $('chip-indicator');
    CITIES.forEach(function (city) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.dataset.city = city;
      b.setAttribute('role', 'button');
      b.setAttribute('aria-pressed', 'false');
      b.textContent = city;
      b.addEventListener('click', function () { selectCity(city); });
      list.appendChild(b);
    });
    if (global.ResizeObserver) {
      new ResizeObserver(function () { moveIndicator(); }).observe(list);
    }
    return indicator;
  }

  /* 인디케이터는 배경을 읽지 않는 순수 형태 레이어다 (§10.2 b) */
  function moveIndicator() {
    var indicator = $('chip-indicator');
    var active = document.querySelector('.chip[aria-pressed="true"]');
    if (!indicator || !active) return;
    indicator.style.width = active.offsetWidth + 'px';
    indicator.style.height = active.offsetHeight + 'px';
    indicator.style.transform = 'translate(' + active.offsetLeft + 'px,' + active.offsetTop + 'px)';
    indicator.dataset.ready = '1';
  }

  function markChip(city) {
    document.querySelectorAll('.chip').forEach(function (c) {
      c.setAttribute('aria-pressed', String(c.dataset.city === city));
    });
    moveIndicator();
  }

  /* ------------------------------------------------------------------------
     메인 카드
     ------------------------------------------------------------------------ */
  function renderCard(air) {
    $('card-fail').hidden = true;
    $('card-city').textContent = air.sido;

    function metric(kind, node, badgeNode) {
      var d = air[kind];
      var valEl = $(node);
      var badgeEl = $(badgeNode);
      if (d.avg === null || d.valid === 0) {
        // 유효 측정소가 0개이면 "측정 불가"로 표시한다. 0으로 표시 금지 (§4.3-6)
        valEl.textContent = '측정 불가';
        valEl.dataset.unavailable = '1';
        badgeEl.innerHTML = G.badgeHTML(0);
      } else {
        valEl.textContent = String(d.avg);
        delete valEl.dataset.unavailable;
        badgeEl.innerHTML = G.badgeHTML(d.grade);
      }
    }
    metric('pm10', 'pm10-value', 'pm10-badge');
    metric('pm25', 'pm25-value', 'pm25-badge');

    /* 평균만 쓰면 국지적 고농도가 지워진다 (§3.3) */
    var worstEl = $('worst');
    if (air.worst && air.worst.value !== null) {
      var kindLabel = air.worst.kind === 'pm10' ? 'PM10' : 'PM2.5';
      worstEl.innerHTML = '가장 나쁜 곳: <strong>' + escapeHtml(air.worst.name) + '</strong> 측정소 ' +
                          air.worst.value + ' <span class="meta">(' + kindLabel + ')</span>';
    } else {
      worstEl.textContent = '유효한 측정소 값이 없습니다.';
    }

    /* 결측을 투명하게 공개한다 (§3.3) */
    var valid = Math.max(air.pm10.valid, air.pm25.valid);
    var coverage = air.total + '개 측정소 중 ' + valid + '개 기준';
    if (air.pm10.valid !== air.pm25.valid) {
      coverage = air.total + '개 측정소 중 PM10 ' + air.pm10.valid + '개 · PM2.5 ' + air.pm25.valid + '개 기준';
    }
    $('coverage').textContent = coverage;

    var timeEl = $('datatime');
    timeEl.textContent = (air.dataTimeText || '측정 시각 미상') + ' 기준' +
                         (air.stale ? ' · 최신 갱신 실패, 마지막 정상값 표시 중' : '');
    timeEl.classList.toggle('meta--stale', !!air.stale);
  }

  var FAIL_MSG = {
    MISSING_KEY:    '서버에 인증키가 설정되지 않았습니다. .env.local을 확인하세요.',
    QUOTA_EXCEEDED: '오늘 사용할 수 있는 에어코리아 조회 횟수를 다 썼습니다. 자정 이후 다시 시도해 주세요.',
    BAD_KEY:        '에어코리아 서비스 키가 유효하지 않습니다.',
    KEY_EXPIRED:    '에어코리아 서비스 키의 사용 기한이 만료되었습니다.',
    TIMEOUT:        '에어코리아 응답이 느려 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
  };

  function failCard(message) {
    $('card-fail').hidden = false;
    $('card-fail-msg').textContent = message;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ------------------------------------------------------------------------
     측정소 드롭다운 — 트리거 앵커링 팝오버 (§9.5)
     목록은 실시간 응답의 stationName 배열을 그대로 쓴다. 추가 호출 0 (§3.4)
     ------------------------------------------------------------------------ */
  function renderStationList(stations) {
    var host = $('station-list');
    host.innerHTML = '';
    stations.forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'popover__item';
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', String(s.name === state.stationName));
      b.dataset.station = s.name;
      var val = s.pm10 !== null ? s.pm10 + ' ㎍/㎥' : (s.pm25 !== null ? s.pm25 + ' ㎍/㎥' : '측정 불가');
      b.innerHTML = '<span class="popover__check" aria-hidden="true">✓</span>' +
                    '<span class="popover__item-name">' + escapeHtml(s.name) + '</span>' +
                    '<span class="popover__item-val">' + escapeHtml(val) + '</span>';
      b.addEventListener('click', function () {
        /* 목록을 끌어 스크롤한 직후의 click은 선택으로 치지 않는다.
           모바일에서 스크롤하려다 엉뚱한 측정소가 선택되는 것을 막는다 */
        if (listDragged) return;
        global.LG.closePopover();
        $('station-trigger').focus();
        selectStation(s.name);
      });
      host.appendChild(b);
    });
  }

  function updateStationTrigger() {
    $('station-name').textContent = state.stationName || '측정소 없음';
    var s = (state.air && state.air.stations || []).find(function (x) { return x.name === state.stationName; });
    $('station-val').textContent = s && s.pm10 !== null ? 'PM10 ' + s.pm10 : '';
  }

  function wireStationPopover() {
    var trigger = $('station-trigger');
    var panel = $('station-popover');
    trigger.addEventListener('click', function () {
      global.LG.togglePopover(trigger, panel);
    });

    /* 드래그 판정 — 터치로 목록을 끌면 브라우저가 click을 억제하는 것이 보통이지만,
       엔진에 따라 그렇지 않은 경우가 있다. 이동 거리로 직접 걸러낸다 */
    var startY = null;
    panel.addEventListener('pointerdown', function (e) {
      startY = e.clientY;
      listDragged = false;
    }, true);
    panel.addEventListener('pointermove', function (e) {
      if (startY !== null && Math.abs(e.clientY - startY) > 8) listDragged = true;
    }, true);
    panel.addEventListener('pointercancel', function () {
      listDragged = true;   // 스크롤로 넘어간 제스처다
    }, true);
    /* 키보드 탐색 (PRD §3.2 접근성) */
    panel.addEventListener('keydown', function (e) {
      var items = Array.prototype.slice.call(panel.querySelectorAll('.popover__item'));
      var i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); (items[i + 1] || items[0]).focus(); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); (items[i - 1] || items[items.length - 1]).focus(); }
      if (e.key === 'Home')      { e.preventDefault(); items[0] && items[0].focus(); }
      if (e.key === 'End')       { e.preventDefault(); items[items.length - 1].focus(); }
    });
  }

  /* ------------------------------------------------------------------------
     24시간 추이 — Chart.js
     ------------------------------------------------------------------------ */
  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  /* 차트 렌더러 어댑터 — 웹은 Chart.js CDN(PRD §8), 확장은 MV3 CSP 때문에
     CDN을 못 쓰므로 자체 캔버스 렌더러를 주입한다 (AIRCHIP_CHART) */
  var ChartImpl = global.AIRCHIP_CHART || {
    render: function (canvas, data, opts) { renderWithChartJs(canvas, data, opts); }
  };

  function renderChart(data) {
    $('chart-fail').hidden = true;
    if (!CFG.collapseChart) $('chart-wrap').hidden = false;
    delete $('chart-wrap').dataset.busy;
    $('chart-title').textContent = data.station + ' 측정소 기준 · 최근 24시간';

    var opts = {
      pm10Color: cssVar('--series-pm10', '#0A63E8'),
      pm25Color: cssVar('--series-pm25', '#A8437E'),
      gridColor: cssVar('--vib-label-4', 'rgba(128,128,128,.26)'),
      tickColor: cssVar('--vib-label-3', 'rgba(128,128,128,.44)'),
      reduceMotion: global.matchMedia('(prefers-reduced-motion: reduce)').matches ||
                    document.documentElement.dataset.motion === 'off'
    };
    ChartImpl.render($('chart'), data, opts);
    renderChartSummary(data);
  }

  function renderWithChartJs(canvas, data, o) {
    if (!global.Chart) return;
    var pm10Color = o.pm10Color, pm25Color = o.pm25Color;
    var gridColor = o.gridColor, tickColor = o.tickColor;
    var reduceMotion = o.reduceMotion;

    var config = {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [
          {
            label: 'PM10',
            data: data.pm10,
            borderColor: pm10Color,
            backgroundColor: pm10Color,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: .32,
            spanGaps: false      // R6 — 결측 구간은 선을 끊는다
          },
          {
            label: 'PM2.5',
            data: data.pm25,
            borderColor: pm25Color,
            backgroundColor: pm25Color,
            borderWidth: 2,
            borderDash: [5, 4],  // 색 단독 구분 금지 — 선 모양으로도 구분한다
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: .32,
            spanGaps: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: reduceMotion ? false : { duration: 350 },
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { grid: { display: false }, ticks: { color: tickColor, maxTicksLimit: 8, font: { size: 11 } } },
          y: {
            beginAtZero: true,
            grid: { color: gridColor, drawBorder: false },
            ticks: { color: tickColor, maxTicksLimit: 5, font: { size: 11 } }
          }
        },
        plugins: {
          legend: { labels: { color: tickColor, usePointStyle: true, boxWidth: 8, font: { size: 12 } } },
          tooltip: { callbacks: { label: function (c) {
            return c.dataset.label + ': ' + (c.parsed.y === null ? '결측' : c.parsed.y + ' ㎍/㎥');
          } } }
        }
      }
    };

    if (state.chart) state.chart.destroy();
    state.chart = new global.Chart(canvas, config);
  }

  /* 그래프 하단에 수치 요약 텍스트 병기 (PRD §8 접근성) */
  function renderChartSummary(data) {
    var pm25 = data.pm25.filter(function (v) { return v !== null; });
    var pm10 = data.pm10.filter(function (v) { return v !== null; });
    if (!pm25.length && !pm10.length) {
      $('chart-summary').textContent = '최근 24시간 유효 측정값이 없습니다.';
      return;
    }
    var parts = [];
    if (pm10.length) parts.push('PM10 최저 ' + Math.min.apply(null, pm10) + ' · 최고 ' + Math.max.apply(null, pm10));
    if (pm25.length) parts.push('PM2.5 최저 ' + Math.min.apply(null, pm25) + ' · 최고 ' + Math.max.apply(null, pm25));

    var trend = trendOf(data.pm25.length ? data.pm25 : data.pm10);
    if (trend) parts.push('최근 흐름은 ' + trend);
    var missing = data.missing.pm10 + data.missing.pm25;
    if (missing) parts.push('결측 ' + missing + '개 구간은 선이 끊겨 있습니다');

    $('chart-summary').textContent = parts.join(' · ') + '.';
  }

  function trendOf(series) {
    var valid = series.map(function (v, i) { return { v: v, i: i }; })
                      .filter(function (p) { return p.v !== null; });
    if (valid.length < 4) return null;
    var tail = valid.slice(-6);
    var first = tail[0].v, last = tail[tail.length - 1].v;
    var diff = last - first;
    if (Math.abs(diff) < 3) return '거의 변화 없음';
    return diff > 0 ? '오르는 중' : '내려가는 중';
  }

  function failChart() {
    $('chart-wrap').hidden = true;
    delete $('chart-wrap').dataset.busy;
    $('chart-fail').hidden = false;
  }

  /* 추이는 카드와 별개의 상류 호출이다. 카드가 먼저 떠도 여기는 아직 오는 중일 수 있다.
     이전 지역의 그래프를 그대로 두면 지금 지역의 값으로 오해하므로 상태를 표시한다 */
  function busyChart(name) {
    $('chart-fail').hidden = true;
    if (!CFG.collapseChart) $('chart-wrap').hidden = false;
    $('chart-wrap').dataset.busy = '1';
    $('chart-title').textContent = name + ' 측정소 · 추이를 불러오는 중';
  }

  /* ------------------------------------------------------------------------
     3일 예보 — 이중 권역은 더 나쁜 쪽을 대표로, 세부는 병기 (§3.5)
     ------------------------------------------------------------------------ */
  function renderForecast() {
    var section = $('forecast');
    var grid = $('forecast-grid');
    if (!state.forecast || !state.sido) return;

    var days = state.forecast.bySido[state.sido];
    if (!days) { section.hidden = true; return; }

    section.hidden = false;
    grid.innerHTML = '';
    days.forEach(function (d) {
      var cell = document.createElement('div');
      cell.className = 'fc-cell';
      if (!d.available) {
        // 예보 미발표 시 칸 자체를 숨기지 않는다 (§3.5)
        cell.className += ' fc-cell--empty';
        cell.innerHTML = '<span>' + d.label + '<br>예보 준비 중</span>';
        grid.appendChild(cell);
        return;
      }
      var html = '<div><div class="fc-cell__day">' + d.label + '</div>' +
                 '<div class="fc-cell__date">' + d.date.slice(5).replace('-', '월 ') + '일</div></div>';
      html += '<div class="fc-cell__line">PM10 ' + G.badgeHTML(d.pm10.grade) + '</div>';
      html += '<div class="fc-cell__line">PM2.5 ' + G.badgeHTML(d.pm25.grade) + '</div>';

      var split = splitText(d);
      if (split) html += '<div class="fc-cell__split">' + escapeHtml(split) + '</div>';
      cell.innerHTML = html;
      grid.appendChild(cell);
    });
  }

  function splitText(day) {
    var parts = (day.pm25.split && day.pm25.split.length ? day.pm25.split : day.pm10.split) || [];
    if (!parts.length) return null;
    return parts.map(function (p) { return p.region + ' ' + p.text; }).join(' · ');
  }

  /* ------------------------------------------------------------------------
     조언 — 정적 폴백이 먼저다. 화면은 절대 비우지 않는다 (§5.2)
     ------------------------------------------------------------------------ */
  function renderAdvice(advice, source) {
    $('advice-ventilation').textContent = advice.ventilation;
    $('advice-mask').textContent = advice.mask;
    $('advice-exercise').textContent = advice.exercise;
    $('advice-source').textContent = source || '';
  }

  var adviceTimer = null;
  var adviceKey = null;

  function requestAdvice(reqToken) {
    if (!state.air) return;
    if (reqToken !== undefined && isStale(reqToken)) return;  // 낡은 세대는 AI를 부르지 않는다
    var token = ++state.adviceToken;

    /* 1) 폴백을 먼저 그린다. AI가 실패해도 이미 채워져 있다.
       단 지역도 등급도 그대로면 이미 그려진 조언이 여전히 유효하다 — 측정소만 바꿨을 때
       AI 문장이 정적 폴백으로 되돌아갔다가 다시 채워지는 깜빡임을 막는다 */
    var key = state.air.sido + '|' + state.air.pm10.grade + '|' + state.air.pm25.grade;
    if (key !== adviceKey) {
      renderAdvice(G.fallbackAdvice(state.air.pm10.grade, state.air.pm25.grade), '');
      adviceKey = key;
    }

    /* 2) 측정소를 연달아 바꾸면 누를 때마다 Gemini를 부르게 된다.
       무료 한도는 분당 20건이라 목록을 몇 번 훑기만 해도 소진되고,
       그때부터 조언은 계속 정적 폴백으로 주저앉는다 (§5.2).
       선택이 멎은 뒤 한 번만 부른다 */
    if (adviceTimer) clearTimeout(adviceTimer);
    adviceTimer = setTimeout(function () {
      adviceTimer = null;
      sendAdvice(token);
    }, 600);
  }

  function sendAdvice(token) {
    if (!state.air || token !== state.adviceToken) return;

    var fc = state.forecast && state.sido ? state.forecast.bySido[state.sido] : null;
    var payload = {
      sido: state.air.sido,
      pm10: { avg: state.air.pm10.avg, grade: state.air.pm10.grade },
      pm25: { avg: state.air.pm25.avg, grade: state.air.pm25.grade },
      worst: state.air.worst,
      coverage: { total: state.air.total, valid: Math.max(state.air.pm10.valid, state.air.pm25.valid) },
      dataTime: state.air.dataTimeText,
      station: state.stationData ? {
        name: state.stationData.station,
        // 추이는 최근 6시간만 넘긴다. 24개 전부는 토큰만 늘린다 (§5.3)
        recentPm25: state.stationData.pm25.slice(-6)
      } : null,
      forecast: fc ? fc.map(function (d) {
        return { label: d.label, pm10: d.pm10.grade, pm25: d.pm25.grade };
      }) : null,
      // 화면에는 노출하지 않지만 Gemini에는 넘긴다 (§5.3)
      hidden: state.forecast ? state.forecast.hidden : null
    };

    Data.advice(payload).then(function (r) {
      if (token !== state.adviceToken) return;   // 늦게 도착한 응답은 버린다
      if (r && r.advice) renderAdvice(r.advice, r.source === 'gemini' ? 'AI 요약' : '');
    }).catch(function () {
      /* 조언 실패는 오류를 표시하지 않는다 (§7). 폴백이 이미 그려져 있다 */
    });
  }

  /* ------------------------------------------------------------------------
     더보기 — 실시간 응답에 이미 딸려 오므로 추가 호출 비용이 0 (§3.6)
     ------------------------------------------------------------------------ */
  var DETAIL_KEYS = [
    { key: 'o3',   label: '오존 O₃',        unit: 'ppm' },
    { key: 'no2',  label: '이산화질소 NO₂', unit: 'ppm' },
    { key: 'co',   label: '일산화탄소 CO',  unit: 'ppm' },
    { key: 'so2',  label: '아황산가스 SO₂', unit: 'ppm' },
    { key: 'khai', label: '통합대기환경지수', unit: '' }
  ];

  function renderDetails() {
    var grid = $('details-grid');
    if (!state.air || !state.stationName) return;
    var s = state.air.stations.find(function (x) { return x.name === state.stationName; });
    $('details-basis').textContent = s
      ? s.name + ' 측정소 기준'
      : '선택한 측정소의 값을 찾을 수 없습니다';
    grid.innerHTML = '';
    DETAIL_KEYS.forEach(function (d) {
      var v = s ? s[d.key] : null;
      var item = document.createElement('div');
      item.className = 'details__item';
      item.innerHTML = '<div class="details__key">' + d.label + '</div>' +
                       '<div class="details__val">' + (v === null || v === undefined ? '—' : v + (d.unit ? ' <span class="details__key">' + d.unit + '</span>' : '')) + '</div>';
      grid.appendChild(item);
    });
  }

  /* ------------------------------------------------------------------------
     로딩 — 영역별 독립 실패 (§7)
     ------------------------------------------------------------------------ */
  function setBusy(on) {
    var b = $('btn-refresh');
    if (b) b.dataset.busy = on ? '1' : '0';
  }

  function selectCity(city, opts) {
    state.sido = city;
    markChip(city);
    Storage.setLastCity(city);
    renderForecast();       // 예보는 전국 응답을 보유하므로 재호출하지 않는다 (§4.6)
    return loadAir(city, opts);
  }

  function loadAir(city, opts) {
    var fresh = !!(opts && opts.fresh);
    var token = beginRequest();     // 이전 지역의 진행 중 요청을 취소한다

    var hit = fresh ? null : cacheGet('air', city);
    if (hit) {
      applyAir(city, hit, token, false);   // 네트워크 왕복 0
      return Promise.resolve();
    }

    setBusy(true);
    announce(city + ' 대기질을 불러오는 중');
    return Data.air(city, signal()).then(function (air) {
      if (isStale(token)) return;   // 그 사이 다른 지역을 눌렀다. 화면은 건드리지 않는다
      cachePut('air', city, air);
      /* 수동 새로고침이면 추이도 다시 받는다 = 실시간 1 + 추이 1 (§4.6) */
      applyAir(city, air, token, fresh);
    }).catch(function (err) {
      if (isStale(token) || isAbort(err)) return;
      setBusy(false);
      /* 시도 실시간 조회는 다른 모든 영역의 전제이므로 예외다 (§7).
         원인이 분명한 것은 그대로 알려준다 — "불러오지 못했습니다"만 보면
         다시 눌러야 할지 기다려야 할지 알 수 없다 */
      failCard(FAIL_MSG[err.code] || '데이터를 불러오지 못했습니다.');
      failChart();
    });
  }

  /* 카드를 그리고, 추이는 붙잡지 않고 따로 보낸다.
     예전에는 loadAir가 loadStation을 .then으로 이어 붙여, 서로 무관한 두 상류 호출이
     한 줄로 묶였다. 카드는 이미 받아 놓고도 추이를 기다리느라 대기 상태가 안 풀렸다 */
  function applyAir(city, air, token, fresh) {
    state.air = air;
    renderCard(air);
    /* 기본 선택은 메인 카드의 최악 측정소 (§3.4).
       목록을 그리기 "전에" 확정해야 한다 — 순서가 뒤집히면 aria-selected가
       이전 시도의 측정소명과 비교되어 체크 표시가 하나도 안 붙는다.
       가나다순 목록에서는 지금 선택이 어디인지 보이는 게 특히 중요하다 */
    var next = air.worst ? air.worst.name : (air.stations[0] && air.stations[0].name);
    state.stationName = next;
    state.stationData = null;
    renderStationList(air.stations);
    updateStationTrigger();
    renderDetails();
    announce(city + ' PM10 ' + (air.pm10.avg === null ? '측정 불가' : air.pm10.avg) +
             ', PM2.5 ' + (air.pm25.avg === null ? '측정 불가' : air.pm25.avg));

    /* 조언의 정적 폴백을 먼저 그린다. 화면은 절대 비우지 않는다 (§5.2).
       AI 요약은 추이까지 받은 뒤 한 번만 부른다 — Gemini 호출을 늘리지 않기 위해서다 */
    renderAdvice(G.fallbackAdvice(air.pm10.grade, air.pm25.grade), '');

    setBusy(false);   // 카드가 다 그려졌다. 추이 때문에 여기를 붙잡아 두지 않는다

    if (!next) { failChart(); requestAdvice(token); return; }
    loadStation(next, { token: token, fresh: fresh })
      .then(function () { requestAdvice(token); })
      .catch(function () {});   // 조언 단계 실패는 조용히 넘긴다 (§7)
  }

  function selectStation(name) {
    var token = beginRequest();   // 자동 선택된 측정소의 추이가 아직 오는 중일 수 있다
    state.stationName = name;
    updateStationTrigger();
    renderDetails();
    renderStationList(state.air ? state.air.stations : []);
    return loadStation(name, { token: token })
      .then(function () { requestAdvice(token); })
      .catch(function () {});   // 조언 단계 실패는 조용히 넘긴다 (§7)
  }

  function loadStation(name, opts) {
    var token = opts && opts.token !== undefined ? opts.token : reqSeq;
    var fresh = !!(opts && opts.fresh);

    var hit = fresh ? null : cacheGet('station', name);
    if (hit) {
      state.stationData = hit;
      renderChart(hit);
      return Promise.resolve();
    }

    busyChart(name);
    return Data.station(name, signal()).then(function (d) {
      if (isStale(token)) return;
      cachePut('station', name, d);
      state.stationData = d;
      renderChart(d);
    }).catch(function (err) {
      if (isStale(token) || isAbort(err)) return;
      state.stationData = null;
      failChart();     // 카드·예보·조언은 정상 (§7)
    });
  }

  function loadForecast() {
    return Data.forecast().then(function (f) {
      state.forecast = f;
      renderForecast();
    }).catch(function () {
      state.forecast = null;
      $('forecast').hidden = true;   // 예보 영역만 숨김. 나머지는 정상 동작 (§7)
    });
  }

  /* ------------------------------------------------------------------------
     설정 — §12.2. iOS에서는 이 토글이 유일한 접근성 경로다
     ------------------------------------------------------------------------ */
  function wireSettings() {
    var trigger = $('btn-settings');
    var panel = $('settings-popover');
    trigger.addEventListener('click', function () { global.LG.togglePopover(trigger, panel); });

    var LGS = global.LG.settings;

    function syncTheme() {
      var cur = LGS.theme();
      $('seg-theme').querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.themeValue === cur));
      });
    }
    $('seg-theme').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-theme-value]');
      if (!b) return;
      LGS.theme(b.dataset.themeValue);
      syncTheme();
    });
    syncTheme();

    /* ── 유리 투명도 슬라이더 ────────────────────────────────────────────
       접근성 분기(§12.2)가 켜지면 표면이 불투명으로 고정되고 이 슬라이더는
       아무 효과가 없다. 그럴 때는 비활성화하고 이유를 적는다 — 조작은 되는데
       화면이 안 변하는 게 가장 나쁜 상태다 */
    var range = $('glass-range');
    var valueEl = $('glass-value');
    var noteEl = $('glass-note');
    var group = $('glass-group');

    function describe(level) {
      if (level <= .45) return '매우 투명';
      if (level < .9) return '투명';
      if (level <= 1.1) return '기본';
      if (level <= 1.35) return '진하게';
      return '가장 진하게';
    }

    function syncGlassUI(level) {
      valueEl.textContent = describe(level) + ' · ' + Math.round(level * 100) + '%';

      var locked = LGS.solidMode();
      range.disabled = locked;
      group.dataset.locked = locked ? '1' : '0';

      noteEl.classList.remove('settings__note--warn');
      if (locked) {
        noteEl.textContent = '투명 효과가 꺼져 있어 조절할 수 없습니다. 아래 스위치나 시스템 대비 설정을 확인하세요.';
      } else if (level < .55) {
        /* 대비는 틴트 레이어가 책임진다(§12.1). 얇게 내리면 실제로 대비가 떨어진다 */
        noteEl.textContent = '많이 투명해서 글자가 읽기 어려울 수 있습니다.';
        noteEl.classList.add('settings__note--warn');
      } else {
        noteEl.textContent = '틴트와 흐림이 함께 조절됩니다.';
      }

      /* 문구 길이가 바뀌면 패널 크기도 바뀐다. 위치를 다시 잡지 않으면
         화면 오른쪽 끝에서 열었을 때 뷰포트를 넘어간다 */
      if (global.LG.repositionPopovers) global.LG.repositionPopovers();
    }

    var initialLevel = LGS.glassLevel();
    range.value = String(Math.round(initialLevel * 100));
    syncGlassUI(initialLevel);

    range.addEventListener('input', function () {
      var level = LGS.glassLevel(Number(range.value) / 100);
      syncGlassUI(level);
    });

    var swT = $('sw-transparency');
    var swM = $('sw-motion');
    swT.setAttribute('aria-checked', String(!LGS.transparency()));
    swM.setAttribute('aria-checked', String(!LGS.motion()));
    swT.addEventListener('click', function () {
      var reduce = swT.getAttribute('aria-checked') !== 'true';
      LGS.transparency(!reduce);
      swT.setAttribute('aria-checked', String(reduce));
      syncGlassUI(LGS.glassLevel());
    });

    /* 시스템 쪽에서 접근성 신호가 바뀌어도 슬라이더 상태를 맞춘다 */
    if (global.matchMedia) {
      ['(prefers-reduced-transparency: reduce)', '(prefers-contrast: more)'].forEach(function (q) {
        global.matchMedia(q).addEventListener('change', function () {
          syncGlassUI(LGS.glassLevel());
        });
      });
    }
    swM.addEventListener('click', function () {
      var reduce = swM.getAttribute('aria-checked') !== 'true';
      LGS.motion(!reduce);
      swM.setAttribute('aria-checked', String(reduce));
    });

    /* 테마가 바뀌면 차트도 다시 칠한다 — 토큰에서 색을 읽기 때문이다 */
    global.addEventListener('lg:themechange', function () {
      if (state.stationData) renderChart(state.stationData);
    });
    if (global.matchMedia) {
      global.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
        if (state.stationData) renderChart(state.stationData);
      });
    }
  }

  function wireDetails() {
    var t = $('details-toggle');
    var body = $('details-body');
    t.addEventListener('click', function () {
      var open = t.getAttribute('aria-expanded') === 'true';
      t.setAttribute('aria-expanded', String(!open));
      body.hidden = open;
    });
  }

  function wireRetry() {
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-retry]');
      if (!b) return;
      if (b.dataset.retry === 'all' && state.sido) loadAir(state.sido, { fresh: true });
      if (b.dataset.retry === 'station' && state.stationName) {
        loadStation(state.stationName, { token: beginRequest(), fresh: true });
      }
    });
  }

  /* ------------------------------------------------------------------------
     부팅
     ------------------------------------------------------------------------ */
  function boot() {
    renderChips();
    wireStationPopover();
    wireSettings();
    wireDetails();
    wireRetry();

    $('btn-refresh').addEventListener('click', function () {
      if (!state.sido) return;
      loadAir(state.sido, { fresh: true });   // 수동 새로고침 = 실시간 1 + 추이 1 (§4.6)
    });

    /* 확장에서는 추이를 기본 접힘으로 둔다 (§6.5 높이 예산) */
    if (CFG.collapseChart) {
      var wrap = $('chart-wrap');
      if (wrap) wrap.hidden = true;
    }

    /* 스크롤 엣지 (§9.1) — 콘텐츠가 헤더 밑으로 지나갈 때만 틴트가 진해진다 */
    global.LG.initScrollEdge();

    /* 굴절 맵은 티어 A에서만, 첫 페인트 이후에 만든다 (§8 성능 / 부록 C) */
    var startRefraction = function () { global.LG.initRefraction('[data-lg-refract]'); };
    if (global.requestIdleCallback) global.requestIdleCallback(startRefraction, { timeout: 1200 });
    else setTimeout(startRefraction, 300);

    /* 예보는 카드가 뜬 뒤에 부른다.
       예전에는 예보(상류 순차 2~4회)와 첫 지역 조회를 동시에 던졌다. 상류는 몰린 호출에
       504를 던지므로 첫 화면부터 스스로 느려지게 만드는 순서였다.
       예보는 6시간 캐시라 조금 늦게 시작해도 손해가 없다 (§4.6).
       영역은 여전히 독립이다 — 예보가 실패해도 나머지는 그대로 간다 (§7) */
    Storage.getLastCity().then(function (last) {
      return selectCity(CITIES.indexOf(last) >= 0 ? last : '서울');
    }).then(loadForecast, loadForecast);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  global.AirChip = {
    state: state,
    selectCity: selectCity,
    selectStation: selectStation,
    CITIES: CITIES,
    /* 접힌 상태에서는 캔버스 크기가 0이다. 펼친 뒤 다시 그린다 (확장 §6.5) */
    redrawChart: function () { if (state.stationData) renderChart(state.stationData); }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
