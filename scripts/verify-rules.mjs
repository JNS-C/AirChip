/* ==========================================================================
   verify-rules.mjs — 가공 규칙 회귀 검사 (API 키 불필요)
   PRD가 "협상 대상이 아니다"라고 못박은 규칙들을 합성 응답으로 검증한다.
   실행: node scripts/verify-rules.mjs
   ========================================================================== */
import '../assets/grade.js';
import '../assets/transform.js';

const T = globalThis.AirTransform;
let fail = 0;
function check(name, cond, detail) {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + name + (cond ? '' : '  → ' + detail));
  if (!cond) fail++;
}

/* ── §4.3 결측 제외 · 평균 · 최악 측정소 ─────────────────────────────── */
const airItems = [
  { stationName: '가', pm10Value: '40', pm25Value: '20', dataTime: '2026-08-19 14:00', o3Value: '0.03' },
  { stationName: '나', pm10Value: '-',  pm25Value: '',   dataTime: '2026-08-19 14:00' },
  { stationName: '다', pm10Value: '120', pm25Value: '60', dataTime: '2026-08-19 14:00' },
  { stationName: '라', pm10Value: '20', pm25Value: '10', dataTime: '2026-08-19 14:00' }
];
const air = T.air(airItems, '경기');

check('결측 측정소가 평균에서 제외된다 (40+120+20)/3=60',
  air.pm10.avg === 60, 'avg=' + air.pm10.avg);
check('전체/유효 측정소 수를 함께 반환한다 (4개 중 3개)',
  air.total === 4 && air.pm10.valid === 3, `total=${air.total} valid=${air.pm10.valid}`);
check('최악 측정소는 최댓값을 가진 측정소다 (다, 120)',
  air.worst.name === '다' && air.worst.value === 120, JSON.stringify(air.worst));
check('드롭다운 정렬은 현재 농도 내림차순, 결측은 뒤로',
  air.stations.map(s => s.name).join('') === '다가라나', air.stations.map(s => s.name).join(''));
check('평균 60은 PM10 보통(31~80) 등급 2',
  air.pm10.grade === 2, 'grade=' + air.pm10.grade);
check('PM2.5 평균 30은 보통(16~35) 등급 2',
  air.pm25.avg === 30 && air.pm25.grade === 2, `avg=${air.pm25.avg} grade=${air.pm25.grade}`);
check('측정 시각을 한국식으로 표기한다',
  air.dataTimeText === '2026년 8월 19일 14시', air.dataTimeText);

/* 유효 0개 → 평균 null (0으로 표시 금지) */
const empty = T.air([{ stationName: '가', pm10Value: '-', pm25Value: '-' }], '서울');
check('유효 측정소 0개면 평균이 null이다 (0 아님)',
  empty.pm10.avg === null && empty.pm10.grade === 0, JSON.stringify(empty.pm10));

/* ── §4.4 / R5 역순 정렬 · R6 결측 null화 ─────────────────────────────── */
const stationItems = [
  { dataTime: '2026-08-19 14:00', pm10Value: '50', pm25Value: '25' },   // 최신이 먼저 온다
  { dataTime: '2026-08-19 13:00', pm10Value: '-',  pm25Value: '20' },
  { dataTime: '2026-08-19 12:00', pm10Value: '30', pm25Value: '15' }
];
const st = T.station(stationItems, '수원');
check('R5 — 오래된 값이 왼쪽으로 오도록 역순 정렬된다',
  st.labels.join(',') === '12시,13시,14시', st.labels.join(','));
check('R6 — 결측은 null이다. 0으로 찍지 않는다',
  st.pm10[1] === null, 'pm10[1]=' + st.pm10[1]);
check('결측 개수를 함께 보고한다',
  st.missing.pm10 === 1 && st.missing.pm25 === 0, JSON.stringify(st.missing));

/* 24시 표기가 순서를 어긋내지 않는다 */
const wrap = T.station([
  { dataTime: '2026-08-19 24:00', pm10Value: '10', pm25Value: '5' },
  { dataTime: '2026-08-19 23:00', pm10Value: '20', pm25Value: '9' }
], '테스트');
check('24시 표기도 23시 뒤에 온다',
  wrap.labels.join(',') === '23시,24시', wrap.labels.join(','));

