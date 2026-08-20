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

/* --------------------------------------------------------------------------
   재시도 예산 — vercel.json의 maxDuration(10초) 안에서 반드시 끝나야 한다.

   실측 분포(n=68, 시도 17곳 × 4회):
     성공  p50 180ms · p90 1221ms · p95 3341ms · max 8519ms
     실패  최소 5005ms · p50 10546ms · 최대 63971ms  ← 전부 504 SERVICE TIME OUT
   실패는 아무리 빨라도 5초다. 즉 3.5초에서 끊으면 가망 없는 504를 기다리는 일이 없고,
   성공은 p90까지 넉넉히 담긴다. 끊고 다시 걸면 대체로 통과한다.
   그리고 상류는 최대 64초까지 물고 늘어질 수 있다 — 시도별 타임아웃이 없으면 답이 없다.

   예전 설정(타임아웃 8초 × 3회 + 백오프 700·1800 = 최대 26.5초)은 배포 환경에서
   함수가 10초에 강제 종료되어 2·3번째 시도가 아예 실행될 수 없었다. 게다가 그때
   Vercel이 내려주는 504는 JSON이 아니라, 클라이언트에는 그냥 "불러오지 못했습니다"로 보였다.
   → 요청 전체에 마감시한을 하나 두고 그 안에서만 재시도한다.
      최악: 1200 + 300 + 2500 + 300 + 3500 = 7.8초. maxDuration 안에서 확실히 끝난다.
   -------------------------------------------------------------------------- */
const RETRIABLE = new Set([429, 500, 502, 503, 504]);

/* --------------------------------------------------------------------------
   재시도해도 소용없는 상류 오류. 봉투(OpenAPI_ServiceResponse)를 보고 가려낸다.

   특히 일일 요청제한 초과는 HTTP 429로 온다. 429는 원래 재시도 대상이지만
   이건 오늘 안에는 절대 풀리지 않는다 — 재시도하면 예산 7.8초를 통째로 헛되이 쓰고,
   이미 초과된 할당량을 세 번 더 깎은 뒤에야 폴백으로 넘어간다.
   즉시 포기해야 마지막 정상값(R11)이라도 바로 뜬다.
   -------------------------------------------------------------------------- */
const TERMINAL_UPSTREAM = [
  { re: /LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS/, code: 'QUOTA_EXCEEDED',
    msg: '에어코리아 일일 요청 한도를 초과했습니다. 자정(KST)에 초기화됩니다.' },
  { re: /SERVICE_KEY_IS_NOT_REGISTERED|SERVICE_ACCESS_DENIED|UNREGISTERED_IP/, code: 'BAD_KEY',
    msg: '에어코리아 서비스 키가 유효하지 않거나 권한이 없습니다.' },
  { re: /DEADLINE_HAS_EXPIRED/, code: 'KEY_EXPIRED',
    msg: '에어코리아 서비스 키의 사용 기한이 만료되었습니다.' }
];

/* --------------------------------------------------------------------------
   차단기 — 일일 한도를 소진한 것을 이미 확인했다면 상류를 다시 두드리지 않는다.
   한도는 자정(KST)까지 풀리지 않으므로 매 요청 확인하는 것은 낭비이고,
   거부당한 호출도 집계에 들어갈 수 있다. 마지막 정상값(R11)을 곧바로 내주는 편이 낫다.
   영구히 막지는 않는다 — 한도가 상향되거나 판단이 틀렸을 수 있으니 주기적으로 다시 본다.
   -------------------------------------------------------------------------- */
const QUOTA_COOLDOWN_MS = 600000;   // 10분마다 한 번씩 다시 확인한다
const quotaBlockedUntil = new Map();

function quotaBlocked(operation) {
  const until = quotaBlockedUntil.get(operation) || 0;
  if (Date.now() >= until) return null;
  return new ApiError('QUOTA_EXCEEDED',
    '에어코리아 일일 요청 한도를 초과했습니다. 자정(KST)에 초기화됩니다.', 503);
}

function terminalUpstream(text) {
  if (!text || text.indexOf('OpenAPI_ServiceResponse') < 0) return null;
  const hit = TERMINAL_UPSTREAM.find((t) => t.re.test(text));
  return hit ? new ApiError(hit.code, hit.msg, 503) : null;
}

export const REQUEST_BUDGET_MS = 8000;   // maxDuration 10초 - 응답 직렬화 여유

/* 시도별 타임아웃을 점점 늘린다.

   첫 시도는 짧게 끊는 것이 이득이다 — 실패(504)는 최소 5초이므로 1.2초에서 끊어도
   성사될 응답을 버리는 일이 없고, 가망 없는 호출을 3.5초씩 붙들고 있지 않게 된다.
   측정소 추이는 성공이 p90 130ms · p95 292ms로 특히 빨라서 대부분 첫 시도에 끝난다.
   뒤 시도는 느린 성공(시도별 조회는 성공 p95가 3341ms까지 간다)을 담도록 넉넉히 준다.

   합계 1200+300+2500+300+3500 = 7.8초로 예산 안에 들어가면서 기회는 2번 → 3번이 된다. */
const ATTEMPT_TIMEOUTS_MS = [1200, 2500, 3500];
const BACKOFF_MS = 300;
const MIN_ATTEMPT_MS = 900;              // 이보다 적게 남았으면 새 시도를 시작하지 않는다

/* 한 요청이 상류를 여러 번 부를 때(예보는 최대 4회) 예산을 나눠 쓰도록 마감시한을 공유한다 */
export function newDeadline(ms = REQUEST_BUDGET_MS) {
  return { endsAt: Date.now() + ms };
}

