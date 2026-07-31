#!/usr/bin/env node

import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT_PACKAGE_PATH = path.join(ROOT_DIR, 'package.json');
const MOBILE_PACKAGE_PATH = path.join(ROOT_DIR, 'apps/mobile/package.json');
const APP_CONFIG_PATH = path.join(ROOT_DIR, 'apps/mobile/app.json');
const MANIFEST_PATH = path.join(ROOT_DIR, 'release/latest.json');

await main().catch((cause) => {
  console.error(`发布准备失败：${cause instanceof Error ? cause.message : String(cause)}`);
  process.exitCode = 1;
});

async function main() {
  if (process.argv.includes('--ci')) {
    await prepareForCi();
    return;
  }
  await prepareInteractiveRelease();
}

async function prepareInteractiveRelease() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('交互式发布需要在终端中运行');
  ensureCleanWorktree();
  ensureReleaseBranch();

  const appConfig = await readJson(APP_CONFIG_PATH);
  const currentVersion = validateVersion(appConfig.expo.version);
  const currentBuildCode = validateBuildCode(appConfig.expo.android.versionCode);
  const defaultVersion = incrementPatch(currentVersion);
  const terminal = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const versionInput = (await terminal.question(`版本号 [${defaultVersion}]：`)).trim();
    const version = validateVersion(versionInput || defaultVersion);
    assertVersionGreater(version, currentVersion);
    ensureTagDoesNotExist(`v${version}`);

    const releaseNotes = (await terminal.question('更新详情（可留空）：')).trim();
    const buildCode = currentBuildCode + 1;
    const summary = [
      `版本：${currentVersion} -> ${version}`,
      `构建号：${currentBuildCode} -> ${buildCode}`,
      `更新详情：${releaseNotes || '无'}`,
      `提交：feat: v${version}`,
    ].join('\n');
    console.log(`\n${summary}\n`);

    const confirmed = (await terminal.question('确认创建发布提交？[y/N]：')).trim().toLowerCase();
    if (confirmed !== 'y' && confirmed !== 'yes') {
      console.log('已取消，未修改文件。');
      return;
    }

    const rootPackage = await readJson(ROOT_PACKAGE_PATH);
    const mobilePackage = await readJson(MOBILE_PACKAGE_PATH);
    const repository = resolveGitHubRepository();

    rootPackage.version = version;
    mobilePackage.version = version;
    appConfig.expo.version = version;
    appConfig.expo.android.versionCode = buildCode;
    appConfig.expo.ios.buildNumber = String(buildCode);

    await Promise.all([
      writeJson(ROOT_PACKAGE_PATH, rootPackage),
      writeJson(MOBILE_PACKAGE_PATH, mobilePackage),
      writeJson(APP_CONFIG_PATH, appConfig),
      writeManifest({ buildCode, releaseNotes, repository, version }),
    ]);

    runGit(['add', 'package.json', 'apps/mobile/package.json', 'apps/mobile/app.json', 'release/latest.json']);
    runGit(['commit', '-m', `feat: v${version}`]);
    console.log(`\n发布提交已创建。推送后将触发 CI：git push origin ${currentBranch()}`);
  } finally {
    terminal.close();
  }
}

async function prepareForCi() {
  const appConfig = await readJson(APP_CONFIG_PATH);
  const configuredVersion = validateVersion(appConfig.expo.version);
  const requestedVersion = resolveCiVersion(configuredVersion);
  if (requestedVersion !== configuredVersion) {
    throw new Error(`发布版本 ${requestedVersion} 与 app.json 的 ${configuredVersion} 不一致`);
  }

  const buildCode = validateBuildCode(appConfig.expo.android.versionCode);
  const existingManifest = await readExistingManifest();
  const releaseNotes = process.env.RELEASE_NOTES?.trim()
    || (existingManifest?.versionName === requestedVersion ? existingManifest.releaseNotes?.trim() : '')
    || '';
  const repository = process.env.GITHUB_REPOSITORY?.trim() || resolveGitHubRepository();
  await writeManifest({ buildCode, releaseNotes, repository, version: requestedVersion });

  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, [
      `version=${requestedVersion}`,
      `tag=v${requestedVersion}`,
      `apk_name=still-alive-pro-v${requestedVersion}.apk`,
      '',
    ].join('\n'));
  }
  console.log(`已准备 v${requestedVersion}（build ${buildCode}）的 latest.json`);
}

function resolveCiVersion(configuredVersion) {
  const explicitVersion = process.env.RELEASE_VERSION?.trim();
  if (explicitVersion) return validateVersion(explicitVersion);
  if (process.env.GITHUB_EVENT_NAME !== 'push') return configuredVersion;

  const subject = gitOutput(['log', '-1', '--pretty=%s']);
  const match = /^feat: v(\d+\.\d+\.\d+)$/.exec(subject);
  if (!match) throw new Error('Push 发布提交标题必须严格匹配 feat: vX.Y.Z');
  return validateVersion(match[1]);
}

async function writeManifest({ buildCode, releaseNotes, repository, version }) {
  const apkName = `still-alive-pro-v${version}.apk`;
  const manifest = {
    versionCode: buildCode,
    versionName: version,
    apkUrl: `https://github.com/${repository}/releases/latest/download/${apkName}`,
  };
  if (releaseNotes) manifest.releaseNotes = releaseNotes;
  await writeJson(MANIFEST_PATH, manifest);
}

async function readExistingManifest() {
  try {
    return await readJson(MANIFEST_PATH);
  } catch (cause) {
    if (cause && typeof cause === 'object' && cause.code === 'ENOENT') return null;
    throw cause;
  }
}

function ensureCleanWorktree() {
  if (gitOutput(['status', '--porcelain'])) throw new Error('工作树存在未提交修改，请先提交或暂存后再发布');
}

function ensureReleaseBranch() {
  const branch = currentBranch();
  if (branch !== 'master') throw new Error(`发布提交只能在 master 分支创建，当前分支为 ${branch || 'detached HEAD'}`);
}

function ensureTagDoesNotExist(tag) {
  const result = spawnSync('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`], { cwd: ROOT_DIR, stdio: 'ignore' });
  if (result.status === 0) throw new Error(`本地标签 ${tag} 已存在`);
  if (result.status !== 1) throw new Error(`无法检查本地标签 ${tag}`);
}

function resolveGitHubRepository() {
  const remote = gitOutput(['remote', 'get-url', 'origin']);
  const match = /github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/.exec(remote);
  if (!match) throw new Error('origin 不是可识别的 GitHub 仓库地址');
  return match[1];
}

function currentBranch() {
  return gitOutput(['branch', '--show-current']);
}

function runGit(args) {
  const result = spawnSync('git', args, { cwd: ROOT_DIR, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`git ${args[0]} 执行失败`);
}

function gitOutput(args) {
  return execFileSync('git', args, { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
}

function validateVersion(value) {
  const version = String(value).trim().replace(/^v/, '');
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`版本号无效：${value}`);
  return version;
}

function validateBuildCode(value) {
  if (!Number.isInteger(value) || value < 1) throw new Error(`Android versionCode 无效：${value}`);
  return value;
}

function incrementPatch(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

function assertVersionGreater(next, current) {
  const left = next.split('.').map(Number);
  const right = current.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] > right[index]) return;
    if (left[index] < right[index]) break;
  }
  throw new Error(`新版本 ${next} 必须高于当前版本 ${current}`);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
