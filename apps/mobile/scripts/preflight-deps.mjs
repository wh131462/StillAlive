#!/usr/bin/env node
// 启动前校验 workspace 依赖树：缺包（例如误执行过 pnpm install --prod）时自动补齐，
// 避免 Metro 在依赖不完整的状态下启动并抛出 "Unable to resolve"。
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const mobileDir = path.resolve(import.meta.dirname, '..');
const workspaceRoot = path.resolve(mobileDir, '../..');

function workspacePackageDirs() {
  const dirs = [workspaceRoot];
  for (const parent of ['apps', 'packages']) {
    const base = path.join(workspaceRoot, parent);
    if (!existsSync(base)) continue;
    for (const name of readdirSync(base)) {
      const dir = path.join(base, name);
      if (existsSync(path.join(dir, 'package.json'))) dirs.push(dir);
    }
  }
  return dirs;
}

function findMissingDependencies() {
  const missing = [];
  for (const dir of workspacePackageDirs()) {
    const manifest = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const names = [
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.devDependencies ?? {}),
    ];
    for (const name of names) {
      if (!existsSync(path.join(dir, 'node_modules', name))) {
        missing.push(`${path.relative(workspaceRoot, dir) || '.'} → ${name}`);
      }
    }
  }
  return missing;
}

let missing = findMissingDependencies();
if (missing.length === 0) process.exit(0);

console.log(
  `[preflight] 依赖树不完整（${missing.length} 项，例如 ${missing.slice(0, 3).join('、')}），正在修复…`,
);

try {
  execFileSync(
    'pnpm',
    ['install', '--prefer-offline', '--config.confirmModulesPurge=false', '--reporter=append-only'],
    {
      cwd: workspaceRoot,
      // NODE_ENV=production 会让 pnpm 跳过 devDependencies，这里强制按开发环境安装。
      env: { ...process.env, NODE_ENV: 'development' },
      stdio: ['ignore', 'inherit', 'inherit'],
    },
  );
} catch (error) {
  console.error('[preflight] pnpm install 失败，请检查网络后重试。');
  process.exit(error.status ?? 1);
}

missing = findMissingDependencies();
if (missing.length > 0) {
  console.error('[preflight] 安装后依赖仍不完整：');
  for (const item of missing) console.error(`  - ${item}`);
  process.exit(1);
}
console.log('[preflight] 依赖已修复。');
