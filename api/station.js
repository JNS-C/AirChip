/* ==========================================================================
   api/station.js — 측정소별 24시간 추이 (PRD §4.4)
   R5 — 응답은 최신순이므로 역순 정렬하지 않으면 시간이 거꾸로 흐른다
   R6 — 결측을 0으로 찍으면 그래프가 바닥으로 내리꽂혀 "공기가 갑자기 깨끗해졌다"로 읽힌다
   두 규칙 모두 assets/transform.js의 station()이 담당한다.
   ========================================================================== */
import {
  fetchAirKorea, sendJson, sendError, CACHE_REALTIME,
  rememberGood, recallGood, query, ApiError
} from './_lib.js';
import '../assets/grade.js';
import '../assets/transform.js';

export default async function handler(req, res) {
  const { station } = query(req);
  if (!station) {
    return sendError(res, new ApiError('BAD_STATION', '측정소명이 필요합니다.', 400));
  }

  const cacheKey = 'station:' + station;

  try {
    const body = await fetchAirKorea('getMsrstnAcctoRltmMesureDnsty', {
      numOfRows: '24',         // 24시간분
      stationName: station,
      dataTerm: 'DAILY',
      ver: '1.5'
    });

    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) throw new ApiError('EMPTY', '해당 측정소의 시간별 값이 없습니다.');

    const payload = globalThis.AirTransform.station(items, station);
    rememberGood(cacheKey, payload);
    return sendJson(res, payload, CACHE_REALTIME);
  } catch (err) {
    const fallback = recallGood(cacheKey);
    if (fallback) return sendJson(res, fallback, 'no-store');
    return sendError(res, err);
  }
}
