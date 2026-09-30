// Поиск Chrome для печати. Браузер в исполняемый файл не вшить, поэтому по
// порядку: явно указанный путь → кэш puppeteer → установленный в системе →
// скачать chrome-headless-shell в кэш puppeteer (один раз, ~100 МБ).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  Browser, ChromeReleaseChannel, computeSystemExecutablePath,
  detectBrowserPlatform, getInstalledBrowsers, getVersionComparator,
  install, resolveBuildId,
} from '@puppeteer/browsers';

const cacheDir = process.env.PUPPETEER_CACHE_DIR
  || path.join(os.homedir(), '.cache', 'puppeteer');

// Из snap-пакета (VS Code из Snap Store и его терминал) snap-Chromium не
// запускается: snap-confine отказывает унаследованному профилю AppArmor.
const insideSnap = Boolean(process.env.SNAP);
// Из flatpak системный Chrome виден (/opt открыт), но библиотеки ему достались
// бы от среды flatpak, а не от системы — надёжнее скачать свой.
const insideFlatpak = Boolean(process.env.FLATPAK_ID);

const SYSTEM_PATHS = [
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

// → { executablePath, headless } для puppeteer.launch. log и onProgress —
// куда сообщать о скачивании (по умолчанию в консоль, с полосой прогресса).
export async function findBrowser(
  explicit, { log = console.error, onProgress = 'default' } = {},
) {
  const platform = detectBrowserPlatform();
  const found = explicit || await cachedChrome(platform)
    || !insideFlatpak && [systemChrome(), ...SYSTEM_PATHS].find(p =>
      p && fs.existsSync(p) && !(insideSnap && isSnap(p)));
  if (found) return launchOptions(found);

  if (!platform) throw new Error('Не найден Chrome: укажите путь к нему явно');
  const browser = Browser.CHROMEHEADLESSSHELL;
  const buildId = await resolveBuildId(browser, platform, 'stable');
  log(`Chrome не найден, скачиваю ${browser} ${buildId} в ${cacheDir}`);
  const done = await install({
    browser, buildId, platform, cacheDir,
    downloadProgressCallback: onProgress,
  });
  return launchOptions(done.executablePath);
}

// Самый новый из скачанных puppeteer; headless shell — легче, он первый.
async function cachedChrome(platform) {
  const installed = (await getInstalledBrowsers({ cacheDir }))
    .filter(b => b.platform === platform);

  for (const browser of [Browser.CHROMEHEADLESSSHELL, Browser.CHROME]) {
    const newer = getVersionComparator(browser);
    const newest = installed.filter(b => b.browser === browser)
      .sort((a, b) => newer(b.buildId, a.buildId))[0];
    if (newest && fs.existsSync(newest.executablePath)) {
      return newest.executablePath;
    }
  }
  return undefined;
}

function systemChrome() {
  try {
    return computeSystemExecutablePath({
      browser: Browser.CHROME, channel: ChromeReleaseChannel.STABLE,
    });
  } catch {
    return undefined;  // платформа без стандартного пути
  }
}

// Snap — и обёртка-скрипт, что его запускает: /usr/bin/chromium-browser в
// Ubuntu — переходный пакет, внутри exec /snap/bin/chromium.
function isSnap(file) {
  // Команды snap — ссылки на /usr/bin/snap.
  if (path.basename(fs.realpathSync(file)) === 'snap') return true;
  const head = Buffer.alloc(4096);
  const fd = fs.openSync(file, 'r');
  const size = fs.readSync(fd, head, 0, head.length, 0);
  fs.closeSync(fd);
  const text = head.toString('latin1', 0, size);
  return text.startsWith('#!') && text.includes('/snap/');
}

function launchOptions(executablePath) {
  const shell = path.basename(executablePath)
    .startsWith('chrome-headless-shell');
  return { executablePath, headless: shell ? 'shell' : true };
}
