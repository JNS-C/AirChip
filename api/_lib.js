/* ==========================================================================
   api/_lib.js — 에어코리아 호출 공통 유틸
   PRD §4 데이터 명세 · §10 리스크 대응(R1·R2·R4·R11)
   ========================================================================== */

const BASE = 'https://apis.data.go.kr/B552584/ArpltnInforInqireSvc';

/* --------------------------------------------------------------------------
   R1 — serviceKey 이중 인코딩. 가장 흔한 실패 지점이다.
   .env.local에는 "디코딩" 키를 넣는다.
   URLSearchParams는 값을 자동 인코딩하므로 serviceKey를 여기에 넣으면
   이미 인코딩된 키가 한 번 더 인코딩되어 인증이 깨진다.
   → 나머지 파라미터만 URLSearchParams로 만들고, serviceKey는 수동으로 1회만 붙인다.
   -------------------------------------------------------------------------- */
export function buildUrl(operation, params) {
  const key = process.env.AIRKOREA_SERVICE_KEY;
  if (!key) throw new ApiError('MISSING_KEY', 'AIRKOREA_SERVICE_KEY가 설정되지 않았습니다.');

  const qs = new URLSearchParams({ returnType: 'json', pageNo: '1', ...params });
  // 키가 이미 % 인코딩된 형태(인코딩 키)로 들어와도 이중 인코딩되지 않게 한다
  const encodedKey = /%[0-9A-Fa-f]{2}/.test(key) ? key : encodeURIComponent(key);
  return `${BASE}/${operation}?serviceKey=${encodedKey}&${qs.toString()}`;
}

export class ApiError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 상류가 연속 호출에 스로틀을 건다 — 특히 예보 오퍼레이션에서 502/503/504가 나온다.
   실측: 첫 호출 200(125ms) 직후 같은 호출이 504(5초). 짧은 백오프로 재시도하면 통과한다. */
const RETRIABLE = new Set([429, 500, 502, 503, 504]);
const BACKOFF = [700, 1800];

/* 공공데이터포털은 오류도 200으로 XML을 내려주는 경우가 있다. 본문을 보고 판단한다. */
export async function fetchAirKorea(operation, params, { timeout = 8000 } = {}) {
  const url = buildUrl(operation, params);

  let res, text, lastError;
  for (let attempt = 0; attempt <= BACKOFF.length; attempt++) {
    if (attempt > 0) await sleep(BACKOFF[attempt - 1]);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
      text = await res.text();
    } catch (e) {
      lastError = new ApiError('NETWORK', `에어코리아 호출 실패: ${e.message}`);
      res = null;
      continue;
    } finally {
      clearTimeout(timer);
    }

    if (res.ok) { lastError = null; break; }
    lastError = new ApiError('HTTP_' + res.status, `에어코리아 응답 ${res.status}`);
    if (!RETRIABLE.has(res.status)) break;
    res = null;
  }

  if (!res) throw lastError || new ApiError('NETWORK', '에어코리아 호출 실패');
  if (!res.ok) throw new ApiError('HTTP_' + res.status, `에어코리아 응답 ${res.status}`);

  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    // XML 오류 응답 — 대개 인증키 문제(R1)다
    const reason = /<returnAuthMsg>([^<]*)</.exec(text)?.[1]
                || /<errMsg>([^<]*)</.exec(text)?.[1]
                || text.slice(0, 200);
    throw new ApiError('NOT_JSON', `JSON이 아닌 응답: ${reason}`);
  }

  const header = json?.response?.header;
  if (header && header.resultCode !== '00' && header.resultCode !== '0') {
    throw new ApiError('RESULT_' + header.resultCode, header.resultMsg || '에어코리아 오류');
  }
  return json?.response?.body ?? {};
}

/* --------------------------------------------------------------------------
   캐시 — PRD §4.6. 캐싱은 선택이 아니라 필수다(§9 호출 예산).
   -------------------------------------------------------------------------- */
export const CACHE_REALTIME = 's-maxage=600, stale-while-revalidate=1200';
export const CACHE_FORECAST = 's-maxage=21600, stale-while-revalidate=43200';

export function sendJson(res, payload, cacheControl) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (cacheControl) res.setHeader('Cache-Control', cacheControl);
  res.statusCode = 200;
  res.end(JSON.stringify(payload));
}

export function sendError(res, err) {
  const status = err instanceof ApiError ? err.status : 500;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = status;
  res.end(JSON.stringify({
    error: err?.code || 'UNKNOWN',
    message: err?.message || '알 수 없는 오류'
  }));
}

/* --------------------------------------------------------------------------
   R11 — 발표 시연 중 API 장애 대비. 마지막 정상 응답을 보관한다.
   워밍된 인스턴스 수명 동안만 유효한 최선 노력(best-effort) 캐시다.
   -------------------------------------------------------------------------- */
const lastGood = new Map();

export function rememberGood(key, payload) {
  lastGood.set(key, { at: Date.now(), payload });
}

export function recallGood(key) {
  const hit = lastGood.get(key);
  if (!hit) return null;
  return { ...hit.payload, stale: true, staleAt: new Date(hit.at).toISOString() };
}

/* 요청 쿼리를 어댑터 없이 읽는다 (Vercel은 req.query, 개발 서버는 URL 파싱) */
export function query(req) {
  if (req.query) return req.query;
  const url = new URL(req.url, 'http://localhost');
  return Object.fromEntries(url.searchParams.entries());
}
