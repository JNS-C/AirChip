/* ==========================================================================
   popup.js — 확장 어댑터
   PRD §6.2 — 대기질은 에어코리아 직접 호출(사용자 키), 조언만 내 서버 경유.
   PRD §6.6 — 저장은 getLastCity/setLastCity 두 함수만 교체한다.

   app.js는 키가 확인된 뒤에 동적으로 주입한다. 키가 없으면 안내 화면만 뜬다 (§7).
   ========================================================================== */
(function (global) {
  'use strict';

  var BASE = 'https://apis.data.go.kr/B552584/ArpltnInforInqireSvc';
  var KEYS = { apiKey: 'airkoreaKey', endpoint: 'adviceEndpoint', lastCity: 'lastCity' };

  var conf = { apiKey: '', endpoint: '' };

  /* ------------------------------------------------------------------------
     chrome.storage 래퍼
     ------------------------------------------------------------------------ */
  function get(keys) {
    return new Promise(function (resolve) {
      chrome.storage.local.get(keys, function (v) { resolve(v || {}); });
    });
  }
  function set(obj) {
    return new Promise(function (resolve) {
      chrome.storage.local.set(obj, function () { resolve(); });
    });
  }

  /* 저장 로직은 얇은 함수 두 개로 분리한다. 나머지 코드는 손대지 않는다 (§6.6) */
  global.AIRCHIP_STORAGE = {
    getLastCity: function () { return get(KEYS.lastCity).then(function (v) { return v[KEYS.lastCity] || null; }); },
    setLastCity: function (city) { return set({ lastCity: city }); }
  };

  global.AIRCHIP_CONFIG = { collapseChart: true };   // 높이 예산 (§6.5 · R9)

  /* ------------------------------------------------------------------------
     호출량 방어 — 확장은 사용자 키를 쓰므로 일일 500회가 그대로 사용자 부담이다.
     서버 캐시(§4.6)와 같은 수명으로 로컬 캐시를 둔다 (§9 호출 예산)
     ------------------------------------------------------------------------ */
  var TTL = { realtime: 10 * 60 * 1000, forecast: 6 * 60 * 60 * 1000 };

  function cached(key, ttl, producer) {
    return get('cache:' + key).then(function (v) {
      var hit = v['cache:' + key];
      if (hit && Date.now() - hit.at < ttl) return hit.payload;
      return producer().then(function (payload) {
        var obj = {};
        obj['cache:' + key] = { at: Date.now(), payload: payload };
        set(obj);
        return payload;
      }).catch(function (err) {
        // R11 — 마지막 정상 응답이 있으면 stale 표시와 함께 돌려준다
        if (hit) return Object.assign({}, hit.payload, { stale: true });
        throw err;
      });
    });
  }

  /* ------------------------------------------------------------------------
     에어코리아 직접 호출
     R1 — serviceKey는 수동으로 1회만 인코딩한다. URLSearchParams에 넣지 않는다
     ------------------------------------------------------------------------ */
  function buildUrl(operation, params) {
    var qs = new URLSearchParams(Object.assign({ returnType: 'json', pageNo: '1' }, params));
    var key = conf.apiKey;
    var encoded = /%[0-9A-Fa-f]{2}/.test(key) ? key : encodeURIComponent(key);
    return BASE + '/' + operation + '?serviceKey=' + encoded + '&' + qs.toString();
  }

  /* 상류가 연속 호출에 502/503/504를 던진다. 짧은 백오프로 재시도하면 통과한다 */
  var RETRIABLE = [429, 500, 502, 503, 504];
  var BACKOFF = [700, 1800];

  function fetchWithRetry(url, attempt) {
    attempt = attempt || 0;
    return fetch(url, { headers: { accept: 'application/json' } }).then(function (r) {
      if (r.ok || RETRIABLE.indexOf(r.status) < 0 || attempt >= BACKOFF.length) return r;
      return new Promise(function (resolve) { setTimeout(resolve, BACKOFF[attempt]); })
        .then(function () { return fetchWithRetry(url, attempt + 1); });
    });
  }

  function callApi(operation, params) {
    return fetchWithRetry(buildUrl(operation, params))
      .then(function (r) { return r.text(); })
      .then(function (text) {
        var json;
        try {
          json = JSON.parse(text);
        } catch (e) {
          var m = /<returnAuthMsg>([^<]*)</.exec(text);
          var err = new Error(m ? m[1] : '인증 오류로 보입니다. 키를 확인하세요.');
          err.code = 'AUTH';
          throw err;
        }
        var header = json.response && json.response.header;
        if (header && header.resultCode !== '00' && header.resultCode !== '0') {
          var e2 = new Error(header.resultMsg || '에어코리아 오류');
          e2.code = 'RESULT_' + header.resultCode;
          throw e2;
        }
        var body = (json.response && json.response.body) || {};
        return Array.isArray(body.items) ? body.items : [];
      });
  }

  var T = function () { return global.AirTransform; };

  global.AIRCHIP_DATA = {
    air: function (sido) {
      return cached('air:' + sido, TTL.realtime, function () {
        return callApi('getCtprvnRltmMesureDnsty', {
          numOfRows: '200', sidoName: sido, ver: '1.5'
        }).then(function (items) {
          if (!items.length) throw new Error('측정소 응답이 비어 있습니다.');
          return T().air(items, sido);
        });
      });
    },

    station: function (name) {
      return cached('station:' + name, TTL.realtime, function () {
        return callApi('getMsrstnAcctoRltmMesureDnsty', {
          numOfRows: '24', stationName: name, dataTerm: 'DAILY', ver: '1.5'
        }).then(function (items) {
          if (!items.length) throw new Error('시간별 값이 없습니다.');
          return T().station(items, name);
        });
      });
    },

    forecast: function () {
      return cached('forecast', TTL.forecast, function () {
        var searchDate = T().kstDate(0);
        /* 상류가 예보 오퍼레이션의 연속 호출에 504를 던진다. 병렬로 던지면 둘째가 막힌다.
           순차로 호출하고, 6시간 캐시가 이 지연을 최초 1회로 묶는다 */
        function fetchBoth(date) {
          return callApi('getMinuDustFrcstDspth', { numOfRows: '100', searchDate: date, InformCode: 'PM10' })
            .then(function (pm10) {
              return callApi('getMinuDustFrcstDspth', { numOfRows: '100', searchDate: date, InformCode: 'PM25' })
                .then(function (pm25) { return [pm10, pm25]; });
            });
        }
        return fetchBoth(searchDate).then(function (r) {
          /* R7 — 새벽에는 당일 통보가 없다. 전날로 재조회한다 */
          if (!r[0].length && !r[1].length) {
            var prev = T().kstDate(-1);
            return fetchBoth(prev).then(function (r2) {
              if (!r2[0].length && !r2[1].length) throw new Error('예보 없음');
              return T().forecast(r2[0], r2[1], { base: 'yesterday', searchDate: prev });
            });
          }
          return T().forecast(r[0], r[1], { base: 'today', searchDate: searchDate });
        });
      });
    },

    /* 조언만 내 서버를 경유한다. 서버 주소가 없으면 정적 폴백으로 조용히 떨어진다 (§5.2) */
    advice: function (payload) {
      if (!conf.endpoint) {
        return Promise.resolve({
          advice: global.AirGrade.fallbackAdvice(payload.pm10 && payload.pm10.grade,
                                                 payload.pm25 && payload.pm25.grade),
          source: 'fallback'
        });
      }
      return fetch(conf.endpoint.replace(/\/$/, '') + '/api/advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (r) { return r.json(); });
    }
  };

  /* ------------------------------------------------------------------------
     키 화면 ↔ 앱 화면
     ------------------------------------------------------------------------ */
  function $(id) { return document.getElementById(id); }

  function showSetup(message) {
    $('setup').hidden = false;
    $('app').hidden = true;
    var err = $('setup-error');
    if (message) { err.hidden = false; err.textContent = message; }
    else err.hidden = true;
    $('setup-key').value = conf.apiKey || '';
    $('setup-endpoint').value = conf.endpoint || '';
  }

  var appLoaded = false;
  function startApp() {
    $('setup').hidden = true;
    $('app').hidden = false;
    if (appLoaded) return;
    appLoaded = true;
    var s = document.createElement('script');
    s.src = 'app.js';
    s.onload = wirePopupExtras;
    document.body.appendChild(s);
  }

  /* 팝업에만 있는 조작 — 추이 펼치기, 키 변경 */
  function wirePopupExtras() {
    var toggle = $('chart-toggle');
    var wrap = $('chart-wrap');
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      wrap.hidden = open;
      toggle.querySelector('span').textContent = open ? '24시간 추이 보기' : '24시간 추이 접기';
      // 접힌 동안 캔버스 크기가 0이었으므로 펼친 뒤 다시 그린다
      if (!open) global.AirChip.redrawChart();
    });

    $('btn-reset-key').addEventListener('click', function () {
      global.LG.closePopover();
      showSetup(null);
    });
  }

  function saveAndStart() {
    var key = $('setup-key').value.trim();
    var endpoint = $('setup-endpoint').value.trim();
    if (!key) { showSetup('인증키를 입력해 주세요.'); return; }
    if (endpoint && !/^https?:\/\//.test(endpoint)) {
      showSetup('조언 서버 주소는 http(s)://로 시작해야 합니다.');
      return;
    }
    conf.apiKey = key;
    conf.endpoint = endpoint;
    var obj = {};
    obj[KEYS.apiKey] = key;
    obj[KEYS.endpoint] = endpoint;
    set(obj).then(function () {
      // 키가 바뀌면 이전 키로 받은 캐시는 버린다
      chrome.storage.local.get(null, function (all) {
        var stale = Object.keys(all).filter(function (k) { return k.indexOf('cache:') === 0; });
        if (stale.length) chrome.storage.local.remove(stale);
        location.reload();
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    $('setup-save').addEventListener('click', saveAndStart);
    $('setup-key').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') saveAndStart();
    });

    get([KEYS.apiKey, KEYS.endpoint]).then(function (v) {
      conf.apiKey = v[KEYS.apiKey] || '';
      conf.endpoint = v[KEYS.endpoint] || '';
      if (conf.apiKey) startApp();
      else showSetup(null);
    });
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
