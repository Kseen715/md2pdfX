// Поиск Chrome для печати. Браузер в исполняемый файл не вшить, поэтому по
// порядку: явно указанный путь → кэш puppeteer → установленный в системе →
// скачать chrome-headless-shell в кэш puppeteer (один раз, ~100 МБ).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  Browser, ChromeReleaseChannel, computeSystemExecutablePath, detectBrowserPlatform,
  getInstalledBrowsers, getVersionComparator, install, resolveBuildId,
} from '@puppeteer/browsers';

const cacheDir = process.env.PUPPETEER_CACHE_DIR || path.join(os.homedir(), '.cache', 'puppeteer');

const SYSTEM_PATHS = [
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

// → { executablePath, headless } для puppeteer.launch. log и onProgress —
// куда сообщать о скачивании (по умолчанию в консоль, с полосой прогресса).
export async function findBrowser(explicit, { log = console.error, onProgress = 'default' } = {}) {
  if (explicit) return launchOptions(explicit);

  const platform = detectBrowserPlatform();
  const installed = (await getInstalledBrowsers({ cacheDir })).filter(b => b.platform === platform);
  for (const browser of [Browser.CHROMEHEADLESSSHELL, Browser.CHROME]) {
    const newest = installed.filter(b => b.browser === browser)
      .sort((a, b) => getVersionComparator(browser)(b.buildId, a.buildId))[0];
    if (newest && fs.existsSync(newest.executablePath)) return launchOptions(newest.executablePath);
  }

  const system = [systemChrome(), ...SYSTEM_PATHS].find(p => p && fs.existsSync(p));
  if (system) return launchOptions(system);

  if (!platform) throw new Error('Не найден Chrome: укажите путь к нему явно');
  const browser = Browser.CHROMEHEADLESSSHELL;
  const buildId = await resolveBuildId(browser, platform, 'stable');
  log(`Chrome не найден, скачиваю ${browser} ${buildId} в ${cacheDir}`);
  const done = await install({ browser, buildId, platform, cacheDir, downloadProgressCallback: onProgress });
  return launchOptions(done.executablePath);
}

function systemChrome() {
  try {
    return computeSystemExecutablePath({ browser: Browser.CHROME, channel: ChromeReleaseChannel.STABLE });
  } catch {
    return undefined;  // платформа без стандартного пути
  }
}

function launchOptions(executablePath) {
  const shell = path.basename(executablePath).startsWith('chrome-headless-shell');
  return { executablePath, headless: shell ? 'shell' : true };
}
