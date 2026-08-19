/* ==========================================================================
   transform.js — 에어코리아 원시 응답 → 화면용 데이터
   서버(api/*.js)와 확장 팝업이 같은 함수를 쓴다.
   웹은 서버가, 확장은 팝업이 호출하지만 가공 규칙은 한 곳에만 존재한다.
   규칙의 원본은 PRD §4.3 / §4.4 / §4.7 이다.
   ========================================================================== */
(function (global) {
  'use strict';

  var G = global.AirGrade;

  /* R4 — 점검 중이거나 통신 장애인 측정소는 '-' 또는 빈 문자열을 반환한다.
     이를 숫자로 변환하면 평균이 통째로 망가진다. */
  function numOrNull(v) {
    if (v === null || v === undefined) return null;
    var s = String(v).trim();
    if (s === '' || s === '-' || s === '_') return null;
    var n = Number(s);
    return isFinite(n) ? n : null;
  }

  function mean(values) {
    if (!values.length) return null;
    var sum = 0;
    for (var i = 0; i < values.length; i++) sum += values[i];
    return Math.round(sum / values.length);
  }

  function formatKoreanTime(dataTime) {
    if (!dataTime) return null;
    var m = /(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2})/.exec(String(dataTime).trim());
    if (!m) return String(dataTime);
    return m[1] + '년 ' + Number(m[2]) + '월 ' + Number(m[3]) + '일 ' + Number(m[4]) + '시';
  }

  /* ------------------------------------------------------------------------
     시도 실시간 — PRD §4.3
     ------------------------------------------------------------------------ */
  function air(items, sido) {
    var stations = (items || []).map(function (it) {
      return {
        name: it.stationName,
        pm10: numOrNull(it.pm10Value),
        pm25: numOrNull(it.pm25Value),
        khai: numOrNull(it.khaiValue),
        o3:   numOrNull(it.o3Value),
        no2:  numOrNull(it.no2Value),
        co:   numOrNull(it.coValue),
        so2:  numOrNull(it.so2Value),
        dataTime: it.dataTime || null
      };
    }).filter(function (s) { return s.name; });

    var pm10Vals = stations.map(function (s) { return s.pm10; }).filter(function (v) { return v !== null; });
    var pm25Vals = stations.map(function (s) { return s.pm25; }).filter(function (v) { return v !== null; });

    var pm10Avg = mean(pm10Vals);
    var pm25Avg = mean(pm25Vals);

    /* 최악 측정소 — PM10 기준을 우선하고, PM10이 전부 결측이면 PM2.5로 넘어간다.
       드롭다운 기본값이 되므로 하나로 확정해야 한다 (§3.4) */
    var byPm10 = stations.filter(function (s) { return s.pm10 !== null; })
      .sort(function (a, b) { return b.pm10 - a.pm10; })[0] || null;
    var byPm25 = stations.filter(function (s) { return s.pm25 !== null; })
      .sort(function (a, b) { return b.pm25 - a.pm25; })[0] || null;
    var worst = byPm10 || byPm25;

    /* 드롭다운 정렬 — 현재 농도 내림차순. 결측은 뒤로 */
    var sorted = stations.slice().sort(function (a, b) {
      var av = a.pm10 === null ? a.pm25 : a.pm10;
      var bv = b.pm10 === null ? b.pm25 : b.pm10;
      if (av === null) return 1;
      if (bv === null) return -1;
      return bv - av;
    });

    var dataTime = null;
    for (var i = 0; i < stations.length; i++) {
      if (stations[i].dataTime) { dataTime = stations[i].dataTime; break; }
    }

    return {
      sido: sido,
      dataTime: dataTime,
      dataTimeText: formatKoreanTime(dataTime),
      total: stations.length,
      pm10: { avg: pm10Avg, grade: G.gradeOf('pm10', pm10Avg), valid: pm10Vals.length },
      pm25: { avg: pm25Avg, grade: G.gradeOf('pm25', pm25Avg), valid: pm25Vals.length },
      worst: worst ? {
        name: worst.name,
        pm10: worst.pm10,
        pm25: worst.pm25,
        kind: worst.pm10 !== null ? 'pm10' : 'pm25',
        value: worst.pm10 !== null ? worst.pm10 : worst.pm25
      } : null,
      worstPm25: byPm25 ? { name: byPm25.name, value: byPm25.pm25 } : null,
      stations: sorted,
      stale: false
    };
  }

  /* ------------------------------------------------------------------------
     측정소 24시간 — PRD §4.4
     R5 역순 정렬 · R6 결측 null화
     ------------------------------------------------------------------------ */
  function hourOf(dataTime) {
    var m = /\s(\d{1,2})/.exec(String(dataTime || ''));
    if (!m) return null;
    var h = Number(m[1]);
    return isFinite(h) ? h : null;
  }

  /* 24시 표기(다음날 00시)를 그대로 두면 순서가 어긋난다 */
  function sortKey(dataTime) {
    var m = /(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2})/.exec(String(dataTime || ''));
    if (!m) return 0;
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) + Number(m[4]) * 3600000;
  }

  function station(items, stationName) {
    var series = (items || []).map(function (it) {
      return {
        dataTime: it.dataTime || null,
        key: sortKey(it.dataTime),
        hour: hourOf(it.dataTime),
        pm10: numOrNull(it.pm10Value),
        pm25: numOrNull(it.pm25Value)
      };
    }).sort(function (a, b) { return a.key - b.key; }).slice(-24);

    var latest = series[series.length - 1] || null;

    return {
      station: stationName,
      labels: series.map(function (p) { return p.hour === null ? '—' : p.hour + '시'; }),
      pm10: series.map(function (p) { return p.pm10; }),
      pm25: series.map(function (p) { return p.pm25; }),
      times: series.map(function (p) { return p.dataTime; }),
      latest: latest ? { dataTime: latest.dataTime, pm10: latest.pm10, pm25: latest.pm25 } : null,
      latestTimeText: latest ? formatKoreanTime(latest.dataTime) : null,
      missing: {
        pm10: series.filter(function (p) { return p.pm10 === null; }).length,
        pm25: series.filter(function (p) { return p.pm25 === null; }).length
      },
      count: series.length,
      stale: false
    };
  }

  /* ------------------------------------------------------------------------
     예보 — PRD §4.7
     ------------------------------------------------------------------------ */
  /* R8 — 권역명은 문서와 실제 응답이 다르다. 실측 기준으로 확정했다.
     2026-08-19 응답의 19개 권역:
       서울 인천 경기북부 경기남부 영서 영동 충북 충남 대전 세종
       전북 전남 광주 경북 경남 대구 부산 울산 제주
     강원은 "강원영서/강원영동"이 아니라 **"영서"/"영동"**으로 온다.
     문서상 표기도 별칭으로 남겨 둔다 — 없는 키는 자동으로 무시된다. */
  var REGION_TO_SIDO = {
    '서울': '서울', '부산': '부산', '대구': '대구', '인천': '인천', '광주': '광주',
    '대전': '대전', '울산': '울산', '세종': '세종',
    '경기북부': '경기', '경기남부': '경기',
    '영서': '강원', '영동': '강원',
    '강원영서': '강원', '강원영동': '강원',   // 문서 표기 별칭 (실측에서는 미등장)
    '충북': '충북', '충남': '충남', '전북': '전북', '전남': '전남',
    '경북': '경북', '경남': '경남', '제주': '제주'
  };

  /* KST 기준 날짜 문자열 */
  function kstDate(offsetDays) {
    var t = Date.now() + 9 * 3600000 + (offsetDays || 0) * 86400000;
    return new Date(t).toISOString().slice(0, 10);
  }

  /* "서울 : 보통,경기북부 : 나쁨,..." */
  function parseGrade(informGrade) {
    var out = {};
    if (!informGrade) return out;
    String(informGrade).split(',').forEach(function (chunk) {
      var idx = chunk.indexOf(':');
      if (idx < 0) return;
      var region = chunk.slice(0, idx).trim();
      var text = chunk.slice(idx + 1).trim();
      if (region) out[region] = text;
    });
    return out;
  }

  /* 통보 시각을 정렬 가능한 숫자로 바꾼다.
     실제 응답은 "2026-08-19 11시 발표" 형식이다 — 문자열 비교에 기대지 않는다 */
  function noticeKey(dataTime) {
    var s = String(dataTime || '');
    var d = /(\d{4})-(\d{2})-(\d{2})/.exec(s);
    var h = /(\d{1,2})\s*시/.exec(s) || /\s(\d{1,2}):/.exec(s);
    if (!d) return 0;
    return Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3])) + (h ? Number(h[1]) : 0) * 3600000;
  }

  /* 같은 예보 대상일에 하루 4건(05·11·17·23시)이 온다. 최신 통보를 채택한다 */
  function pickLatestByTargetDate(items) {
    var best = {};
    (items || []).forEach(function (it) {
      var target = String(it.informData || '').trim();
      if (!target) return;
      var prev = best[target];
      if (!prev || noticeKey(it.dataTime) >= noticeKey(prev.dataTime)) best[target] = it;
    });
    return best;
  }

  function forecast(pm10Items, pm25Items, meta) {
    var pm10ByDate = pickLatestByTargetDate(pm10Items);
    var pm25ByDate = pickLatestByTargetDate(pm25Items);

    var dayDefs = [
      { offset: 0, label: '오늘', date: kstDate(0) },
      { offset: 1, label: '내일', date: kstDate(1) },
      { offset: 2, label: '모레', date: kstDate(2) }
    ];

    var sidoList = [];
    Object.keys(REGION_TO_SIDO).forEach(function (r) {
      if (sidoList.indexOf(REGION_TO_SIDO[r]) < 0) sidoList.push(REGION_TO_SIDO[r]);
    });

    var bySido = {};
    sidoList.forEach(function (s) { bySido[s] = []; });

    dayDefs.forEach(function (day) {
      var pm10Map = parseGrade((pm10ByDate[day.date] || {}).informGrade);
      var pm25Map = parseGrade((pm25ByDate[day.date] || {}).informGrade);

      sidoList.forEach(function (sido) {
        var regions = Object.keys(REGION_TO_SIDO).filter(function (r) {
          return REGION_TO_SIDO[r] === sido;
        });

        function collect(map) {
          var parts = regions.filter(function (r) { return map[r] !== undefined; })
            .map(function (r) { return { region: r, text: map[r], grade: G.gradeFromText(map[r]) }; });
          if (!parts.length) return { grade: 0, text: null, split: [] };
          /* 이중 권역은 더 나쁜 쪽을 대표값으로. 나쁜 쪽을 숨기지 않는다 (§3.5) */
          var rep = parts.reduce(function (a, b) { return b.grade > a.grade ? b : a; });
          return { grade: rep.grade, text: rep.text, split: parts.length > 1 ? parts : [] };
        }

        var pm10 = collect(pm10Map);
        var pm25 = collect(pm25Map);
        bySido[sido].push({
          label: day.label,
          date: day.date,
          available: pm10.grade > 0 || pm25.grade > 0,
          pm10: pm10,
          pm25: pm25
        });
      });
    });

    var today = kstDate(0);
    var todayPm10 = pm10ByDate[today] || (pm10Items || [])[0] || {};
    var todayPm25 = pm25ByDate[today] || (pm25Items || [])[0] || {};

    return {
      base: (meta && meta.base) || 'today',
      searchDate: (meta && meta.searchDate) || today,
      days: dayDefs,
      bySido: bySido,
      /* 화면 미노출. Gemini 입력 전용 (§5.3) */
      hidden: {
        pm10: { overall: todayPm10.informOverall || null, cause: todayPm10.informCause || null },
        pm25: { overall: todayPm25.informOverall || null, cause: todayPm25.informCause || null }
      },
      stale: false
    };
  }

  var API = {
    numOrNull: numOrNull,
    mean: mean,
    formatKoreanTime: formatKoreanTime,
    kstDate: kstDate,
    air: air,
    station: station,
    forecast: forecast,
    REGION_TO_SIDO: REGION_TO_SIDO
  };

  global.AirTransform = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