/* ── §4.7 예보 권역 파싱 · 이중 권역 · 최신 통보 선택 ───────────────── */
const today = T.kstDate(0), tomorrow = T.kstDate(1);
const fcPm10 = [
  { informData: today, dataTime: '2026-08-19 05:00',
    informGrade: '서울 : 좋음,경기북부 : 보통,경기남부 : 보통,영서 : 좋음,영동 : 좋음',
    informOverall: '오전 개요(구버전)', informCause: '원인(구버전)' },
  { informData: today, dataTime: '2026-08-19 17:00',
    informGrade: '서울 : 보통,경기북부 : 나쁨,경기남부 : 보통,영서 : 보통,영동 : 좋음',
    informOverall: '최신 개요', informCause: '대기 정체' },
  { informData: tomorrow, dataTime: '2026-08-19 17:00',
    informGrade: '서울 : 나쁨,경기북부 : 매우나쁨,경기남부 : 나쁨' }
];
const fcPm25 = [
  { informData: today, dataTime: '2026-08-19 17:00',
    informGrade: '서울 : 보통,경기북부 : 나쁨,경기남부 : 좋음',
    informOverall: 'PM2.5 개요', informCause: 'PM2.5 원인' }
];
const fc = T.forecast(fcPm10, fcPm25, { base: 'today', searchDate: today });

const seoulToday = fc.bySido['서울'][0];
check('같은 날 여러 통보 중 dataTime이 최신인 건을 채택한다',
  seoulToday.pm10.grade === 2, 'grade=' + seoulToday.pm10.grade);

const gyeonggiToday = fc.bySido['경기'][0];
check('이중 권역은 더 나쁜 쪽을 대표 등급으로 쓴다 (북부 나쁨)',
  gyeonggiToday.pm10.grade === 3, 'grade=' + gyeonggiToday.pm10.grade);
check('이중 권역의 세부를 함께 남긴다 (병기용)',
  gyeonggiToday.pm10.split.length === 2, JSON.stringify(gyeonggiToday.pm10.split));

const gangwonToday = fc.bySido['강원'][0];
check('R8 — 실측 권역명 영서/영동이 강원으로 매핑된다',
  gangwonToday.pm10.split.length === 2, JSON.stringify(gangwonToday.pm10.split));

check('예보가 없는 날은 available=false로 표시된다 (칸을 숨기지 않기 위함)',
  fc.bySido['서울'][2].available === false, JSON.stringify(fc.bySido['서울'][2]));

check('informOverall·informCause는 hidden에만 담긴다 (화면 미노출)',
  fc.hidden.pm10.cause === '대기 정체' && fc.hidden.pm25.overall === 'PM2.5 개요',
  JSON.stringify(fc.hidden));

check('17개 시도가 모두 채워진다',
  Object.keys(fc.bySido).length === 17, Object.keys(fc.bySido).length);

/* ── §5.2 정적 폴백 조언 ─────────────────────────────────────────────── */
const G = globalThis.AirGrade;
const adv = G.fallbackAdvice(2, 4);
check('폴백 조언은 더 나쁜 등급을 기준으로 고른다 (매우나쁨)',
  adv.mask.includes('KF94'), JSON.stringify(adv));
check('폴백 조언은 세 필드를 모두 채운다',
  !!(adv.ventilation && adv.mask && adv.exercise), JSON.stringify(adv));

/* ── §4.5 등급 경계값 ────────────────────────────────────────────────── */
check('PM10 경계 30/31 → 좋음/보통',
  G.gradeOf('pm10', 30) === 1 && G.gradeOf('pm10', 31) === 2, '');
check('PM10 경계 150/151 → 나쁨/매우나쁨',
  G.gradeOf('pm10', 150) === 3 && G.gradeOf('pm10', 151) === 4, '');
check('PM2.5 경계 15/16, 75/76',
  G.gradeOf('pm25', 15) === 1 && G.gradeOf('pm25', 16) === 2 &&
  G.gradeOf('pm25', 75) === 3 && G.gradeOf('pm25', 76) === 4, '');

console.log('\n' + (fail ? `  ${fail}건 실패` : '  전부 통과'));
process.exit(fail ? 1 : 0);
