import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const portalDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootDir = path.resolve(portalDir, '../..');
const sourceDir = path.join(portalDir, 'src');
const outputDir = path.join(portalDir, 'dist');
const releasePath = path.join(rootDir, 'release/latest.json');
const base = normalizeBase(process.env.PORTAL_BASE || '/');

const release = JSON.parse(await readFile(releasePath, 'utf8'));
assertRelease(release);

await rm(outputDir, { recursive: true, force: true });
await mkdir(path.join(outputDir, 'assets'), { recursive: true });

const template = await readFile(path.join(sourceDir, 'index.html'), 'utf8');
const html = template
  .replaceAll('__BASE__', escapeHtml(base))
  .replaceAll('__VERSION__', escapeHtml(release.versionName))
  .replaceAll('__APK_URL__', escapeHtml(release.apkUrl))
  .replaceAll('__RELEASE_NOTES__', escapeHtml(release.releaseNotes || '查看 GitHub Release 获取本次更新详情。'));

await Promise.all([
  writeFile(path.join(outputDir, 'index.html'), html),
  cp(path.join(sourceDir, 'styles.css'), path.join(outputDir, 'styles.css')),
  cp(path.join(sourceDir, 'app.js'), path.join(outputDir, 'app.js')),
  cp(path.join(sourceDir, 'favicon.svg'), path.join(outputDir, 'assets/favicon.svg')),
  mkdir(path.join(outputDir, 'release'), { recursive: true }).then(() => cp(releasePath, path.join(outputDir, 'release/latest.json'))),
]);

console.log(`门户已构建：v${release.versionName}，base=${base}`);

function normalizeBase(value) {
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

function assertRelease(value) {
  if (!value || typeof value !== 'object') throw new Error('release/latest.json 内容无效');
  if (typeof value.versionName !== 'string' || !/^\d+\.\d+\.\d+$/.test(value.versionName)) {
    throw new Error('release/latest.json 缺少有效的 versionName');
  }
  if (typeof value.apkUrl !== 'string' || !value.apkUrl.startsWith('https://github.com/')) {
    throw new Error('release/latest.json 缺少有效的 GitHub Release APK 地址');
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
