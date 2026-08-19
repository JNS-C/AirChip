/* ==========================================================================
   lg-runtime.js — Liquid Glass 런타임
   · 굴절 맵 생성 (DESIGN 부록 C)
   · 굴절 필터 주입 (DESIGN 부록 D, 색수차 3패스)
   · 트리거 앵커링 팝오버 (§9.5 — 스크림 없음)
   · 접근성 설정 (§12.2 — 투명 효과 / 모션 / 테마)
   티어 감지는 index.html의 인라인 부트스트랩(부록 E)이 이미 끝냈다.
   ========================================================================== */
(function (global) {
  'use strict';

  var root = document.documentElement;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  function num(name, fallback) {
    var v = parseFloat(getComputedStyle(root).getPropertyValue(name));
    return Number.isFinite(v) ? v : fallback;
  }

  /* ------------------------------------------------------------------------
     1. 굴절 맵 — DESIGN 부록 C
     목표 형태: 가장자리에만 변위, 내부는 중립.
     실제 유리는 평평한 가운데가 아니라 곡률이 있는 테두리에서 빛을 꺾는다.
     ------------------------------------------------------------------------ */
  function roundRect(ctx, x, y, w, h, r) {
    var rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function buildMap(w, h, radius, band, mapBlur) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var x = c.getContext('2d');

    x.fillStyle = 'rgb(128,128,128)';            // 중립 회색 베이스
    x.fillRect(0, 0, w, h);

    var gx = x.createLinearGradient(0, 0, w, 0); // X 변위 → R 채널
    gx.addColorStop(0, '#000'); gx.addColorStop(1, '#f00');
    var gy = x.createLinearGradient(0, 0, 0, h); // Y 변위 → B 채널
    gy.addColorStop(0, '#000'); gy.addColorStop(1, '#00f');

    x.globalCompositeOperation = 'difference';
    x.fillStyle = gx; x.fillRect(0, 0, w, h);
    x.fillStyle = gy; x.fillRect(0, 0, w, h);

    var inset = Math.min(w, h) * band;           // 내부를 중립으로 되돌림
    x.globalCompositeOperation = 'source-over';
    x.filter = 'blur(' + mapBlur + 'px)';
    x.fillStyle = 'rgb(128,128,128)';
    roundRect(x, inset, inset, w - inset * 2, h - inset * 2, Math.max(0, radius - inset));
    x.fill();

    return c.toDataURL();
  }

  /* ------------------------------------------------------------------------
     2. 굴절 필터 — DESIGN 부록 D
     같은 맵으로 스케일만 어긋나게 세 번 변위시킨 뒤 R·G·B만 남겨 screen 합성.
     이 편차가 프리즘 프린지를 만든다. 세 스케일 = --lg-scale ± --lg-chroma
     ------------------------------------------------------------------------ */
  function ensureFilterHost() {
    var host = document.getElementById('lg-filters');
    if (!host) {
      host = document.createElementNS(SVG_NS, 'svg');
      host.setAttribute('id', 'lg-filters');
      host.setAttribute('width', '0');
      host.setAttribute('height', '0');
      host.setAttribute('aria-hidden', 'true');
      host.style.position = 'absolute';
      document.body.appendChild(host);
    }
    return host;
  }

  function el(name, attrs) {
    var n = document.createElementNS(SVG_NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function upsertFilter(id, mapURI, scale, chroma) {
    var host = ensureFilterHost();
    var old = document.getElementById(id);
    if (old) old.remove();

    var f = el('filter', {
      id: id,
      'color-interpolation-filters': 'sRGB',
      x: '-20%', y: '-20%', width: '140%', height: '140%'
    });
    f.appendChild(el('feImage', { href: mapURI, result: 'map', preserveAspectRatio: 'none' }));

    var passes = [
      { s: scale + chroma, res: 'R', mat: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0' },
      { s: scale,          res: 'G', mat: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0' },
      { s: scale - chroma, res: 'B', mat: '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0' }
    ];
    passes.forEach(function (p) {
      f.appendChild(el('feDisplacementMap', {
        in: 'SourceGraphic', in2: 'map', scale: p.s,
        xChannelSelector: 'R', yChannelSelector: 'B', result: 'd' + p.res
      }));
      f.appendChild(el('feColorMatrix', {
        in: 'd' + p.res, type: 'matrix', result: 'c' + p.res, values: p.mat
      }));
    });
    f.appendChild(el('feBlend', { in: 'cR', in2: 'cG', mode: 'screen', result: 'rg' }));
    f.appendChild(el('feBlend', { in: 'rg', in2: 'cB', mode: 'screen' }));

    host.appendChild(f);
  }

  /* ------------------------------------------------------------------------
     3. 유리 표면 등록
     티어 A가 아니면 아예 호출하지 않는다 — 쓰지도 않을 캔버스를 그릴 이유가 없다.
     크기가 바뀌면 맵을 다시 만든다. ResizeObserver로만 갱신하고 rAF 루프는 돌리지 않는다.
     ------------------------------------------------------------------------ */
  var seq = 0;
  var observed = new WeakMap();

  function refreshSurface(node) {
    var rec = observed.get(node);
    if (!rec) return;
    var r = node.getBoundingClientRect();
    var w = Math.max(1, Math.round(r.width));
    var h = Math.max(1, Math.round(r.height));
    if (w < 8 || h < 8) return;
    if (rec.w === w && rec.h === h) return;
    rec.w = w; rec.h = h;

    var cs = getComputedStyle(node);
    var radius = parseFloat(cs.borderTopLeftRadius) || 28;
    // radius 22px 미만에 굴절을 걸지 않는다 (§13)
    if (radius < 22) { node.style.removeProperty('--lg-refract-fn'); return; }

    var band = num('--lg-band', 0.07);
    var mapBlur = num('--lg-map-blur', 12);
    var scale = parseFloat(cs.getPropertyValue('--lg-scale')) || num('--lg-scale', 14);
    var chroma = num('--lg-chroma', 5);

    var uri;
    try {
      uri = buildMap(w, h, radius, band, mapBlur);
    } catch (e) {
      return;   // 캔버스가 막힌 환경 — 티어 B로 남는다
    }
    upsertFilter(rec.id, uri, scale, chroma);
    node.style.setProperty('--lg-refract-fn', 'url(#' + rec.id + ')');
  }

  var ro = null;
  function registerSurface(node) {
    if (!node || observed.has(node)) return;
    observed.set(node, { id: 'lg-refract-' + (++seq), w: 0, h: 0 });
    if (!ro && global.ResizeObserver) {
      ro = new ResizeObserver(function (entries) {
        entries.forEach(function (e) { refreshSurface(e.target); });
      });
    }
    if (ro) ro.observe(node);
    refreshSurface(node);
  }

  var registered = [];

  function initRefraction(selector) {
    if (!root.classList.contains('lg-refract')) return;
    if (root.classList.contains('lg-lowend')) return;
    document.querySelectorAll(selector || '[data-lg-refract]').forEach(function (node) {
      registerSurface(node);
      if (registered.indexOf(node) < 0) registered.push(node);
    });
  }

  /* 테마가 바뀌면 --lg-scale·--lg-chroma·--lg-map-blur가 달라진다(라이트는 굴절이 더 강하다).
     refreshSurface()는 크기가 같으면 조기 반환하므로 강제로 무효화해야 한다.
     이게 없으면 테마를 바꿔도 필터가 이전 값으로 남는다. */
  function refreshAllSurfaces() {
    registered.forEach(function (node) {
      var rec = observed.get(node);
      if (rec) { rec.w = 0; rec.h = 0; }
      refreshSurface(node);
    });
  }

  global.addEventListener('lg:themechange', refreshAllSurfaces);
  if (global.matchMedia) {
    global.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', refreshAllSurfaces);
  }

  /* ------------------------------------------------------------------------
     4. 팝오버 — §9.5
     액션시트는 화면 하단이 아니라 그 동작을 시작한 요소로부터 나온다.
     모달 스크림을 깔지 않는다 — 뒤쪽이 계속 조작 가능해야 한다.
     ------------------------------------------------------------------------ */
  var openPopovers = [];

  function place(panel, trigger) {
    var t = trigger.getBoundingClientRect();
    panel.hidden = false;
    panel.style.visibility = 'hidden';
    var p = panel.getBoundingClientRect();
    var gap = 8;
    var margin = 8;

    var left = t.left;
    if (left + p.width > global.innerWidth - margin) left = global.innerWidth - margin - p.width;
    if (left < margin) left = margin;

    var top = t.bottom + gap;
    if (top + p.height > global.innerHeight - margin) {
      var above = t.top - gap - p.height;
      top = above >= margin ? above : Math.max(margin, global.innerHeight - margin - p.height);
    }

    panel.style.left = Math.round(left) + 'px';
    panel.style.top = Math.round(top) + 'px';
    panel.style.minWidth = Math.round(Math.min(t.width, global.innerWidth - margin * 2)) + 'px';
    panel.style.visibility = '';
  }

  function closePopover(entry) {
    var i = openPopovers.indexOf(entry);
    if (i >= 0) openPopovers.splice(i, 1);
    entry.panel.hidden = true;
    entry.trigger.setAttribute('aria-expanded', 'false');
    if (!openPopovers.length) document.body.removeAttribute('data-popover-open');
    if (entry.onClose) entry.onClose();
  }

  function closeAll() {
    openPopovers.slice().forEach(closePopover);
  }

  function openPopover(trigger, panel, opts) {
    opts = opts || {};
    closeAll();
    var entry = { trigger: trigger, panel: panel, onClose: opts.onClose };
    openPopovers.push(entry);
    // 굴절 표면 예산 유지 — 팝오버가 열린 동안 칩 바를 콘텐츠 레이어로 강등 (§8.4)
    document.body.setAttribute('data-popover-open', '1');
    place(panel, trigger);
    trigger.setAttribute('aria-expanded', 'true');
    if (opts.focus !== false) {
      var first = panel.querySelector('[aria-selected="true"]') || panel.querySelector('button, [tabindex]');
      if (first && first.focus) first.focus();
    }
    return entry;
  }

  function isOpen(panel) {
    return openPopovers.some(function (e) { return e.panel === panel; });
  }

  function togglePopover(trigger, panel, opts) {
    if (isOpen(panel)) { closeAll(); return false; }
    openPopover(trigger, panel, opts);
    return true;
  }

  // 바깥 클릭 시 닫기만 JS로 처리한다. 배경 클릭 차단용 오버레이를 깔지 않는다 (§9.5)
  document.addEventListener('pointerdown', function (e) {
    if (!openPopovers.length) return;
    var hit = openPopovers.some(function (entry) {
      return entry.panel.contains(e.target) || entry.trigger.contains(e.target);
    });
    if (!hit) closeAll();
  }, true);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && openPopovers.length) {
      var last = openPopovers[openPopovers.length - 1];
      var trigger = last.trigger;
      closeAll();
      if (trigger && trigger.focus) trigger.focus();
    }
  });

  global.addEventListener('resize', function () {
    openPopovers.forEach(function (e) { place(e.panel, e.trigger); });
  });
  global.addEventListener('scroll', function () {
    openPopovers.forEach(function (e) { place(e.panel, e.trigger); });
  }, true);

  /* ------------------------------------------------------------------------
     5. 설정 — §12.2
     prefers-reduced-transparency는 Safari 전 버전 미지원.
     수동 토글은 선택이 아니라 필수다. iOS에서는 이게 유일한 접근성 경로다.
     ------------------------------------------------------------------------ */
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  var settings = {
    theme: function (v) {                        // 'auto' | 'light' | 'dark'
      if (v === undefined) return store.get('theme') || 'auto';
      if (v === 'auto') { root.removeAttribute('data-theme'); store.del('theme'); }
      else { root.setAttribute('data-theme', v); store.set('theme', v); }
      global.dispatchEvent(new CustomEvent('lg:themechange'));
    },
    transparency: function (v) {                 // true = 효과 유지, false = 줄이기
      if (v === undefined) return store.get('transparency') !== 'off';
      if (v) { root.removeAttribute('data-transparency'); store.del('transparency'); }
      else { root.setAttribute('data-transparency', 'off'); store.set('transparency', 'off'); }
      global.dispatchEvent(new CustomEvent('lg:themechange'));
    },
    motion: function (v) {                       // true = 모션 유지, false = 줄이기
      if (v === undefined) return store.get('motion') !== 'off';
      if (v) { root.removeAttribute('data-motion'); store.del('motion'); }
      else { root.setAttribute('data-motion', 'off'); store.set('motion', 'off'); }
    },
    /* 유리 투명도 0.25 ~ 1.6. 틴트 알파와 블러가 함께 움직인다.
       접근성 분기(§12.2)를 이기지 못한다 — 불투명 모드에서는 CSS가 이 값을 무시한다 */
    glassLevel: function (v) {
      if (v === undefined) {
        var saved = parseFloat(store.get('glassLevel'));
        return isFinite(saved) ? saved : 1;
      }
      var level = Math.min(1.6, Math.max(0.25, Number(v) || 1));
      root.style.setProperty('--glass-level', String(level));
      if (level === 1) store.del('glassLevel');
      else store.set('glassLevel', String(level));
      return level;
    },
    /* CSS가 계산한 최종 상태. 미디어 쿼리 결과까지 반영된다 */
    solidMode: function () {
      return getComputedStyle(root).getPropertyValue('--lg-solid-mode').trim() === '1';
    }
  };

  // 저장값 복원 (부록 E가 못 다룬 motion 포함)
  if (store.get('motion') === 'off') root.setAttribute('data-motion', 'off');

  global.LG = {
    buildMap: buildMap,
    initRefraction: initRefraction,
    registerSurface: registerSurface,
    refreshAllSurfaces: refreshAllSurfaces,
    openPopover: openPopover,
    togglePopover: togglePopover,
    closePopover: closeAll,
    isPopoverOpen: isOpen,
    settings: settings
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
