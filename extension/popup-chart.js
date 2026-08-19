/* ==========================================================================
   popup-chart.js — 확장용 24시간 추이 렌더러
   MV3 CSP는 원격 스크립트를 차단하므로 Chart.js CDN을 쓸 수 없다.
   app.js의 AIRCHIP_CHART 어댑터로 주입되며, 웹은 그대로 Chart.js를 쓴다.

   지키는 규칙은 웹과 동일하다:
   · 오래된 값이 왼쪽 (데이터는 이미 정렬되어 온다)
   · 결측은 선을 끊는다. 0으로 찍지 않는다 (R6)
   · PM2.5는 점선 — 색 단독 구분 금지 (DESIGN §12.1)
   ========================================================================== */
(function (global) {
  'use strict';

  var PAD = { top: 10, right: 8, bottom: 18, left: 30 };

  function niceMax(v) {
    if (!isFinite(v) || v <= 0) return 10;
    var step = v <= 20 ? 5 : v <= 60 ? 10 : v <= 150 ? 25 : 50;
    return Math.ceil(v / step) * step;
  }

  function drawSeries(ctx, values, geo, color, dashed) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash(dashed ? [5, 4] : []);

    var drawing = false;
    ctx.beginPath();
    for (var i = 0; i < values.length; i++) {
      var v = values[i];
      if (v === null || v === undefined) { drawing = false; continue; }   // 선을 끊는다
      var x = geo.x(i);
      var y = geo.y(v);
      if (!drawing) { ctx.moveTo(x, y); drawing = true; }
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function render(canvas, data, o) {
    if (!canvas || !canvas.getContext) return;
    var box = canvas.parentElement;
    var dpr = global.devicePixelRatio || 1;
    var w = Math.max(120, box.clientWidth);
    var h = Math.max(90, box.clientHeight);

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var all = data.pm10.concat(data.pm25).filter(function (v) { return v !== null && v !== undefined; });
    var max = niceMax(Math.max.apply(null, all.length ? all : [10]));
    var n = Math.max(1, data.labels.length - 1);

    var plotW = w - PAD.left - PAD.right;
    var plotH = h - PAD.top - PAD.bottom;
    var geo = {
      x: function (i) { return PAD.left + (plotW * i) / n; },
      y: function (v) { return PAD.top + plotH - (plotH * v) / max; }
    };

    /* 격자 + y축 눈금 */
    ctx.save();
    ctx.strokeStyle = o.gridColor;
    ctx.fillStyle = o.tickColor;
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 1;
    for (var t = 0; t <= 2; t++) {
      var val = (max / 2) * t;
      var y = Math.round(geo.y(val)) + .5;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(w - PAD.right, y);
      ctx.stroke();
      ctx.fillText(String(val), PAD.left - 5, y);
    }
    ctx.restore();

    /* x축 라벨 — 처음·중간·끝만 */
    ctx.save();
    ctx.fillStyle = o.tickColor;
    ctx.font = '10px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    [0, Math.floor(n / 2), n].forEach(function (i, k) {
      var label = data.labels[i];
      if (!label) return;
      ctx.textAlign = k === 0 ? 'left' : k === 2 ? 'right' : 'center';
      ctx.fillText(label, geo.x(i), PAD.top + plotH + 5);
    });
    ctx.restore();

    drawSeries(ctx, data.pm10, geo, o.pm10Color, false);
    drawSeries(ctx, data.pm25, geo, o.pm25Color, true);

    /* 범례 */
    ctx.save();
    ctx.font = '10px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    var lx = PAD.left + 2;
    [['PM10', o.pm10Color, false], ['PM2.5', o.pm25Color, true]].forEach(function (item) {
      ctx.strokeStyle = item[1];
      ctx.lineWidth = 2;
      ctx.setLineDash(item[2] ? [4, 3] : []);
      ctx.beginPath();
      ctx.moveTo(lx, PAD.top - 4);
      ctx.lineTo(lx + 14, PAD.top - 4);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = o.tickColor;
      ctx.fillText(item[0], lx + 18, PAD.top - 4);
      lx += 18 + ctx.measureText(item[0]).width + 12;
    });
    ctx.restore();
  }

  global.AIRCHIP_CHART = { render: render };
})(typeof globalThis !== 'undefined' ? globalThis : this);
