# DESIGN.md — Liquid Glass

> 버전 alpha.3 · 웹(HTML/CSS/SVG) 기준
> **1차 기반**: Apple 공식 문서 "Adopting Liquid Glass" (Technology Overviews) + Apple HIG "Materials"
> **2차 기반**: 웹 재현 연구 (kube.io, Outpace Studios, W3C svgwg #1142)
> 이 문서가 모든 수치의 원본이다. 다른 문서에 값을 복제하지 않는다.

### 출처 등급 — 모든 수치·규칙에 붙는다

| 태그 | 뜻 | 다룰 때 |
|---|---|---|
| <sup>A</sup> | **애플 공식 문서 원문.** 인용 가능 | 논쟁 종결. 바꾸려면 근거를 대라 |
| <sup>P</sup> | 애플 원문에서 **파생한 웹 번역** | 논리를 검토하되 방향은 신뢰 |
| <sup>W</sup> | **웹 재현 연구** 출처 | 브라우저 버전에 따라 흔들린다 |
| <sup>D</sup> | **저자 결정값.** 애플에 근거 없음 | 프로젝트 사정에 맞춰 자유롭게 바꿔라 |

태그 없는 문장은 <sup>D</sup>로 읽는다.

### 스코프 제외 (의도적)

애플 원문의 다음 섹션은 웹에 대응물이 없거나 이미 해결된 문제라 다루지 않는다 — **앱 아이콘**(Icon Composer, 레이어 구성), **검색 배치 관례**, **윈도우 연속 리사이즈**(웹은 반응형으로 해결), **`UIDesignRequiresCompatibility` 옵트아웃**.

---

## 1. 원칙 — 애플의 의도

### 1.1 유리는 주인공이 아니다 <sup>A</sup>

애플이 밝힌 이 재질의 목적은 **아래 콘텐츠에 집중을 가져오는 것**이다. 유리 자체가 시선을 끌면 실패다.

이 문장이 이 문서의 최상위 규칙이다. 아래 모든 결정은 여기서 파생된다.

> **판단 기준**: 어떤 표면에 유리를 얹을지 고민될 때, "이게 콘텐츠를 돋보이게 하나, 아니면 콘텐츠와 경쟁하나"를 묻는다. 후자면 얹지 않는다.

### 1.2 3층 구조 <sup>A</sup>

Liquid Glass는 **컨트롤과 내비게이션을 위한 별개의 기능 레이어**를 형성한다. 그런데 애플의 실제 구조는 두 층이 아니라 **세 층**이다. HIG는 콘텐츠 레이어에도 재질 체계(standard materials)를 따로 준다.

```
┌───────────────────────────────────────────────┐
│  기능 레이어 — Liquid Glass                    │  ← 내비게이션, 컨트롤. 떠 있다.
│  ───────────────────────────────────────────  │
│  콘텐츠 레이어 — standard materials            │  ← 카드, 시트 내부, 섹션 배경.
│                  (ultra-thin ~ thick)          │     블러만. 굴절·스페큘러 없다.
│  ───────────────────────────────────────────  │
│  베이스 — 불투명                                │  ← 본문, 이미지, 실제 정보.
└───────────────────────────────────────────────┘
```

애플은 이 분리를 명시적으로 요구한다 — 명확한 내비게이션 위계를 세우고, 콘텐츠와 내비게이션 요소를 분명히 구분하라. **유리를 어디에 쓸지는 미적 취향이 아니라 정보 구조의 문제다.**

> alpha.2까지 이 문서는 "유리 아니면 불투명"이라는 2진법이었다. 그러면 "카드 그리드에 유리를 못 쓰면 뭘 쓰나"에 답이 없다. 답은 §5.4의 standard materials다.

### 1.3 남용 금지 <sup>A</sup>

커스텀 컨트롤에 유리 효과를 적용한다면 **아껴서** 하라는 게 애플의 지침이다. 여러 커스텀 컨트롤에 남용하면 콘텐츠로부터 주의를 분산시켜 사용 경험이 나빠진다. 앱에서 **가장 중요한 기능 요소로 제한**한다.

### 1.4 커스텀 배경을 걷어낸다 <sup>A</sup>

애플이 Visual refresh 섹션에서 두 번째로 강조하는 항목이다.

> 컨트롤과 내비게이션 요소에서 커스텀 배경 사용을 줄여라. 커스텀 배경과 외형은 Liquid Glass나 시스템이 제공하는 다른 효과 — 예컨대 scroll edge effect — 를 덮어쓰거나 방해할 수 있다.

**웹 번역**: 유리 바 **안쪽** 요소에 또 배경을 얹지 않는다. 툴바 안 버튼에 `background: rgba(255,255,255,.1)`을 거는 순간 틴트가 이중으로 겹치고 scroll edge effect와 충돌해 탁해진다. 유리 위 요소는 **배경 없이 콘텐츠만** 올린다. 배경이 필요하면 그 요소를 별도 유리 그룹으로 승격하거나(§8.3), 부모 유리의 틴트를 조절한다.

### 1.5 네이티브와 웹의 결정적 차이

| | 네이티브 | 웹 |
|---|---|---|
| 재질 렌더링 | OS 컴포지터가 그림 | **우리가 직접 그려야 함** |
| 적응 동작 <sup>A</sup> | 겹침·포커스에 따라 자동 | **직접 구현** |
| 접근성 설정 대응 <sup>A</sup> | 표준 컴포넌트면 자동 | **직접 분기 — 게다가 Safari엔 감지 수단이 없다(§12.2)** |
| 성능 최적화 <sup>A</sup> | `GlassEffectContainer` | 수동, 그리고 굴절과 양립 불가(§10.2) |

애플 개발자는 `.glassEffect()` 한 줄이면 끝난다. 웹에서는 §5~§12 전부를 손으로 만들어야 한다. **이 문서의 존재 이유가 그 격차다.**

---

## 2. 변형 — Regular / Clear

### 2.0 API 지형 <sup>A</sup>

두 개의 독립 축이 있다.

| 축 | 값 | 의미 |
|---|---|---|
| **투명도** | Regular / Clear | Clear는 틴트가 거의 없다 |
| **강조** | Normal / Prominent | Prominent는 액센트 색을 머금는다 |

프레임워크별로 노출 방식이 다르다. **네 갈래가 온전히 존재하는 건 UIKit이다.**

- **UIKit** — `glass()`, `prominentGlass()`, `clearGlass()`, `prominentClearGlass()`
- **SwiftUI** — 버튼 스타일 `.glass`, `.glassProminent`, `.glass(_:)` / `Glass` 타입의 `.regular`, `.clear` 변형 + `.tint(_:)` + `.interactive()`
- **AppKit** — `.glass`

> alpha.2는 `glass`, `glassProminent`, `clearGlass`, `prominentClearGlass`를 한 세트로 적었다. SwiftUI 이름 2개와 UIKit 이름 2개를 섞은 것이었다. UIKit은 `glassProminent`가 아니라 **`prominentGlass`**다.

"Prominent = 액센트 색을 머금는다"는 추론이 아니다. SwiftUI 문서에 **"Assign a tint color to suggest prominence"**라고 명시돼 있다. <sup>A</sup>

### 2.1 Regular <sup>A</sup>

기본값. 시스템 컴포넌트 대부분이 이걸 쓴다. 애플의 정의:

> 배경 콘텐츠를 **블러하고 광도(luminosity)를 조정**해 텍스트 가독성을 유지한다.

주목할 점 — 애플은 "틴트로 가린다"가 아니라 **"광도를 조정한다"**고 말한다. 밝은 배경 위에선 어둡게, 어두운 배경 위에선 밝게 적응한다는 뜻이다. 웹에서 이 적응은 공짜가 아니다(§5.3의 이중 틴트로 근사한다).

**쓰는 곳** <sup>A</sup>: 배경 콘텐츠가 가독성 문제를 일으킬 수 있을 때, 또는 컴포넌트에 **텍스트가 상당량 있을 때**(알림, 사이드바, 팝오버).

### 2.2 Clear <sup>A</sup>

틴트를 거의 걷어낸 순수 유리. 아래 콘텐츠의 가시성을 최우선으로 한다.

**쓰는 곳** <sup>A</sup>: **시각적으로 풍부한 배경**(사진, 영상) 위에 뜨는 컴포넌트에만. 몰입감이 목적이다.

#### 디밍 레이어 — 애플의 명시 수치 <sup>A</sup>

여기가 alpha.2에서 가장 크게 틀렸던 지점이다. 애플은 Clear에서 가독성을 **포기하라고 하지 않는다.** 어두운 디밍으로 되찾으라고 한다.

| 아래 콘텐츠 | 처방 |
|---|---|
| **밝다** | **불투명도 35%의 어두운 디밍 레이어**를 추가하는 것을 고려한다 |
| 충분히 어둡다 | 디밍 불필요 |
| AVKit 표준 미디어 컨트롤 사용 | 자체 디밍 레이어를 갖고 있으므로 불필요 |

```css
/* Regular — 흰 틴트 그라디언트로 광도 조정을 근사 */
--lg-tint-regular:   linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,.08));  /* D */
--lg-tint-prominent: linear-gradient(180deg, rgba(64,120,255,.30), rgba(64,120,255,.18));    /* D */

/* Clear — 흰 틴트가 아니라 "조건부 다크 디밍"이다 */
--lg-tint-clear:       rgba(255,255,255,.04);   /* 어두운 배경 위. 거의 없다시피 */  /* D */
--lg-dim-clear-bright: rgba(0,0,0,.35);         /* 밝은 배경 위. Apple 명시값 */     /* A */
```

```css
.lg--clear            { --lg-tint: var(--lg-tint-clear); }
.lg--clear[data-bg="bright"] { --lg-tint: var(--lg-dim-clear-bright); }
```

배경 밝기 판정은 자동화할 수 있다 — 히어로 이미지를 1×1로 다운샘플해 상대 휘도를 구하고, 0.5를 넘으면 `data-bg="bright"`를 단다. 영상이면 첫 프레임 기준으로 한 번만 계산하고 그대로 간다. <sup>D</sup>

**Clear를 단색 배경 위에 쓰지 않는다.** <sup>A</sup> 뒤에 볼 게 없으면 그냥 흐릿한 사각형이다.

---

## 3. 무드 & 구분선

`투명` · `굴절` · `광택` · `부유`

일반 글래스모피즘과의 구분선을 먼저 긋는다. <sup>D</sup>

| | 글래스모피즘 | Liquid Glass |
|---|---|---|
| 배경 처리 | 블러만 | 블러 + **공간적 왜곡** |
| 가장자리 | 1px 반투명 보더 | **굴절 밴드 + 스페큘러 림** |
| 색 | 균일한 틴트 | 배경에서 색을 끌어옴 + **색수차** |
| 두께감 | 없음(평면) | 있음(렌즈 곡률) |
| 관계 | 개별 카드 | 가까워지면 **합쳐진다** <sup>A</sup> |
| 역할 | 장식 | **기능 레이어** <sup>A</sup> |

블러만 있으면 2013년 iOS 7이다. 왜곡이 재질의 정체성이고, **기능 레이어라는 역할이 디자인의 정체성이다.**

---

## 4. 재질 4요소 <sup>D</sup>

네 겹으로 쌓이며, 위로 갈수록 "진짜 같음"의 기여도가 크다.

| 층 | 이름 | 하는 일 | 없으면 | 출처 |
|---|---|---|---|---|
| 1 | **Frost** | 배경 블러 + 채도 상승 | 유리가 아니라 반투명 판 | <sup>A</sup> 블러 |
| 2 | **Refraction** | 가장자리에서 배경이 휘어 들어옴 | 두께가 사라져 평면으로 읽힘 | <sup>A</sup> 굴절 |
| 3 | **Specular** | 상단 림의 밝은 하이라이트 | 광택이 사라짐 | <sup>A</sup> 하이라이트·반사 |
| 4 | **Chromatic** | 굴절 밴드의 미세한 R/G/B 분리 | "잘 만든 CSS"에서 멈춤 | <sup>W</sup> **웹 창작** |

**정확히 하자.** 애플이 언급하는 시스템 효과 목록은 **반사·굴절·그림자·블러·하이라이트**이고, 이건 **앱 아이콘 레이어**에 시스템이 거는 효과를 설명하는 맥락이다. 컨트롤 재질의 구성 요소 명세가 아니다. 그리고 그 목록에 **색수차는 없다.**

즉 위 4요소는 애플 목록의 "대응"이 아니라 **웹 구현을 위한 재해석**이다. 4층 Chromatic은 전적으로 웹 재현 연구에서 온 것으로, 빼도 애플 문서 위반이 아니다. 그림자는 4요소 밖에서 §5.3이 담당한다.

### 제작 순서 <sup>D</sup>

**3층(Specular)부터.** 구현 비용이 가장 싸고 체감 기여도는 가장 크다. 2층(Refraction)은 Chromium에서만 동작하므로 마지막에 얹는 보너스로 취급한다. → §11

---

## 5. 컬러

유리는 **자기 색을 갖지 않는다.** 팔레트는 유리가 얹히는 씬과 틴트를 정의한다.

### 5.1 씬(배경) <sup>D</sup>

유리는 배경이 단조로우면 보이지 않는다. **채도·명도 대비가 있는 배경이 전제 조건이다.**

| 토큰 | Light | Dark |
|---|---|---|
| `--scene-base` | `#EEF1F6` | `#0B0D12` |
| `--scene-accent-a` | `#7FB2FF` | `#2B4C8C` |
| `--scene-accent-b` | `#FFB4C8` | `#6B2D52` |

### 5.2 컨트롤 위의 색 — 애플의 경고 <sup>A</sup>

컨트롤과 내비게이션에 색을 쓸 때는 **가독성이 유지되도록 절제**하라는 게 애플의 지침이다. 색을 쓴다면 시스템 컬러를 쓰거나, **라이트/다크 변형 + 각 변형의 고대비 옵션까지** 정의한다.

즉 액센트 색은 **한 값이 아니라 네 값**이다.

| 토큰 | Light | Light HC | Dark | Dark HC |
|---|---|---|---|---|
| `--accent` | `#0A63E8` | `#0442A8` | `#5A9BFF` | `#9CC4FF` |

HC 값은 `@media (prefers-contrast: more)`에서 스왑한다. 이 미디어 쿼리는 Safari도 지원하므로, §12.2에서 `prefers-reduced-transparency`의 대체 신호로도 쓴다.

### 5.3 림 & 그림자 <sup>D</sup>

| 토큰 | 값 |
|---|---|
| `--lg-rim-top` | `rgba(255,255,255,.55)` |
| `--lg-rim-bottom` | `rgba(255,255,255,.16)` |
| `--lg-shadow-contact` | `0 1px 2px rgba(0,0,0,.10)` |
| `--lg-shadow-ambient` | `0 12px 40px rgba(0,0,0,.24)` |

상단 림이 하단보다 **밝다.** 반대로 하면 즉시 가짜로 읽힌다.

### 5.4 콘텐츠 레이어의 재질 — standard materials <sup>A</sup> / 값 <sup>D</sup>

애플은 콘텐츠 레이어용으로 별도의 재질 체계를 준다. **iOS 기준 4단계**다 — ultra-thin, thin, regular(기본), thick. 더 두꺼울수록 대비가 좋고, 더 얇을수록 배경 맥락이 살아난다. <sup>A</sup>

**이 층에는 굴절도 스페큘러도 없다.** 블러와 채도만 쓴다. 그게 기능 레이어와 콘텐츠 레이어를 구분하는 시각적 신호다.

```css
:root {
  /* 콘텐츠 레이어 — 블러만. url() 필터 금지 */
  --mat-ultrathin: blur(4px)  saturate(140%);
  --mat-thin:      blur(8px)  saturate(150%);
  --mat-regular:   blur(16px) saturate(160%);
  --mat-thick:     blur(30px) saturate(170%);

  --mat-fill-ultrathin: rgba(255,255,255,.06);
  --mat-fill-thin:      rgba(255,255,255,.10);
  --mat-fill-regular:   rgba(255,255,255,.16);
  --mat-fill-thick:     rgba(255,255,255,.28);
}
.mat { backdrop-filter: var(--mat-regular); background: var(--mat-fill-regular);
       border-radius: 16px; }              /* 유리보다 작은 radius로 위계를 만든다 */
.mat--thin  { backdrop-filter: var(--mat-thin);  background: var(--mat-fill-thin); }
.mat--thick { backdrop-filter: var(--mat-thick); background: var(--mat-fill-thick); }
```

**선택 기준** <sup>A</sup>: 겉보기 색이 아니라 **의미와 권장 용도**로 고른다. 시스템 설정에 따라 외형이 바뀌기 때문이다.

애플은 재질 위 텍스트에 **vibrant color**를 쓰라고 한다. iOS 기준 라벨 4단계 — default(최고 대비) / secondary / tertiary / quaternary. **quaternary는 thin·ultraThin 위에서 쓰지 않는다.** <sup>A</sup>

| 토큰 | 값 | 쓰는 곳 |
|---|---|---|
| `--vib-label` | `rgba(255,255,255,.95)` | 본문 |
| `--vib-label-2` | `rgba(255,255,255,.68)` | 부제, 설명 |
| `--vib-label-3` | `rgba(255,255,255,.44)` | 비활성 |
| `--vib-label-4` | `rgba(255,255,255,.26)` | **regular/thick에서만** |

---

## 6. 타이포

유리 위 텍스트는 배경이 움직이면 대비비가 매 프레임 바뀐다. 평소보다 굵고 크게 간다. <sup>D</sup>

| 역할 | 크기 / 무게 | 비고 |
|---|---|---|
| Display | 34 / 700 | 콘텐츠 레이어에 배치 |
| Title | 22 / 600 | 유리 위 최소 굵기 |
| Body | 17 / 450 | **유리 위 본문은 지양** |
| Label | 13 / 550 | 컨트롤 라벨 |

- 유리 위 텍스트에 **400 무게를 쓰지 않는다.** 최소 450.
- 텍스트 그림자로 대비를 벌지 않는다. 틴트 알파를 올린다.
- SF Pro를 쓰지 않는다(Apple 플랫폼 외 라이선스 제약). Pretendard 또는 Inter.

### 6.1 섹션 헤더 대문자화 <sup>A</sup>

애플은 리스트·테이블·폼의 섹션 헤더를 **전체 대문자에서 타이틀 케이스로** 바꿨다. 가독성 최적화 목적이고, 개발자가 대문자로 넣어도 시스템이 타이틀 케이스로 렌더한다.

웹에서도 `text-transform: uppercase`를 섹션 헤더에 걸지 않는다.

### 6.2 리스트·폼의 여백 확대 <sup>A</sup>

같은 문단에 있는데 alpha.2가 빠뜨린 내용이다.

> 콘텐츠에 숨 쉴 공간을 주기 위해, 리스트·테이블·폼 같은 조직화 컴포넌트는 **행 높이와 패딩이 커졌다.** 섹션은 시스템 전반의 컨트롤 곡률에 맞춰 **모서리 radius가 커졌다.**

이건 유리와 무관한 별개의 변화이고, 유리 없는 화면에도 적용된다. **콘텐츠 레이어가 넉넉해져야 위에 뜬 유리가 답답해 보이지 않는다.**

| 토큰 | 값 | 비고 |
|---|---|---|
| `--row-h` | `52px` | iOS 18 기준 44px에서 상향 <sup>D</sup> |
| `--row-pad-x` | `20px` | <sup>D</sup> |
| `--row-pad-y` | `14px` | <sup>D</sup> |
| `--section-radius` | `18px` | 유리 28px보다 작게 — 위계 <sup>D</sup> |

---

## 7. 형태 — 동심 곡률

### 7.1 기본 토큰 <sup>D</sup>

애플은 "시트 radius 증가", "윈도우 rounder corners"라고만 하고 **수치를 주지 않는다.** 아래는 전부 저자 결정값이다.

| 토큰 | 값 | 근거 |
|---|---|---|
| `--lg-radius` | `28px` | 22px 미만이면 곡률이 안 보여 굴절이 무의미 |
| `--lg-radius-sm` | `22px` | 버튼·칩의 하한 |
| `--lg-light-angle` | `168deg` | 광원은 항상 위 |

### 7.2 동심 규칙 (Concentric) <sup>A</sup>

애플 플랫폼에서는 **하드웨어의 형태가 중첩된 UI 요소의 곡률·크기·형태를 결정한다.** 컨트롤, 시트, 팝오버, 윈도우가 모두 컨테이너와 동심(concentric)이 되도록 설계된다.

애플이 제공하는 API — SwiftUI `ConcentricRectangle`, `Shape.rect(corners:isUniform:)` / UIKit `UIView.cornerConfiguration`, `UICornerConfiguration`.

웹에서의 규칙: <sup>P</sup>

```
inner_radius = outer_radius − padding
```

중첩 요소의 radius를 **독립적으로 정하지 않는다.** 부모 28px에 padding 8px이면 자식은 20px이다. 이걸 어기면 모서리가 어긋나 보이고, 그 어긋남이 "애플스럽지 않음"의 큰 원인이다.

```css
.lg { --r: 28px; border-radius: var(--r); padding: 8px; }
.lg > .lg-inner { border-radius: calc(var(--r) - 8px); }
```

### 7.3 Squircle <sup>W</sup>

애플의 모서리는 원호가 아니라 연속 곡률이다. `border-radius`로는 정확히 안 나온다.

**지원 현황(2026):** `corner-shape`는 **Chromium 139부터 플래그 없이 정식 지원**된다. Safari·Firefox 미지원, Baseline 아님(글로벌 약 65%). "실험적"이라는 alpha.2의 표현은 이제 부정확하다.

`squircle`은 정식 키워드이며 `superellipse(2)`의 축약이다. 다른 키워드 — `round`=`superellipse(1)`, `bevel`=`superellipse(0)`, `scoop`=`superellipse(-1)`, `notch`=`superellipse(-∞)`, `square`=`superellipse(∞)`. 숫자를 직접 넣어 곡률을 미세 조정할 수 있다.

```css
@supports (corner-shape: squircle) {
  .lg { corner-shape: squircle; }
}
```

> **폴백 구조가 단순해지는 지점**: 굴절이 되는 브라우저와 squircle이 되는 브라우저가 **정확히 일치한다**(둘 다 Chromium 전용). §11의 티어 A에 squircle을 함께 묶으면 분기가 하나로 줄어든다.

차이가 결정적이면 `clip-path`로 superellipse를 직접 그리는 방법도 있지만, `overflow: hidden`·그림자와 상호작용이 나빠 권장하지 않는다.

### 7.4 두께 프리셋 <sup>D</sup>

| 프리셋 | blur | 굴절 스케일 | 용도 |
|---|---|---|---|
| thin | 8px | 18 | 플로팅 컨트롤, 칩 |
| regular | 12px | 14 | 헤더, 탭바 |
| thick | 24px | 10 | 바텀시트, 모달 |

얇은 유리일수록 블러가 적고 굴절이 강하다.

> 이 3단계는 §5.4의 standard materials 4단계와 **개념이 겹치지만 다른 층이다.** 여기는 기능 레이어(굴절 있음), 저기는 콘텐츠 레이어(굴절 없음). 토큰 이름을 `--lg-*`와 `--mat-*`로 분리해둔 이유다.

---

## 8. 적용 범위

§1.2의 레이어 분리를 실제 컴포넌트로 옮긴 것이다.

### 8.1 쓴다 (기능 레이어) <sup>A</sup>

- 상단 네비게이션 / 툴바
- 탭바, 사이드바, 세그먼트 컨트롤
- 시트, 팝오버, 액션시트
- 플로팅 액션 버튼
- 메뉴

애플이 자동으로 이 재질을 입히는 표준 컴포넌트 목록과 일치한다 — **바, 시트, 팝오버, 컨트롤.**

### 8.2 쓰지 않는다 (콘텐츠 레이어) <sup>P</sup>

- **카드 그리드** — 스크롤이 무너지고, 콘텐츠가 기능처럼 보인다
- **리스트 아이템** — 반복되면 유리가 싸구려가 된다
- **본문 텍스트 컨테이너** — 가독성이 무너진다
- **전체 화면 배경** — 뒤에 볼 게 없으면 유리가 아니다

**대신 §5.4의 standard materials를 쓴다.** 애플의 원문은 "콘텐츠 레이어에 Liquid Glass를 쓰지 마라"가 아니라 "콘텐츠 레이어 요소(앱 배경 등)에는 **standard materials를 대신 써라**"다. 금지가 아니라 대체다. <sup>A</sup>

**예외** <sup>A</sup>: 슬라이더·토글처럼 **일시적으로 상호작용하는 요소**는 콘텐츠 레이어에 있어도 인터랙션 중 Liquid Glass 외형을 취할 수 있다. → §9.3

### 8.3 그룹핑 — 툴바 아이템 <sup>A</sup>

alpha.2가 통째로 빠뜨린 섹션이고, 실무 밀도가 가장 높다.

애플의 규칙:

1. **유사한 동작을 하거나 인터페이스의 같은 부분에 영향을 주는 아이템끼리 묶는다.** 묶인 그룹은 배경을 공유한다.
2. 플랫폼 간 그룹 구성과 배치를 **일관되게** 유지한다.
3. 그룹 사이는 **fixed spacer**로 분리한다.
4. **한 배경을 공유하는 아이템끼리 텍스트와 아이콘을 섞지 않는다.**
5. 공통 동작은 텍스트보다 **표준 아이콘**으로 표현한다 — 인터페이스가 정돈되고 사용성이 올라간다.
6. 컨텍스트 메뉴 **상단 액션**은 같은 아이템의 **스와이프 액션과 일치**시킨다.

애플이 든 잘못된 예 — Undo / Redo / Markup / More 넷이 **한 배경**을 공유. 올바른 예 — `Undo·Redo` / `Markup·More` **두 배경**으로 분리.

**웹 번역: 유리 표면 하나 = 의미 그룹 하나.** <sup>P</sup>

```css
.lg-toolbar { display: flex; align-items: center; gap: 0; }
.lg-group   { display: flex; gap: 2px; padding: 4px;
              border-radius: var(--lg-radius-sm); }   /* 이 요소가 유리다 */
.lg-spacer  { inline-size: 12px; flex: none; }        /* 그룹 사이. 유리 아님 */
.lg-spacer--flex { flex: 1 1 auto; }                  /* 좌우 정렬용 */
```

```html
<div class="lg-toolbar">
  <div class="lg-group lg"><button>실행 취소</button><button>다시 실행</button></div>
  <div class="lg-spacer"></div>
  <div class="lg-group lg"><button>마크업</button><button>더 보기</button></div>
</div>
```

그룹 안 버튼에는 배경을 얹지 않는다(§1.4).

### 8.4 겹치지 않는다 <sup>A</sup>

애플은 **유리 요소를 서로 겹쳐 쌓지 말라**고 명시한다. 표준 간격을 쓰고 과밀을 피한다. 유리 위의 유리는 굴절이 이중으로 걸려 탁해진다.

화면당 굴절 표면은 **1~2개**. <sup>D</sup>

> **주의 — 겹침 금지와 병합은 다르다.** 애플이 금지하는 건 z축으로 **포개는** 것이고, `GlassEffectContainer`가 권하는 건 같은 평면에서 가까워졌을 때 **합쳐지는** 것이다(§10). 헷갈리면 "위에 얹었나(금지), 옆에 붙였나(권장)"로 판별한다.

---

## 9. 시스템 동작 재현

네이티브가 공짜로 주는 동작들. 웹에서는 직접 만들어야 하고, 이게 빠지면 "정적인 유리 사진"이 된다.

### 9.1 Scroll edge effect ★ <sup>A</sup>

콘텐츠가 컨트롤 아래로 스크롤될 때 **컨트롤의 가독성과 대비를 유지하기 위해 아래로 지나가는 콘텐츠를 가린다(obscure).** HIG는 이를 더 구체적으로 — 배경 콘텐츠를 **블러하고 불투명도를 낮춘다**고 설명한다. 시스템 바는 기본 적용된다. 애플은 `scrollEdgeEffectStyle(_:for:)`로 스타일을 고를 수 있게 하고, 커스텀 바는 `safeAreaBar` / `UIScrollEdgeElementContainerInteraction`으로 등록한다.

이게 없으면 스크롤 중 헤더 위 텍스트가 배경과 뒤엉켜 읽히지 않는다. **웹 Liquid Glass가 실패하는 가장 흔한 지점이다.**

#### 구현 — 마스크는 배경 층에만 건다

> **alpha.2의 코드는 틀렸다.** `.lg-bar { mask-image: ... }`는 요소와 **모든 자손**에 적용된다. 바 하단의 텍스트·아이콘·스페큘러 림이 함께 사라진다. 주석은 "블러가 페이드아웃"이라 했지만 실제로는 바 전체가 페이드아웃한다.

```css
.lg-bar { position: relative; isolation: isolate; }

/* 배경 층 — 여기에만 backdrop-filter와 mask를 건다 */
.lg-bar::before {
  content: ""; position: absolute; inset: 0; z-index: 0;
  backdrop-filter: blur(var(--lg-blur)) saturate(var(--lg-sat));
  background: var(--lg-tint);
  -webkit-mask-image: linear-gradient(180deg, #000 60%, transparent 100%);
          mask-image: linear-gradient(180deg, #000 60%, transparent 100%);
  pointer-events: none;
}
/* 콘텐츠는 마스크 밖에 둔다 */
.lg-bar > * { position: relative; z-index: 1; }
```

두 가지 스타일을 정의한다. <sup>D</sup>

| 스타일 | 마스크 | 쓰는 곳 |
|---|---|---|
| soft | `#000 55%, transparent 100%` | 히어로·미디어 위. 경계가 부드럽다 |
| hard | `#000 100%, transparent 100%` | 텍스트 밀도 높은 리스트 위. 경계가 또렷하다 |

**더 안전한 대안 — 스크림 한 겹.** 마스크 없이 바 아래에 그라디언트를 깐다. 자손 마스킹 문제가 원천적으로 없어 이쪽을 기본안으로 권한다.

```css
.lg-bar::after {
  content: ""; position: absolute; inset: auto 0 -28px 0; height: 28px;
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--scene-base) 85%, transparent), transparent);
  pointer-events: none;
}
```

### 9.2 Background extension effect <sup>A</sup>

사이드바·인스펙터 **아래로 배경이 이어지는 착시**. 실제로 콘텐츠를 밑에 넣거나 스크롤시키는 게 아니라, 인접 콘텐츠를 **미러링하고 블러를 걸어** 늘어난 것처럼 보이게 한다. 히어로 이미지가 있는 레이아웃에 특히 좋다.

```css
.extension {
  background-image: var(--hero-src);
  background-size: cover;
  transform: scaleX(-1);       /* 미러 */
  filter: blur(24px) saturate(120%);
}
```

관련해서 애플이 함께 요구하는 것 — **사이드바·인스펙터 옆 콘텐츠의 safe area 호환성을 점검하라.** 아래 콘텐츠가 적절히 비쳐 보여야 한다. <sup>A</sup>

### 9.3 인터랙션 중에만 유리화 <sup>A</sup>

슬라이더·토글의 **노브는 상호작용하는 동안** Liquid Glass로 변한다. 버튼은 메뉴·팝오버로 **유연하게 모프**된다.

즉 유리는 상시 상태가 아니라 **상태 변화**다. 정지 화면에서 모든 컨트롤이 유리면 애플과 다르게 보인다.

```css
.knob { transition: background var(--lg-dur) var(--lg-ease),
                    box-shadow  var(--lg-dur) var(--lg-ease),
                    transform   var(--lg-dur) var(--lg-ease); }
.knob:active,
.knob:focus-visible { background: var(--lg-tint-regular);
                      box-shadow: inset 0 1px .5px var(--lg-rim-top); }

/* 굴절은 전환하지 않고 켜고 끈다 — url() 필터는 보간되지 않는다 */
.lg-refract .knob:active { backdrop-filter: blur(12px) saturate(180%) url(#lg-refract); }
```

> `backdrop-filter`에 `transition: all`을 거는 건 피한다. `url()` 참조는 보간 불가능하고, 매 프레임 배경 재샘플링이 일어나 저사양에서 그대로 프레임을 떨어뜨린다.

**tvOS 확장 아이디어** <sup>A</sup> → <sup>P</sup>: tvOS에서는 **포커스가 이동해 온** 표준 버튼·컨트롤이 Liquid Glass 외형을 취한다. 웹의 키보드 포커스에 그대로 이식할 수 있다. 위 코드가 `:focus-visible`을 `:active`와 함께 받는 이유다 — 마우스 사용자에겐 누를 때, 키보드 사용자에겐 포커스될 때 유리가 된다.

### 9.4 시트의 적응형 불투명도 <sup>A</sup>

하프 시트는 화면 가장자리에서 **인셋**되어 아래 콘텐츠가 비쳐 보인다. 그러다 **전체 높이로 확장되면 더 불투명해져** 작업에 집중시킨다. 시트는 모서리 radius도 커졌다.

```css
.sheet          { --lg-tint: rgba(255,255,255,.14); margin-inline: 12px;
                  border-radius: var(--lg-radius); }
.sheet[data-expanded] { --lg-tint: rgba(255,255,255,.82); margin-inline: 0; }
```

애플이 함께 요구하는 점검 <sup>A</sup> — 시트 **안쪽**에서 커진 모서리에 너무 가까이 붙은 콘텐츠·컨트롤이 없는지, 시트 **바깥**에서 인셋된 틈으로 비쳐 보이는 콘텐츠가 의도대로인지 확인한다. 그리고 팝오버 콘텐츠 뷰에 커스텀 배경을 얹었다면 걷어낸다(§1.4).

### 9.5 액션시트는 트리거에서 나온다 <sup>A</sup>

alpha.2에 없던 항목이다. 애플은 동작을 바꿨다.

> 액션시트는 화면 하단 가장자리가 아니라, **그 동작을 시작한 요소로부터** 나온다. 활성 상태에서도 사람들이 **인터페이스의 다른 부분과 상호작용할 수 있다.**

**웹 번역**: 바텀시트 습관을 버리고 **팝오버를 트리거에 앵커링**한다. 그리고 **모달 스크림을 깔지 않는다** — 뒤쪽이 계속 조작 가능해야 한다.

```css
.actionsheet { position: absolute; /* anchor-name 기반 배치 권장 */
               border-radius: var(--lg-radius-sm); }
/* 배경 클릭 차단용 오버레이를 깔지 않는다. 바깥 클릭 시 닫기만 JS로 처리 */
```

`anchor-name` / `position-anchor`를 쓸 수 있으면 그쪽이 정답이고(Chromium), 아니면 트리거 `getBoundingClientRect()` 기반으로 배치한다.

### 9.6 스크롤 시 탭바 축소 — **옵트인** <sup>A</sup>

탭바는 스크롤에 반응해 물러나며 콘텐츠를 부각시킬 수 **있다.** 아래로 스크롤하면 축소, 반대 방향이면 확장.

> **기본 동작이 아니다.** 애플 원문은 "Choose whether to automatically minimize your tab bar", "You can opt into this behavior"다. 개발자가 `.tabBarMinimizeBehavior(.onScrollDown)`를 명시해야 켜진다. alpha.2는 이걸 기본값처럼 서술했다.

웹에서도 **기본 끔**으로 두고, 콘텐츠 몰입이 중요한 화면에서만 켠다.

---

## 10. 인터랙션 & 모션

```
--lg-ease: cubic-bezier(0.32, 0.72, 0, 1);   /* 스프링 근사 */
--lg-dur: 350ms;
```

| 상태 | 동작 | 의미 | 출처 |
|---|---|---|---|
| press | `scale(.97)` + 굴절 18→10 | 눌리면 유리가 얇아진다 | <sup>D</sup> |
| hover | 스페큘러 각도 4deg 회전 | 시점 변화 | <sup>D</sup> |
| focus | 유리화 (§9.3) | 키보드 사용자용 | <sup>P</sup> |
| appear | `scale(.92)` + blur 0→12, 굴절 0→14 | 유리가 응결된다 | <sup>D</sup> |
| scroll | 굴절 off, 블러만 유지 | 성능 방어 | <sup>D</sup> |

애플이 명시하는 건 `interactive()`가 "터치·포인터 상호작용에 반응한다"는 것까지다. 위 수치는 전부 저자 값이다.

### 10.1 병합 (Container) <sup>A</sup>

애플은 커스텀 유리 효과를 쓸 때 **`GlassEffectContainer`로 묶으라**고 권한다. 이유가 두 가지다 — **렌더링 성능 최적화**, 그리고 **유리 형태끼리 유연하게 모핑**. 컨테이너의 spacing이 클수록 더 일찍 합쳐진다.

### 10.2 ⚠️ 병합과 굴절은 **공존하지 않는다**

alpha.2가 나란히 제시하면서 언급하지 않은 충돌이다.

```css
/* gooey 병합 — 알파를 임계값으로 스냅시켜 윤곽을 다시 붙인다 */
.lg-container { filter: blur(10px) contrast(20); }
.lg-container > .lg { filter: blur(0); }
```

부모에 `filter`를 걸면 그 요소는 **backdrop root**가 된다. 자식의 `backdrop-filter`는 더 이상 페이지 배경을 샘플링하지 못하고 **부모 컨테이너 내부만** 샘플링한다. 결과적으로 유리 아래 배경이 사라지고 회색 판이 남는다.

즉 §10.1의 gooey 병합과 부록 B의 `backdrop-filter` 스택은 **동시에 성립할 수 없다.** 선택지는 둘이다.

| 선택 | 방법 | 대가 |
|---|---|---|
| **(a) 굴절 유지** | 병합을 포기. 형태 모핑은 `border-radius` + `width` 트랜지션으로 근사 | 합쳐지는 느낌이 약하다 |
| **(b) 병합 유지** | 병합 대상을 **틴트+스페큘러만 가진 비-backdrop 레이어**로 한정. `backdrop-filter`를 쓰지 않는다 | 그 그룹만 굴절이 없다 |

**탭바 인디케이터·세그먼트 컨트롤은 (b)로 충분하다.** 인디케이터는 작고 배경이 이미 유리 바이므로 굴절이 없어도 티가 안 난다. 그 외에는 (a)를 기본으로 한다.

```css
/* (b) — 배경을 읽지 않는 순수 형태 레이어만 병합 */
.seg-indicator-layer { filter: blur(8px) contrast(18); }
.seg-indicator       { background: var(--lg-tint-regular); filter: blur(0); }
/* 이 층에는 backdrop-filter를 절대 넣지 않는다 */
```

비용이 크다. **요소 2~4개 규모에서만** 쓴다. <sup>D</sup>

---

## 11. 브라우저 현실

**`backdrop-filter: url(#filter)`는 Chromium에서만 작동한다.** <sup>W</sup> Safari와 Firefox는 속성을 받아들이고 SVG 부분만 조용히 버린다. 에러도 나지 않는다. 그냥 평범한 블러가 된다. (WebKit Bugzilla #245510 미해결, MDN BCD #24110 확인)

**iOS Safari에서 안 된다.** 애플 감성을 노리는데 정작 애플 기기에서 굴절이 빠진다. 설계 초기에 받아들이고 시작한다.

### 11.1 ⚠️ `@supports`로는 감지할 수 없다

> **alpha.2의 폴백은 작동하지 않았다.**
> ```css
> @supports not (backdrop-filter: url(#lg-refract)) { /* 영원히 실행되지 않음 */ }
> ```
> `@supports`는 **파싱 가능성만** 검사한다. Safari와 Firefox는 `backdrop-filter`를 지원하고 `url()`도 문법상 유효한 필터 값으로 파싱하므로 이 쿼리는 **true**를 반환한다. `not (...)`은 false가 되어 폴백이 걸리지 않는다.
>
> 문서가 바로 위 문단에서 "속성을 받아들이고 SVG만 조용히 버린다. 에러도 나지 않는다"고 진단해놓고, 그 아래에서 `@supports`로 그걸 잡으려 했다. 진단과 처방이 모순이었다.

**대신 런타임에 판별하고 루트에 클래스를 단다.**

```js
// Chromium만 backdrop-filter에서 SVG 필터 참조를 실제로 렌더한다.
// 파싱 검사로는 구분 불가 → 엔진 판별이 필요하다.
const supportsBackdropSVG = (() => {
  if (!CSS.supports('backdrop-filter', 'blur(1px)')) return false;
  const ua = navigator.userAgent;
  const isWebKit = /AppleWebKit/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua);
  const isGecko  = /Gecko\//.test(ua) && /Firefox/.test(ua);
  return !isWebKit && !isGecko;
})();

document.documentElement.classList.toggle('lg-refract', supportsBackdropSVG);
```

UA 스니핑이 꺼려지면 오프스크린에서 1회 픽셀 검증을 한다 — 강한 변위를 건 8×8 요소를 렌더해 두 픽셀 색이 실제로 바뀌었는지 비교한다. 정확하지만 첫 페인트를 지연시키므로, 결과를 `sessionStorage`에 캐시한다. <sup>D</sup>

**CSS는 "폴백이 기본, 굴절이 추가"로 뒤집어 쓴다.** 감지에 실패해도 안전한 쪽으로 떨어진다.

```css
/* 티어 B — 기본값. 굴절 없는 모든 환경 */
.lg { --lg-blur: 16px; --lg-tint: rgba(255,255,255,.20); }

/* 티어 A — Chromium에서만 덧씌운다 */
.lg-refract .lg {
  --lg-blur: 12px; --lg-tint: rgba(255,255,255,.16);
  backdrop-filter: blur(var(--lg-blur)) saturate(var(--lg-sat)) url(#lg-refract);
}
@supports (corner-shape: squircle) { .lg-refract .lg { corner-shape: squircle; } }
```

### 11.2 폴백 티어

| 티어 | 조건 | 감지 | 적용 |
|---|---|---|---|
| A | Chromium | 런타임 JS (§11.1) | Frost + Refraction + Chromatic + Specular + squircle |
| B | Safari / Firefox | **기본값** | Frost + Specular + 림 강화(blur 16px, 틴트 +4%) |
| C | 투명도 축소 | 다중 신호 (§12.2) | 불투명 서피스, 굴절 제거 |
| D | 저사양 / 배터리 절약 | `navigator.deviceMemory`, `saveData` | 정적 스페큘러만 |

```js
// 티어 D
const lowEnd = navigator.connection?.saveData === true
            || (navigator.deviceMemory ?? 8) <= 4
            || (navigator.hardwareConcurrency ?? 8) <= 4;
document.documentElement.classList.toggle('lg-lowend', lowEnd);
```

```css
.lg-lowend .lg { backdrop-filter: none; background: var(--lg-solid); }
```

### 11.3 ⚠️ iOS 26 Safari는 브라우저 크롬 자체가 Liquid Glass다

우리가 유리를 그리기 전에 먼저 부딪히는 문제다. **Safari 26은 툴바 틴트를 `theme-color` 메타태그가 아니라, 뷰포트 가장자리 근처의 `position: fixed` / `sticky` 요소의 `background-color`·`backdrop-filter`를 샘플링해서 결정한다고 보고된다.**

> ⚠️ **이 항목은 3rd-party 보고 기반이며 애플 공식 문서에 없다. 실기기 검증 후 확정하라.** 다만 "유리 헤더를 `position: fixed`로 만들면 Safari 툴바가 같이 물든다"는 현상 자체는 재현 보고가 여럿이다.

대응(잠정): <sup>W</sup>

- 숨긴 고정 오버레이는 `opacity: 0`이 아니라 **`display: none`**으로 — 렌더 트리에 남아 있으면 툴바 색에 영향을 준다
- `html` / `body`에 **명시적 `background-color`**를 준다. 없으면 흰색으로 떨어진다
- 하단 툴바 투명 처리에 **`viewport-fit=cover`**가 필요하다
- 유리 효과는 fixed 부모가 아니라 **`position: absolute` 자식**에 걸고, fixed 부모는 투명하게 둔다

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

```css
html, body { background-color: var(--scene-base); }   /* 흰 바 방지 */
.lg-bar--fixed { position: fixed; background: transparent; }  /* 부모는 투명 */
.lg-bar--fixed > .lg-surface { position: absolute; inset: 0; /* 유리는 여기 */ }
```

### 11.4 우회 경로 — 전 브라우저 굴절 <sup>W</sup>

굴절을 모든 브라우저에서 내리려면 `backdrop-filter`가 아니라 일반 `filter`를 쓴다. 배경을 한 번 렌더해 공유하고, 렌즈 박스 안에 역위치된 복사본을 깔아 그걸 왜곡한다. 대가는 DOM 복제와 페인트 비용이다.

부수 효과 하나 — 이 방식은 `backdrop-filter`를 안 쓰므로 **§10.2의 병합 충돌이 사라진다.** 병합이 정말 중요한 프로젝트라면 이 경로를 처음부터 택하는 것도 방법이다.

---

## 12. 접근성

애플의 지침이 명확하다 <sup>A</sup> — **반투명과 유동적 모핑 애니메이션이 이 재질의 핵심이지만, 사람의 필요에 맞춰 적응해야 한다.** 사용자는 기기 설정에서 Liquid Glass의 선호 외형을 고르거나, 투명도 축소·모션 축소를 켤 수 있고, 그러면 특정 효과가 제거되거나 수정된다. 표준 컴포넌트는 자동 대응하지만 **커스텀 요소·색상·애니메이션은 직접 테스트**해야 한다.

웹에서는 전부 커스텀이다. 따라서 전부 테스트 대상이다.

### 12.1 기본 규칙

- 대비는 **틴트 레이어가 책임진다.** 블러는 대비를 보장하지 않는다.
- 최소 4.5:1을 **배경 최악의 경우** 기준으로 검증한다. 배경이 영상이면 가장 밝은 프레임과 가장 어두운 프레임 둘 다.
- 키보드 포커스 링은 유리 **위**에 그린다. 안에 넣으면 굴절에 먹힌다.
- 아이콘만 있는 컨트롤에는 **반드시 접근성 레이블**을 붙인다. <sup>A</sup> 애플은 "인터페이스에 무엇을 보여주든 관계없이 항상" 지정하라고 한다.

### 12.2 ⚠️ `prefers-reduced-transparency`는 Safari에 없다

> **alpha.2는 티어 C 전체를 이 미디어 쿼리에 걸었다. iOS에서는 아무 일도 일어나지 않는다.**

| 브라우저 | 지원 |
|---|---|
| Chrome / Edge | ✅ 118+ |
| Safari (desktop) | ❌ 미지원 |
| **Safari iOS** | ❌ **미지원** |
| Firefox | ❌ 기본 비활성 |

**iOS 사용자가 설정에서 "투명도 줄이기"를 켜도 이 문서의 웹 UI는 반응하지 않는다.** 굴절이 안 되는 플랫폼과 접근성 분기가 안 되는 플랫폼이 정확히 같다는 게 이 설계의 가장 아픈 지점이다.

**세 개의 신호를 모두 받는다. 그리고 수동 토글은 선택이 아니라 필수다.**

```css
/* 상태 플래그. CSS 조건문에는 못 쓰지만(커스텀 속성은 미디어 쿼리에 불가),
   getComputedStyle로 JS가 읽어 캔버스 맵 생성 여부 등을 판단한다 */
:root { --lg-solid-mode: 0; }

/* 1차 — 지원 브라우저 */
@media (prefers-reduced-transparency: reduce) { :root { --lg-solid-mode: 1; } }

/* 2차 — Safari 대체 신호. prefers-contrast는 iOS Safari도 지원한다 */
@media (prefers-contrast: more) { :root { --lg-solid-mode: 1; } }

/* 3차 — 사용자 토글. 설정 UI에 "투명 효과 줄이기"를 반드시 노출한다 */
:root[data-transparency="off"] { --lg-solid-mode: 1; }

/* 적용 */
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .lg { backdrop-filter: none; background: var(--lg-solid); box-shadow: var(--lg-shadow-contact); }
}
:root[data-transparency="off"] .lg {
  backdrop-filter: none; background: var(--lg-solid); box-shadow: var(--lg-shadow-contact);
}

/* 모션 — 이건 전 브라우저 지원된다 */
@media (prefers-reduced-motion: reduce) {
  .lg, .knob, .sheet { transition: none; animation: none; }
}
```

**체크리스트에 한 줄**: `prefers-reduced-transparency`만 믿지 않는다 — Safari 전 버전 미지원. **앱 내 토글을 반드시 함께 제공한다.**

### 12.3 테스트 매트릭스

| 축 | 값 |
|---|---|
| 엔진 | Chromium / WebKit(iOS 실기기) / Gecko |
| 외형 | Light / Dark |
| 대비 | 기본 / `prefers-contrast: more` |
| 투명도 | 기본 / 축소(토글) |
| 모션 | 기본 / 축소 |
| 배경 | 단색 / 사진(밝음) / 사진(어두움) / 영상 |

최소한 **WebKit × 사진(밝음) × 투명도 기본**은 반드시 실기기로 본다. 여기가 가장 잘 깨진다.

---

## 13. 금지사항

**설계 차원**

- 콘텐츠 레이어에 유리를 쓰지 않는다 — 기능 레이어 전용. 콘텐츠 레이어는 standard materials(§5.4) <sup>A</sup>
- 유리 위에 유리를 겹치지 않는다 <sup>A</sup>
- 화면의 여러 커스텀 컨트롤에 남용하지 않는다 <sup>A</sup>
- **유리 위 요소에 또 배경을 얹지 않는다** — 커스텀 배경은 시스템 효과와 충돌한다 <sup>A</sup>
- **한 배경을 공유하는 툴바 아이템끼리 텍스트와 아이콘을 섞지 않는다** <sup>A</sup>
- **서로 관련 없는 동작을 한 유리 그룹에 묶지 않는다** <sup>A</sup>
- 중첩 요소의 radius를 독립적으로 정하지 않는다(동심 규칙) <sup>A</sup>
- 단색 배경 위에 Clear 변형을 쓰지 않는다 <sup>A</sup>
- **밝은 배경 위 Clear에 디밍 없이 텍스트를 올리지 않는다** — 35% 다크 디밍 <sup>A</sup>
- **액션시트를 화면 하단에서 올리지 않는다** — 트리거에서 나온다 <sup>A</sup>
- 탭바 축소를 기본 동작으로 가정하지 않는다 — 옵트인 <sup>A</sup>
- 섹션 헤더에 `text-transform: uppercase`를 걸지 않는다 <sup>A</sup>

**구현 차원**

- **`@supports`로 굴절 지원을 감지하지 않는다** — 파싱만 검사하므로 항상 true다(§11.1)
- **`prefers-reduced-transparency` 단독으로 접근성 분기하지 않는다** — Safari 전 버전 미지원(§12.2)
- **gooey 병합과 `backdrop-filter`를 같은 트리에 쓰지 않는다** — 부모 `filter`가 backdrop root를 만든다(§10.2)
- **바 전체에 `mask-image`를 걸지 않는다** — 자손 콘텐츠까지 지워진다(§9.1)
- **`feTurbulence`로 굴절을 만들지 않는다** — 노이즈는 무작위 왜곡이라 출렁이는 젤리가 된다. 실제 Liquid Glass는 렌즈 곡률에서 나오는 결정론적 변위다
- `backdrop-filter`에 `transition: all`을 걸지 않는다 — `url()`은 보간되지 않고 프레임을 떨어뜨린다
- 왜곡을 전면에 걸지 않는다 — 가장자리 밴드(짧은 변의 7%)에만
- radius 22px 미만에 굴절을 걸지 않는다
- 카드 그리드·리스트에 유리를 걸지 않는다
- 유리 위에 긴 본문을 얹지 않는다
- 블러만 걸고 Liquid Glass라 부르지 않는다

---

## 14. 레퍼런스

| 출처 | 가져온 것 |
|---|---|
| **Apple — Adopting Liquid Glass** | 기능 레이어 원칙, 남용 금지, 커스텀 배경 제거, 동심 곡률, scroll edge effect, background extension, 인터랙션 중 유리화, 시트 적응형 불투명도, 탭바 축소(옵트인), 액션시트 앵커링, 툴바 그룹핑, 섹션 헤더 타이틀 케이스, 리스트 여백 확대, 접근성 요구, 아이콘 접근성 레이블 |
| **Apple HIG — Materials** | **Regular/Clear 변형 정의, Clear 디밍 레이어 35%, 콘텐츠 레이어용 standard materials 4단계, vibrancy 라벨 4단계** |
| **Apple — Applying Liquid Glass to custom views** (SwiftUI) | `GlassEffectContainer` 병합·모핑, tint = prominence, `interactive()` |
| Apple — `NSGlassEffectContainerView` | AppKit 병합 동작 |
| WebKit Bugzilla #245510 / MDN BCD #24110 | `backdrop-filter: url()` Safari·Firefox 미지원 확인 |
| caniuse — `prefers-reduced-transparency` | Safari 전 버전 미지원 확인 |
| squircle.js.org | `corner-shape` Chromium 139+ 지원 현황 |
| kube.io — Liquid Glass in the Browser | Snell 법칙 기반 변위 유도, 8bit 채널 제약(−128~127, 128=중립) |
| Outpace Studios — Liquid glass for the web | 배경 복사본 방식 폴백 |
| deepika-builds/liquid-glass | 맵 생성 알고리즘, 색수차 3패스 |
| 1ar.io — Safari 26 Liquid Glass (**미검증**) | 브라우저 크롬 틴트 샘플링 동작 |
| W3C svgwg #1142 | backdrop 굴절 표준화 논의(진행 중) |

---

## 부록 A — 구현 토큰

```css
:root {
  /* 기능 레이어 — Liquid Glass */
  --lg-blur: 12px;
  --lg-sat: 180%;
  --lg-bright: 1.06;
  --lg-radius: 28px;
  --lg-radius-sm: 22px;
  --lg-light-angle: 168deg;
  --lg-solid: color-mix(in srgb, var(--scene-base) 92%, #fff);  /* 티어 C/D용 */

  --lg-scale: 14;      /* 굴절 강도. 12–18 권장, 25 초과 시 아티팩트 */
  --lg-band: 0.07;     /* 짧은 변 대비 굴절 밴드 폭 */
  --lg-map-blur: 12;   /* 작을수록 날카로운 림, 클수록 돔 */
  --lg-chroma: 5;      /* 채널 간 스케일 편차. 0이면 색수차 없음 */

  /* 틴트 */
  --lg-tint-regular:   linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,.08));
  --lg-tint-prominent: linear-gradient(180deg, rgba(64,120,255,.30), rgba(64,120,255,.18));
  --lg-tint-clear:       rgba(255,255,255,.04);
  --lg-dim-clear-bright: rgba(0,0,0,.35);        /* Apple 명시값 */

  /* 림 & 그림자 */
  --lg-rim-top: rgba(255,255,255,.55);
  --lg-rim-bottom: rgba(255,255,255,.16);
  --lg-shadow-contact: 0 1px 2px rgba(0,0,0,.10);
  --lg-shadow-ambient: 0 12px 40px rgba(0,0,0,.24);

  /* 콘텐츠 레이어 — standard materials. 굴절·스페큘러 없음 */
  --mat-ultrathin: blur(4px)  saturate(140%);
  --mat-thin:      blur(8px)  saturate(150%);
  --mat-regular:   blur(16px) saturate(160%);
  --mat-thick:     blur(30px) saturate(170%);
  --mat-fill-ultrathin: rgba(255,255,255,.06);
  --mat-fill-thin:      rgba(255,255,255,.10);
  --mat-fill-regular:   rgba(255,255,255,.16);
  --mat-fill-thick:     rgba(255,255,255,.28);

  /* vibrancy 라벨 */
  --vib-label:   rgba(255,255,255,.95);
  --vib-label-2: rgba(255,255,255,.68);
  --vib-label-3: rgba(255,255,255,.44);
  --vib-label-4: rgba(255,255,255,.26);   /* regular/thick에서만 */

  /* 레이아웃 */
  --row-h: 52px;
  --row-pad-x: 20px;
  --row-pad-y: 14px;
  --section-radius: 18px;

  /* 모션 */
  --lg-ease: cubic-bezier(0.32, 0.72, 0, 1);
  --lg-dur: 350ms;
}
```

## 부록 B — 레이어 스택

```
z:3  content      — 텍스트/아이콘. 필터 영향 밖
z:2  specular     — ::after. 림 하이라이트 + 상단 글로스
z:1  tint         — ::before. 반투명 배경색. 가독성 담당
z:0  refraction   — backdrop-filter: blur() url(#lg-refract)   ← 티어 A에서만
```

```css
/* 티어 B 기본 — 굴절 없음 */
.lg {
  position: relative;
  isolation: isolate;
  border-radius: var(--lg-radius);
  overflow: hidden;
  --lg-blur: 16px;
  --lg-tint: var(--lg-tint-regular);
  backdrop-filter: blur(var(--lg-blur)) saturate(var(--lg-sat));
  -webkit-backdrop-filter: blur(var(--lg-blur)) saturate(var(--lg-sat));
  box-shadow:
    var(--lg-shadow-contact),
    var(--lg-shadow-ambient),
    inset 0 1px .5px var(--lg-rim-top),
    inset 0 -1px .5px var(--lg-rim-bottom);
}

/* 티어 A — Chromium에서만 굴절을 덧씌운다 (§11.1) */
.lg-refract .lg {
  --lg-blur: 12px;
  backdrop-filter: blur(var(--lg-blur)) saturate(var(--lg-sat)) url(#lg-refract);
}

.lg::before {
  content: ""; position: absolute; inset: 0; z-index: 1;
  background: var(--lg-tint); pointer-events: none;
}
.lg::after {
  content: ""; position: absolute; inset: 0; z-index: 2;
  background: linear-gradient(var(--lg-light-angle),
    rgba(255,255,255,.28) 0%, rgba(255,255,255,.06) 22%, rgba(255,255,255,0) 48%);
  pointer-events: none;
}
.lg__content { position: relative; z-index: 3; }

/* 변형 */
.lg--clear                   { --lg-tint: var(--lg-tint-clear); }
.lg--clear[data-bg="bright"] { --lg-tint: var(--lg-dim-clear-bright); }
.lg--prominent               { --lg-tint: var(--lg-tint-prominent); }
```

> `.lg`에 `overflow: hidden`이 걸려 있으므로 §10.2의 (b) 병합 레이어는 **이 클래스 밖**에 둔다.

## 부록 C — 굴절 맵 생성 <sup>W</sup>

목표 형태: **가장자리에만 변위, 내부는 중립.** 실제 유리는 평평한 가운데가 아니라 곡률이 있는 테두리에서 빛을 꺾는다.

```js
function buildMap(w, h, radius, band, mapBlur) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d");

  x.fillStyle = "rgb(128,128,128)";           // 중립 회색 베이스
  x.fillRect(0, 0, w, h);

  const gx = x.createLinearGradient(0, 0, w, 0);   // X 변위 → R 채널
  gx.addColorStop(0, "#000"); gx.addColorStop(1, "#f00");
  const gy = x.createLinearGradient(0, 0, 0, h);   // Y 변위 → B 채널
  gy.addColorStop(0, "#000"); gy.addColorStop(1, "#00f");

  x.globalCompositeOperation = "difference";
  x.fillStyle = gx; x.fillRect(0, 0, w, h);
  x.fillStyle = gy; x.fillRect(0, 0, w, h);

  const inset = Math.min(w, h) * band;             // 내부를 중립으로 되돌림
  x.globalCompositeOperation = "source-over";
  x.filter = `blur(${mapBlur}px)`;
  x.fillStyle = "rgb(128,128,128)";
  roundRect(x, inset, inset, w - inset*2, h - inset*2, Math.max(0, radius - inset));
  x.fill();

  return c.toDataURL();
}
```

크기가 바뀌면 맵을 다시 만든다. `ResizeObserver`로 갱신하고, 그 외에는 rAF 루프를 돌리지 않는다. 티어 A가 아니면 **아예 호출하지 않는다** — 쓰지도 않을 캔버스를 그릴 이유가 없다.

```js
if (supportsBackdropSVG) initRefractionMaps();
```

## 부록 D — 굴절 필터 (색수차 포함) <sup>W</sup>

같은 맵으로 스케일만 어긋나게 세 번 변위시킨 뒤 R·G·B만 각각 남겨 screen 합성한다. 이 편차가 프리즘 프린지를 만든다.

```html
<svg width="0" height="0" aria-hidden="true">
  <filter id="lg-refract" color-interpolation-filters="sRGB"
          x="-20%" y="-20%" width="140%" height="140%">
    <feImage href="MAP_DATA_URI" result="map" preserveAspectRatio="none"/>

    <feDisplacementMap in="SourceGraphic" in2="map" scale="19"
      xChannelSelector="R" yChannelSelector="B" result="dR"/>
    <feColorMatrix in="dR" type="matrix" result="cR"
      values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/>

    <feDisplacementMap in="SourceGraphic" in2="map" scale="14"
      xChannelSelector="R" yChannelSelector="B" result="dG"/>
    <feColorMatrix in="dG" type="matrix" result="cG"
      values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"/>

    <feDisplacementMap in="SourceGraphic" in2="map" scale="9"
      xChannelSelector="R" yChannelSelector="B" result="dB"/>
    <feColorMatrix in="dB" type="matrix" result="cB"
      values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"/>

    <feBlend in="cR" in2="cG" mode="screen" result="rg"/>
    <feBlend in="rg" in2="cB" mode="screen"/>
  </filter>
</svg>
```

세 스케일은 `--lg-scale` ± `--lg-chroma`다(14 기준 19 / 14 / 9). 색수차를 끄려면 셋을 같은 값으로 맞춘다.

## 부록 E — 부트스트랩 <sup>D</sup>

§11·§12의 런타임 감지를 한 곳에 모은다. `<head>` 끝에 인라인으로 넣어 FOUC를 막는다.

```html
<script>
(function () {
  const root = document.documentElement;

  // 티어 A — 굴절
  const ua = navigator.userAgent;
  const isWebKit = /AppleWebKit/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua);
  const isGecko  = /Gecko\//.test(ua) && /Firefox/.test(ua);
  root.classList.toggle('lg-refract',
    CSS.supports('backdrop-filter', 'blur(1px)') && !isWebKit && !isGecko);

  // 티어 D — 저사양
  root.classList.toggle('lg-lowend',
    navigator.connection?.saveData === true
    || (navigator.deviceMemory ?? 8) <= 4
    || (navigator.hardwareConcurrency ?? 8) <= 4);

  // 티어 C — 사용자 저장 설정 (미디어 쿼리는 CSS가 처리)
  const saved = localStorage.getItem('transparency');
  if (saved === 'off') root.dataset.transparency = 'off';
})();
</script>
```

설정 UI에는 최소 두 개를 노출한다 — **"투명 효과 줄이기"**, **"모션 줄이기"**. iOS에서는 이게 유일한 접근성 경로다(§12.2).

---

## 변경 이력

| 버전 | 날짜 | 내용 |
|---|---|---|
| alpha.1 | 2026-08-18 | 최초 작성. 웹 재현 연구 기반 |
| alpha.2 | 2026-08-18 | Apple 공식 문서를 1차 기반으로 재작성. 기능 레이어 원칙(§1) 신설, Regular/Clear 변형(§2) 추가, 동심 곡률 규칙(§7.2) 추가, 시스템 동작 재현(§9) 신설. 컨트롤 색상 4변형, 섹션 헤더 대문자 금지 추가 |
| **alpha.3** | **2026-08-18** | **애플 원문 전문 대조 검증 반영.**<br>**① 작동하지 않던 코드 4건 교체** — `@supports` 굴절 감지 → 런타임 판별(§11.1) / `prefers-reduced-transparency` 단독 의존 → 3신호 + 수동 토글(§12.2) / gooey 병합 ↔ `backdrop-filter` 충돌 경고 및 우회(§10.2) / 바 전체 `mask-image` → 배경 층 한정(§9.1).<br>**② 애플 원문 누락분 보강** — Clear 디밍 35%(§2.2), 콘텐츠 레이어 standard materials 4단계 + vibrancy(§5.4, §1.2를 3층 구조로 개정), 툴바 그룹핑 규칙(§8.3), 커스텀 배경 제거 원칙(§1.4), 액션시트 트리거 앵커링(§9.5), 리스트·폼 여백 확대(§6.2), tvOS 포커스 유리화의 웹 이식(§9.3).<br>**③ 사실 오류 3건 정정** — 버튼 스타일 API 이름 SwiftUI/UIKit 혼용, 탭바 축소는 옵트인, Regular/Clear 출처는 HIG Materials.<br>**④ 신뢰도** — 전 수치에 출처 등급 태그(A/P/W/D) 부착, `corner-shape` 지원 현황 갱신(Chromium 139+ 정식), iOS 26 Safari 크롬 틴트 경고(§11.3, 미검증 표시), 스코프 제외 명시, 부록 E 부트스트랩 신설 |
