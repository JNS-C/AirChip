/* ==========================================================================
   make-icons.mjs — 확장 아이콘 PNG 생성 (의존성 없음)
   Node 내장 zlib으로 PNG를 직접 인코딩한다.
   모티프: DESIGN §5.1 씬 액센트 위에 유리 판 한 장 + 상단 스페큘러 림.
   실행: node scripts/make-icons.mjs
   ========================================================================== */
import { deflateSync } from 'node:zlib';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEST = join(ROOT, 'extension');

/* ── PNG 인코더 ─────────────────────────────────────────────────────────── */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;    // bit depth
  ihdr[9] = 6;    // color type: RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // 각 행 앞에 필터 바이트 0
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ── 그리기 ─────────────────────────────────────────────────────────────── */
const lerp = (a, b, t) => a + (b - a) * t;

/* 둥근 사각형 안쪽까지의 거리 (양수 = 안쪽). 안티에일리어싱에 쓴다 */
function roundRectCoverage(x, y, w, h, r, inset) {
  const left = inset, top = inset, right = w - inset, bottom = h - inset;
  const rr = Math.max(0, r - inset);
  const cx = Math.min(Math.max(x, left + rr), right - rr);
  const cy = Math.min(Math.max(y, top + rr), bottom - rr);
  const dist = Math.hypot(x - cx, y - cy);
  return rr - dist;   // >0 이면 안쪽
}

function smooth(edge) {
  return Math.min(1, Math.max(0, edge + 0.5));   // 1px 폭 AA
}

function draw(size) {
  const buf = Buffer.alloc(size * size * 4);
  const r = size * 0.24;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5, py = y + 0.5;
      const i = (y * size + x) * 4;

      const inside = smooth(roundRectCoverage(px, py, size, size, r, 0.5));
      if (inside <= 0) continue;

      /* 씬 그라디언트 — scene-accent-a(#7FB2FF) → accent(#0A63E8) */
      const t = py / size;
      let cr = lerp(0x7f, 0x0a, t);
      let cg = lerp(0xb2, 0x63, t);
      let cb = lerp(0xff, 0xe8, t);

      /* 유리 판 — 가운데 가로 밴드. 살짝 밝고 채도가 낮다 */
      const bandTop = size * 0.34, bandBottom = size * 0.70;
      const bandLeft = size * 0.16, bandRight = size * 0.84;
      const inBand = px > bandLeft && px < bandRight && py > bandTop && py < bandBottom;
      if (inBand) {
        const k = 0.30;
        cr = lerp(cr, 255, k); cg = lerp(cg, 255, k); cb = lerp(cb, 255, k);
        /* 상단 스페큘러 림 — 위가 아래보다 밝다 (DESIGN §5.3) */
        if (py < bandTop + Math.max(1, size * 0.035)) {
          cr = lerp(cr, 255, .55); cg = lerp(cg, 255, .55); cb = lerp(cb, 255, .55);
        }
      }

      /* 상단 광택 — 광원은 항상 위 */
      const gloss = Math.max(0, 1 - py / (size * 0.45)) * 0.22;
      cr = lerp(cr, 255, gloss); cg = lerp(cg, 255, gloss); cb = lerp(cb, 255, gloss);

      buf[i] = Math.round(cr);
      buf[i + 1] = Math.round(cg);
      buf[i + 2] = Math.round(cb);
      buf[i + 3] = Math.round(255 * inside);
    }
  }
  return buf;
}

await mkdir(DEST, { recursive: true });
for (const size of [48, 128]) {
  const png = encodePng(size, size, draw(size));
  const file = join(DEST, `icon${size}.png`);
  await writeFile(file, png);
  console.log(`  extension/icon${size}.png (${png.length}바이트)`);
}
console.log('\n  아이콘 생성 완료.');
