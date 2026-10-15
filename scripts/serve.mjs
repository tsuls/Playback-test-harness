// Tiny static file server for the test page. Playwright's `webServer` config
// starts this before the tests and stops it afterwards.
//
// It is plain JavaScript (not TypeScript) so Node can run it directly with no
// build step, and it uses only Node built-ins so it adds no dependencies.
//
//   /                 -> site/index.html
//   /shaka/<file>     -> node_modules/shaka-player/dist/<file>

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';

const PORT = Number(process.env.PORT ?? 3000);
const ROOT = resolve(import.meta.dirname, '..');
const MOUNTS = {
  '/shaka/': join(ROOT, 'node_modules/shaka-player/dist'),
  '/': join(ROOT, 'site'),
};
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.map': 'application/json' };

createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  const prefix = Object.keys(MOUNTS).find((p) => pathname.startsWith(p));
  const dir = MOUNTS[prefix];
  const rel = pathname.slice(prefix.length) || 'index.html';
  const file = resolve(dir, rel);

  // Refuse paths like /../package.json that escape the mounted directory.
  if (!file.startsWith(dir + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(PORT, () => console.log(`serving on http://localhost:${PORT}`));
