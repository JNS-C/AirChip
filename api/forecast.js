/* ==========================================================================
   api/forecast.js — 대기질 예보통보 (PRD §4.7)
   InformCode별 1회씩 총 2회 호출로 전국 모든 권역의 3일치 예보를 확보한다.
   시도별 반복 호출이 필요 없다 — 이것이 호출 예산(§9)을 지키는 핵심이다.

   R7 — 새벽에는 당일 통보가 아직 없다. 전날로 재조회하는 폴백을 둔다.
   R8 — 권역명 파싱과 시도 매핑은 assets/transform.js의 forecast()가 담당한다.
   ========================================================================== */
import {
  fetchAirKorea, sendJson, sendError, CACHE_FORECAST,
  rememberGood, recallGood, ApiError
} from './_lib.js';
import '../assets/grade.js';
import '../assets/transform.js';

async function fetchCode(informCode, searchDate) {
  const body = await fetchAirKorea('getMinuDustFrcstDspth', {
    numOfRows: '100',
    searchDate,          // 통보 발령일이다. 예보 대상일이 아님에 주의
    InformCode: informCode
  });
  return Array.isArray(body.items) ? body.items : [];
}

export default async function handler(req, res) {
  const cacheKey = 'forecast';
  const T = globalThis.AirTransform;

  try {
    /* 상류가 예보 오퍼레이션의 연속 호출에 504를 던진다(실측).
       두 InformCode를 병렬로 던지면 둘째가 거의 확실히 막히므로 순차로 호출한다.
       6시간 캐시가 걸려 있어 이 지연은 사실상 최초 1회만 발생한다 (§4.6) */
    async function fetchDay(date) {
      const pm10 = await fetchCode('PM10', date);
      const pm25 = await fetchCode('PM25', date);
      return [pm10, pm25];
    }

    /* R7 — 오늘로 조회해 결과가 없으면 전날로 재조회한다 */
    let searchDate = T.kstDate(0);
    let base = 'today';
    let [pm10Items, pm25Items] = await fetchDay(searchDate);

    if (!pm10Items.length && !pm25Items.length) {
      searchDate = T.kstDate(-1);
      base = 'yesterday';
      [pm10Items, pm25Items] = await fetchDay(searchDate);
    }

    if (!pm10Items.length && !pm25Items.length) {
      throw new ApiError('NO_FORECAST', '예보 통보가 아직 발표되지 않았습니다.');
    }

    const payload = T.forecast(pm10Items, pm25Items, { base, searchDate });
    rememberGood(cacheKey, payload);
    return sendJson(res, payload, CACHE_FORECAST);
  } catch (err) {
    const fallback = recallGood(cacheKey);
    if (fallback) return sendJson(res, fallback, 'no-store');
    return sendError(res, err);
  }
}
