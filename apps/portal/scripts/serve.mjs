import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const portalDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(portalDir, 'dist');
const port = Number(process.env.PORT || 4173);
const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
]);

const build = spawnSync(process.execPath, ['./scripts/build.mjs'], { cwd: portalDir, stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status || 1);

createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
  const requestedPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.resolve(outputDir, requestedPath);

  if (!filePath.startsWith(`${outputDir}${path.sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error('Not a file');
    response.writeHead(200, { 'Content-Type': mimeTypes.get(path.extname(filePath)) || 'application/octet-stream' });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`门户预览：http://127.0.0.1:${port}`);
});