/* 공공데이터포털은 오류도 200으로 XML을 내려주는 경우가 있다. 본문을 보고 판단한다. */
export async function fetchAirKorea(operation, params, opts = {}) {
  /* 한도는 오퍼레이션별로 걸린다. 시도별 조회가 막혀도 측정소 조회는 살아 있을 수 있다 */
  const blocked = quotaBlocked(operation);
  if (blocked) throw blocked;

  const url = buildUrl(operation, params);
  const deadline = opts.deadline || newDeadline(opts.budget);
  const remaining = () => deadline.endsAt - Date.now();

  let res = null, text = '', lastError = null, attempts = 0;

  while (remaining() >= MIN_ATTEMPT_MS) {
    /* 백오프까지 하고 나면 시도할 시간이 남지 않는다 — 헛되이 기다리지 않고 끝낸다 */
    if (attempts > 0) {
      if (remaining() < MIN_ATTEMPT_MS + BACKOFF_MS) break;
      await sleep(BACKOFF_MS);
    }
    attempts++;

    const budget = ATTEMPT_TIMEOUTS_MS[Math.min(attempts - 1, ATTEMPT_TIMEOUTS_MS.length - 1)];
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Math.min(budget, remaining()));
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

    /* 이 API는 오류를 200으로 내려주기도 한다. 상태코드보다 본문이 정확하다 */
    const terminal = terminalUpstream(text);
    if (terminal) {
      if (terminal.code === 'QUOTA_EXCEEDED') {
        quotaBlockedUntil.set(operation, Date.now() + QUOTA_COOLDOWN_MS);
      }
      throw terminal;
    }

    if (res.ok) { lastError = null; break; }
    lastError = new ApiError('HTTP_' + res.status, `에어코리아 응답 ${res.status}`);
    if (!RETRIABLE.has(res.status)) break;
    res = null;
  }

  if (!res) throw lastError || new ApiError('TIMEOUT', '에어코리아 응답이 제한 시간 안에 오지 않았습니다.');
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
   R11 — 마지막 정상 응답 보관. 두 단계다.

     1차 인스턴스 메모리 — 빠르고 공짜지만 워밍된 인스턴스 수명 동안만 산다.
     2차 공유 저장소     — 콜드 스타트와 인스턴스 교체를 넘어 살아남는다.

   2차가 필요한 이유는 시연 중 장애만이 아니다. 상류의 일일 요청 한도는
   오퍼레이션별로 걸리고 자정(KST)까지 풀리지 않는다. 한도를 소진한 뒤에는
   이 캐시가 유일한 데이터 공급원이다 — 1차만으로는 배포 환경에서
   인스턴스가 갈릴 때마다 비어 있어 사실상 없는 것과 같았다.

   설정은 Vercel KV / Upstash Redis REST 환경변수로 한다. 없으면 조용히 1차만 쓴다.
   의존성은 추가하지 않는다 — REST라 fetch로 충분하다.
   -------------------------------------------------------------------------- */
const lastGood = new Map();

const KV_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL   || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const KV_ON = !!(KV_URL && KV_TOKEN);
const KV_PREFIX = 'airchip:lastgood:';
const KV_TTL_S = 86400;          // 자정 리셋을 넘기기에 충분하다
const KV_TIMEOUT_MS = 1500;      // 저장소가 느려도 사용자 요청 예산을 갉아먹지 않게 한다

/* 공유 저장소 쓰기는 아껴 쓴다. 실시간 값은 1시간 단위로 갱신되므로
   매 요청 쓰는 것은 낭비다. 인스턴스별로 키당 5분에 한 번이면 충분하다 */
const KV_WRITE_INTERVAL_MS = 300000;
const kvWroteAt = new Map();

async function kvFetch(path, init) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), KV_TIMEOUT_MS);
  try {
    const res = await fetch(`${KV_URL}/${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${KV_TOKEN}`, ...(init?.headers || {}) }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;             // 공유 캐시는 최선 노력이다. 실패해도 본 흐름을 막지 않는다
  } finally {
    clearTimeout(timer);
  }
}

async function kvGet(key) {
  if (!KV_ON) return null;
  const out = await kvFetch(`get/${encodeURIComponent(KV_PREFIX + key)}`);
  if (!out || typeof out.result !== 'string') return null;
  try {
    const rec = JSON.parse(out.result);
    return rec && rec.payload ? rec : null;
  } catch {
    return null;
  }
}

async function kvSet(key, rec) {
  if (!KV_ON) return;
  await kvFetch(`set/${encodeURIComponent(KV_PREFIX + key)}?EX=${KV_TTL_S}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(rec)
  });
}

export async function rememberGood(key, payload) {
  const now = Date.now();
  const rec = { at: now, payload };
  lastGood.set(key, rec);

  if (!KV_ON) return;
  if (now - (kvWroteAt.get(key) || 0) < KV_WRITE_INTERVAL_MS) return;
  kvWroteAt.set(key, now);
  await kvSet(key, rec);
}

function stamp(rec) {
  return { ...rec.payload, stale: true, staleAt: new Date(rec.at).toISOString() };
}

export async function recallGood(key) {
  const hit = lastGood.get(key);
  if (hit) return stamp(hit);

  const remote = await kvGet(key);
  if (!remote) return null;
  lastGood.set(key, remote);      // 다음 요청은 메모리에서 바로 준다
  return stamp(remote);
}

/* 요청 쿼리를 어댑터 없이 읽는다 (Vercel은 req.query, 개발 서버는 URL 파싱) */
export function query(req) {
  if (req.query) return req.query;
  const url = new URL(req.url, 'http://localhost');
  return Object.fromEntries(url.searchParams.entries());
}
