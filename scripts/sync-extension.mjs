/* ==========================================================================
   sync-extension.mjs — 공용 자산을 extension/으로 복사
   웹과 확장이 같은 파일을 쓰되, 확장은 패키지 안에 사본이 있어야 한다(MV3).
   수기 중복은 드리프트를 만든다. 복사는 이 스크립트만 한다.
   실행: node scripts/sync-extension.mjs
   ========================================================================== */
import { copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'assets');
const DEST = join(ROOT, 'extension');

const FILES = [
  'liquid-glass.css',
  'app.css',
  'bootstrap.js',
  'grade.js',
  'transform.js',
  'lg-runtime.js',
  'app.js'
];

await mkdir(DEST, { recursive: true });

let copied = 0;
for (const name of FILES) {
  const from = join(SRC, name);
  if (!existsSync(from)) {
    console.error(`  없음: assets/${name}`);
    process.exitCode = 1;
    continue;
  }
  await copyFile(from, join(DEST, name));
  console.log(`  assets/${name} → extension/${name}`);
  copied++;
}

console.log(`\n  ${copied}개 파일 동기화 완료.`);
if (!existsSync(join(DEST, 'icon48.png'))) {
  console.log('  아이콘이 없습니다. node scripts/make-icons.mjs 를 먼저 실행하세요.');
}
