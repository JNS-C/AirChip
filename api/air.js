/* ==========================================================================
   api/air.js — 시도별 실시간 측정정보 (PRD §4.2 / §4.3)
   이 응답 하나가 두 가지 역할을 한다:
     ① 시도 평균·최악 산출 (메인 카드)  ② 측정소 드롭다운 목록 (§3.4)
   가공 규칙은 assets/transform.js에 있다 — 확장 팝업이 같은 함수를 쓴다.
   ========================================================================== */
import {
  fetchAirKorea, sendJson, sendError, CACHE_REALTIME,
  rememberGood, recallGood, query, ApiError
} from './_lib.js';
import '../assets/grade.js';
import '../assets/transform.js';

const SIDO = new Set([
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'
]);

export default async function handler(req, res) {
  const { sido } = query(req);

  if (!sido || !SIDO.has(sido)) {
    return sendError(res, new ApiError('BAD_SIDO', `알 수 없는 시도: ${sido || '(없음)'}`, 400));
  }

  const cacheKey = 'air:' + sido;

  try {
    const body = await fetchAirKorea('getCtprvnRltmMesureDnsty', {
      numOfRows: '200',        // 경기도 측정소 수가 가장 많다. 여유 확보
      sidoName: sido,
      ver: '1.5'               // 낮은 버전에서는 PM2.5 자체가 오지 않는다 (R3)
    });

    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) throw new ApiError('EMPTY', '측정소 응답이 비어 있습니다.');

    const payload = globalThis.AirTransform.air(items, sido);
    await rememberGood(cacheKey, payload);
    return sendJson(res, payload, CACHE_REALTIME);
  } catch (err) {
    // R11 — 시연 중 장애 대비. 마지막 정상 응답이 있으면 stale 표시와 함께 내려준다
    const fallback = await recallGood(cacheKey);
    if (fallback) return sendJson(res, fallback, 'no-store');
    return sendError(res, err);
  }
}
