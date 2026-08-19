/* ==========================================================================
   dev-server.mjs — 무의존 로컬 개발 서버
   정적 파일 + api/*.js 서버리스 함수를 Vercel과 같은 경로로 서빙한다.
   실행:  node dev-server.mjs          (기본 포트 3000)
          node dev-server.mjs 5173     (포트 지정)
   ========================================================================== */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2] || process.env.PORT || 3000);

/* --------------------------------------------------------------------------
   .env.local 로드 — 의존성 없이 직접 파싱한다
   -------------------------------------------------------------------------- */
function loadEnv(file) {
  const path = join(ROOT, file);
  if (!existsSync(path)) return 0;
  let count = 0;
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) { process.env[key] = value; count++; }
  }
  return count;
}
loadEnv('.env.local');
loadEnv('.env');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return undefined;
  const text = Buffer.concat(chunks).toString('utf8');
  try { return JSON.parse(text); } catch { return text; }
}

async function serveStatic(res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/' || rel.endsWith('/')) rel += 'index.html';

  // 디렉터리 탈출 방지
  const target = normalize(join(ROOT, rel));
  if (!target.startsWith(ROOT + sep) && target !== ROOT) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  // 비밀은 절대 서빙하지 않는다
  if (/(^|[\\/])\.env/.test(rel)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const info = await stat(target);
    if (info.isDirectory()) throw new Error('dir');
    const data = await readFile(target);
    res.writeHead(200, {
      'Content-Type': MIME[extname(target).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found: ' + rel);
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname.startsWith('/api/')) {
    const name = url.pathname.slice(5).replace(/\.js$/, '');
    if (!/^[a-z0-9_-]+$/i.test(name)) {
      res.writeHead(400).end('Bad request');
      return;
    }
    const modPath = join(ROOT, 'api', name + '.js');
    if (!existsSync(modPath)) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'NOT_FOUND', message: `/api/${name} 없음` }));
      return;
    }

    try {
      // 매 요청마다 새로 읽어 코드 수정이 바로 반영되게 한다
      const mod = await import(pathToFileURL(modPath).href + '?t=' + Date.now());
      req.query = Object.fromEntries(url.searchParams.entries());
      if (req.method === 'POST' || req.method === 'PUT') req.body = await readBody(req);

      // Vercel 응답 헬퍼 호환
      res.status = (code) => { res.statusCode = code; return res; };
      res.json = (obj) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(obj));
        return res;
      };

      await mod.default(req, res);
      if (!res.writableEnded) res.end();
    } catch (err) {
      console.error(`[api/${name}]`, err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      }
      res.end(JSON.stringify({ error: 'HANDLER_CRASH', message: String(err?.message || err) }));
    }
    return;
  }

  await serveStatic(res, url);
});

server.listen(PORT, () => {
  const key = process.env.AIRKOREA_SERVICE_KEY;
  const gem = process.env.GEMINI_API_KEY;
  console.log(`\n  오늘의 대기질 — http://localhost:${PORT}\n`);
  console.log(`  AIRKOREA_SERVICE_KEY  ${key ? '설정됨 (' + key.length + '자)' : '없음 → .env.local을 채우세요'}`);
  console.log(`  GEMINI_API_KEY        ${gem ? '설정됨' : '없음 → 조언은 정적 폴백으로 동작합니다'}\n`);
});
