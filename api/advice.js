/* ==========================================================================
   api/advice.js — Gemini 조언 (PRD §5)
   시키지 않는 것: "나쁨이면 마스크" 수준의 1:1 매핑 → 정적 테이블이 처리한다
   시키는 것: 조건이 엇갈리는 상황의 한국어 서술 (PM10·PM2.5 불일치, 평균과 최악의 격차,
             상승/하강 추세, 현재와 예보의 역전 등)

   폴백은 선택 사항이 아니다. 발표 중 무료 한도 초과로 조언 영역이 비는 사고를 막는 장치다.
   ========================================================================== */
import { sendJson, sendError, ApiError } from './_lib.js';
import '../assets/grade.js';   // globalThis.AirGrade — 정적 폴백 테이블의 단일 출처

/* PRD §5.2는 `gemini-3.0-flash`를 지정하지만 그 이름의 모델은 존재하지 않는다.
   (ListModels 실측 — 2.5/3.1/3.5/3.6/3.7 flash 계열은 있고 3.0은 없다)
   PRD의 의도인 flash 티어를 유지하되, 정식 최신 모델을 기본값으로 둔다.
   교체는 GEMINI_MODEL 환경변수로 한다. 코드를 고칠 필요가 없다. */
const DEFAULT_MODEL = 'gemini-3.7-flash';

const SCHEMA = {
  type: 'object',
  properties: {
    ventilation: { type: 'string' },
    mask: { type: 'string' },
    exercise: { type: 'string' }
  },
  required: ['ventilation', 'mask', 'exercise']
};

function gradeText(g) {
  return ({ 0: '측정 불가', 1: '좋음', 2: '보통', 3: '나쁨', 4: '매우나쁨' })[g] || '측정 불가';
}

/* 개인정보는 일절 포함하지 않는다 (§5.3) */
function buildPrompt(d) {
  const lines = [];
  lines.push(`지역: ${d.sido}`);
  lines.push(`PM10 평균 ${d.pm10?.avg ?? '측정 불가'} (${gradeText(d.pm10?.grade)})`);
  lines.push(`PM2.5 평균 ${d.pm25?.avg ?? '측정 불가'} (${gradeText(d.pm25?.grade)})`);
  if (d.worst) lines.push(`가장 나쁜 측정소: ${d.worst.name} ${d.worst.value}`);
  if (d.coverage) lines.push(`유효 측정소 ${d.coverage.valid}/${d.coverage.total}개`);
  if (d.dataTime) lines.push(`측정 시각: ${d.dataTime}`);

  if (d.station?.recentPm25?.length) {
    const vals = d.station.recentPm25.map((v) => (v === null ? '결측' : v)).join(', ');
    lines.push(`${d.station.name} 측정소 최근 6시간 PM2.5: ${vals} (왼쪽이 과거)`);
  }
  if (Array.isArray(d.forecast)) {
    lines.push('예보: ' + d.forecast
      .map((f) => `${f.label} PM10 ${gradeText(f.pm10)}·PM2.5 ${gradeText(f.pm25)}`)
      .join(' / '));
  }
  if (d.hidden?.pm25?.overall) lines.push(`예보 개요: ${d.hidden.pm25.overall}`);
  if (d.hidden?.pm25?.cause) lines.push(`발생 원인: ${d.hidden.pm25.cause}`);
  else if (d.hidden?.pm10?.cause) lines.push(`발생 원인: ${d.hidden.pm10.cause}`);

  return [
    '너는 대기질 데이터를 읽고 오늘 무엇을 하면 되는지 알려주는 도우미다.',
    '아래 데이터를 근거로 환기·마스크·운동 세 가지 조언을 각각 한국어 한 문장으로 써라.',
    '',
    '규칙:',
    '- 각 문장은 40자 이내.',
    '- 숫자를 그대로 반복하지 말고 무엇을 하면 되는지를 말해라.',
    '- 조건이 엇갈리면(PM10과 PM2.5의 등급이 다름, 평균과 최악 측정소의 격차가 큼,',
    '  추세가 오르거나 내림, 현재와 예보가 역전됨) 그 점을 반영해라.',
    '- 근거가 있으면 짧게 덧붙여라. 예: "대기 정체로 농도가 오를 전망이니".',
    '- 과장하거나 겁주지 마라.',
    '',
    '데이터:',
    ...lines
  ].join('\n');
}

function sanitize(obj) {
  const out = {};
  for (const k of ['ventilation', 'mask', 'exercise']) {
    const v = obj?.[k];
    if (typeof v !== 'string' || !v.trim()) return null;
    out[k] = v.trim().replace(/\s+/g, ' ').slice(0, 60);
  }
  return out;
}

async function callGemini(prompt, apiKey) {
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res = await fetch(`${endpoint}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: SCHEMA,
          temperature: 0.7,
          /* Gemini 3.x는 thinking이 기본 활성이고 그 토큰도 이 예산을 먹는다.
             400으로 잡았더니 JSON이 잘려 파싱에 실패했다(실측). 끄고 넉넉히 준다 */
          thinkingConfig: { thinkingBudget: 0 },
          maxOutputTokens: 1024
        }
      })
    });
    if (!res.ok) throw new ApiError('GEMINI_' + res.status, await res.text());
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
    return sanitize(JSON.parse(text));
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendError(res, new ApiError('METHOD', 'POST만 허용됩니다.', 405));
  }

  let input = req.body;
  if (typeof input === 'string') { try { input = JSON.parse(input); } catch { input = null; } }
  if (!input || typeof input !== 'object') {
    return sendError(res, new ApiError('BAD_INPUT', '조언 입력이 없습니다.', 400));
  }

  /* 폴백을 먼저 확보한다. AI는 그 위에 얹히는 것이지 전제가 아니다 */
  const fallback = globalThis.AirGrade.fallbackAdvice(input.pm10?.grade, input.pm25?.grade);
  const key = process.env.GEMINI_API_KEY;

  res.setHeader('Cache-Control', 'no-store');

  if (!key) {
    return sendJson(res, { advice: fallback, source: 'fallback', reason: 'NO_KEY' });
  }

  try {
    const advice = await callGemini(buildPrompt(input), key);
    if (!advice) throw new ApiError('BAD_SHAPE', '응답 형식이 올바르지 않습니다.');
    return sendJson(res, { advice, source: 'gemini' });
  } catch (err) {
    // 조언 실패는 화면에 오류를 표시하지 않는다 (§7). 정적 문구로 조용히 대체한다
    console.warn('[advice] Gemini 실패 → 폴백:', err?.message || err);
    return sendJson(res, { advice: fallback, source: 'fallback', reason: err?.code || 'ERROR' });
  }
}
