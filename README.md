# 오늘의 대기질 (AirChip)

대한민국 17개 시도의 실시간 미세먼지, 측정소별 24시간 추이, 3일 예보를 칩 하나로 확인하는 웹 + 크롬 확장.

- 기능·데이터의 단일 출처 — [`AirChip_PRD.md`](AirChip_PRD.md)
- **디자인의 단일 출처** — [`DESIGN_liquid_glass.md`](DESIGN_liquid_glass.md)

두 문서가 충돌하면 디자인 요소는 DESIGN을 따른다. 그 판단 근거는 [구현 계획 §0](#설계-판단이-필요했던-지점)에 정리했다.

---

## 빠른 시작

```bash
# 1) 키를 채운다 (디코딩 키를 넣는다 — 인코딩 키를 넣으면 인증이 깨진다)
cp .env.local.example .env.local

# 2) 개발 서버 (의존성 설치 불필요)
node dev-server.mjs            # http://localhost:3000
node dev-server.mjs 8080       # 포트 지정

# 3) 가공 규칙 회귀 검사 (API 키 없이 실행 가능)
node scripts/verify-rules.mjs
```

`.env.local`

```
AIRKOREA_SERVICE_KEY=공공데이터포털 일반 인증키(디코딩)
GEMINI_API_KEY=Google AI Studio 키
```

> `GEMINI_API_KEY`가 없어도 앱은 정상 동작한다. 조언이 정적 문구로 나올 뿐이다.

---

## 구조

```
index.html              화면
assets/
  liquid-glass.css      DESIGN 부록 A 토큰 · 부록 B 레이어 스택 · standard materials
  app.css               씬 배경 · 레이아웃 · 배지 · 칩
  bootstrap.js          DESIGN 부록 E — 티어 감지 (웹·확장 공용)
  lg-runtime.js         굴절 맵(부록 C) · 굴절 필터(부록 D) · 팝오버 · 접근성 설정
  grade.js              등급 계산·표현 · 정적 조언 폴백    ← 서버·웹·확장 공용
  transform.js          에어코리아 응답 가공 규칙            ← 서버·확장 공용
  app.js                데이터 연결 · 렌더 · 차트
api/
  _lib.js               serviceKey 조립 · 캐시 헤더 · 최종정상응답 폴백
  air.js                시도 실시간 → 평균·최악·측정소 목록
  station.js            측정소 24시간 → 역순 정렬 · 결측 null화
  forecast.js           예보 → 최신 통보 선택 · 권역 파싱 · 전날 폴백
  advice.js             Gemini + 정적 폴백
extension/              크롬 확장 (공용 자산은 sync 스크립트가 복사)
scripts/
  verify-rules.mjs      가공 규칙 회귀 검사
  sync-extension.mjs    assets/ → extension/ 동기화
  make-icons.mjs        아이콘 PNG 생성 (의존성 없음)
dev-server.mjs          무의존 로컬 서버 (정적 + api 라우팅)
```

**공용 파일이 세 곳에서 쓰인다.** `grade.js`와 `transform.js`는 서버(`api/*.js`가 import), 웹, 확장이 모두 같은 함수를 호출한다. 가공 규칙이 한 곳에만 존재하도록 하기 위한 구조다.

---

## 배포 (Vercel)

```bash
vercel
```

배포 후 **대시보드 → Settings → Environment Variables**에 `AIRKOREA_SERVICE_KEY`, `GEMINI_API_KEY`를 등록한다.

> 로컬은 되는데 배포만 안 된다면 거의 100% 이 단계를 빠뜨린 것이다 (PRD §6.4).

---

## 크롬 확장

```bash
node scripts/make-icons.mjs      # 최초 1회
node scripts/sync-extension.mjs  # assets/ 수정할 때마다
```

`chrome://extensions` → 개발자 모드 → **압축해제된 확장 프로그램을 로드** → `extension/` 선택.

팝업을 처음 열면 인증키 입력 화면이 뜬다.

| 항목 | 설명 |
|---|---|
| 인증키 | 공공데이터포털 일반 인증키(디코딩). `chrome.storage.local`에 저장된다 |
| 조언 서버 주소 | 선택. 비우면 AI 없이 정적 문구로 동작한다. 배포했다면 `https://내앱.vercel.app` |

확장은 대기질을 **에어코리아에 직접 호출**하고, 조언만 서버를 경유한다(PRD §6.2). 사용자 키의 일일 500회 한도를 지키기 위해 팝업에도 서버와 같은 수명의 로컬 캐시(실시간 10분 / 예보 6시간)를 둔다.

추이 그래프는 **기본 접힘**이다. 팝업 높이 600px 한도를 지키기 위한 조치다(PRD §6.5).

---

## 설계 판단이 필요했던 지점

PRD와 DESIGN이 겹치는 자리에서 내린 결정들이다. 디자인 요소는 DESIGN이 이긴다.

| PRD 요구 | DESIGN 제약 | 채택안 |
|---|---|---|
| 칩 17개, 선택 시 배경·테두리·굵기 3중 | 유리 위 요소에 배경 금지(§1.4) · 화면당 굴절 표면 1~2개(§8.4) | **칩 바 하나만 유리 표면.** 개별 칩엔 배경이 없고, 선택 상태는 §10.2(b)의 비-backdrop 인디케이터가 표현한다 |
| 메인 카드·예보·조언·더보기 | 카드·리스트에 유리 금지(§8.2) | 전부 **콘텐츠 레이어 `.mat`**(블러+채도만, 굴절·스페큘러 없음) |
| 측정소 "드롭다운" | 팝오버는 트리거에서 나오고 스크림을 깔지 않는다(§9.5) | 네이티브 `<select>` 대신 **트리거 앵커링 리스트박스**. 열려 있는 동안 칩 바를 `.mat`로 강등해 굴절 표면 2개를 유지한다 |
| Tailwind CDN | 색·곡률·그림자는 DESIGN 토큰의 영역 | Tailwind는 **레이아웃 유틸리티 전용**. 유리·재질 요소에 `bg-*`·`rounded-*`·`shadow-*`를 쓰지 않는다 |
| Chart.js CDN | — (MV3 CSP가 원격 스크립트 차단) | 웹은 Chart.js, **확장은 자체 캔버스 렌더러**(`popup-chart.js`). `AIRCHIP_CHART` 어댑터로 갈아끼운다 |
| (PRD에 없음) | 투명도·모션 축소 토글은 필수(§12.2) | 헤더 설정 팝오버에 **테마 / 투명 효과 줄이기 / 모션 줄이기**를 노출한다. iOS Safari에는 `prefers-reduced-transparency`가 없어 이 토글이 유일한 접근성 경로다 |

### 굴절 티어

DESIGN §11.1대로 **폴백이 기본, 굴절이 추가**다. `@supports`는 파싱 가능성만 검사하므로 감지에 쓸 수 없다 — `bootstrap.js`가 런타임에 엔진을 판별해 `.lg-refract`를 단다.

| 티어 | 환경 | 적용 |
|---|---|---|
| A | Chromium | Frost + Refraction + Chromatic + Specular + squircle |
| B | Safari / Firefox (**기본값**) | Frost + Specular + 림 강화 |
| C | 투명도 축소 (3신호 + 수동 토글) | 불투명 서피스 |
| D | 저사양 / 절약 모드 | 정적 스페큘러만 |

---

## PRD에서 의도적으로 벗어난 곳

| PRD | 실제 구현 | 이유 |
|---|---|---|
| §3.4 측정소 드롭다운 정렬 = **현재 농도 내림차순** | **가나다순** | 이 목록의 용도는 "우리 동네"를 찾는 것이다. 경기는 측정소가 126개라 농도순으로는 아는 이름을 찾을 수 없다. 농도는 각 항목에 숫자로 함께 보이므로 정보는 사라지지 않고, "가장 나쁜 곳"으로의 동선은 기본 선택값이 계속 담당한다 |
| §5.2 조언 모델 = `gemini-3.0-flash` | `gemini-3.7-flash` (`GEMINI_MODEL`로 교체 가능) | 그 이름의 모델이 존재하지 않는다. ListModels 실측 결과 2.5 / 3.1 / 3.5 / 3.6 / 3.7 계열은 있고 3.0은 없다 |
| §4.7 강원 예보 권역 = `강원영서` / `강원영동` | `영서` / `영동` (문서 표기는 별칭으로 유지) | 실제 응답의 권역명이 다르다. R8이 예고한 지점이며, 원문 19개 권역을 확인해 확정했다 |

## 지키고 있는 규칙

PRD가 "협상 대상이 아니다"라고 못박은 것들이다. `scripts/verify-rules.mjs`가 회귀를 잡는다.

- **결측(`-`·빈 문자열)은 평균 계산에서 완전히 제외한다.** 0으로 바꾸면 평균이 통째로 망가진다 (R4)
- **추이는 역순 정렬한다.** 응답이 최신순이므로 정렬하지 않으면 시간이 거꾸로 흐른다 (R5)
- **그래프의 결측은 `null` + `spanGaps: false`.** 0으로 찍으면 "공기가 갑자기 깨끗해졌다"로 읽힌다 (R6)
- **`serviceKey`는 수동으로 1회만 인코딩한다.** `URLSearchParams`에 넣으면 이중 인코딩된다 (R1)
- **예보는 오늘 조회가 비면 전날로 재조회한다.** 새벽에는 당일 통보가 없다 (R7)
- **조언은 정적 폴백이 먼저 그려진다.** AI 실패는 화면에 오류를 남기지 않는다 (R10)
