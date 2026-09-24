// Сборка бандлов. esbuild склеивает код с зависимостями в один CommonJS-файл,
// стили и mermaid.js кладутся рядом готовыми ассетами.
//
//   node scripts/build.js extension   →  dist/extension.cjs + dist/assets/
//   node scripts/build.js exe         →  dist/md2pdf (dist/md2pdf.exe на Windows),
//                                        один файл Node.js SEA; нужен Node 25.5+
//   node scripts/build.js gui         →  dist/gui/md2pdfX-<платформа>-<arch>/,
//                                        окно на Electron для x64 и arm64
//   node scripts/build.js installer   →  из готовых dist/gui/*: на Linux
//                                        md2pdfX-linux-<arch>.run, на Windows
//                                        md2pdfX-windows-<arch>-setup.exe (NSIS)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { packager } from '@electron/packager';
import { build } from 'esbuild';
import { assetNames, buildAsset } from '../src/assets.js';
import { collectFonts } from '../src/fonts.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
const target = process.argv[2];

const targets = {
  async extension() {
    await bundle('src/extension.js', 'extension.cjs', { external: ['vscode'] });
    writeAssets();
  },
  async exe() {
    const main = await bundle('src/cli.js', 'md2pdf.cjs');
    const exe = path.join(dist, process.platform === 'win32' ? 'md2pdf.exe' : 'md2pdf');
    const config = path.join(dist, 'sea-config.json');
    fs.writeFileSync(config, JSON.stringify({
      main, output: exe, assets: writeAssets(),
      disableExperimentalSEAWarning: true,
    }, null, 2));
    execFileSync(process.execPath, ['--build-sea', config], { stdio: 'inherit' });
    // На macOS внедрение ассетов ломает подпись node, а неподписанный
    // бинарник система не запустит. Хватает ad-hoc подписи.
    if (process.platform === 'darwin') {
      execFileSync('codesign', ['--sign', '-', '--force', exe], { stdio: 'inherit' });
    }
    console.log(`${path.relative(root, exe)}: ${(fs.statSync(exe).size / 2 ** 20).toFixed(0)} МБ`);
  },
  // Приложение повторяет раскладку исходников (src/gui, images), так что
  // относительные пути в main.js и index.html верны и там, и тут. Electron
  // под другую архитектуру packager скачивает сам: обе собираются на одной ОС.
  async gui() {
    const stage = path.join(dist, 'gui-app');
    fs.rmSync(stage, { recursive: true, force: true });
    const gui = path.join(stage, 'src/gui');
    await bundle('src/gui/main.js', 'gui-app/src/gui/main.cjs', { external: ['electron'] });
    writeAssets(path.join(gui, 'assets'));
    for (const file of ['preload.cjs', 'index.html', 'app.js', 'app.css']) {
      fs.copyFileSync(path.join(root, 'src/gui', file), path.join(gui, file));
    }
    fs.mkdirSync(path.join(stage, 'images'));
    for (const file of ['icon.svg', 'icon.png']) {
      fs.copyFileSync(path.join(root, 'images', file), path.join(stage, 'images', file));
    }
    const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    fs.writeFileSync(path.join(stage, 'package.json'),
      JSON.stringify({ name: 'md2pdfx', productName: 'md2pdfX', version, main: 'src/gui/main.cjs' }));
    const electron = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/electron/package.json'), 'utf8'));
    const apps = await packager({
      dir: stage, out: path.join(dist, 'gui'), name: 'md2pdfX', appBundleId: 'io.github.kseen715.md2pdfx',
      electronVersion: electron.version, arch: ['x64', 'arm64'], asar: true, overwrite: true, quiet: true,
      // Значок exe; ponytail: macOS — со значком Electron, пока нет icon.icns.
      icon: process.platform === 'win32' ? path.join(root, 'images/icon.ico') : undefined,
    });
    // Как у exe: без подписи macOS приложение не запустит, хватает ad-hoc.
    if (process.platform === 'darwin') {
      for (const dir of apps) {
        execFileSync('codesign', ['--sign', '-', '--force', '--deep', path.join(dir, 'md2pdfX.app')], { stdio: 'inherit' });
      }
    }
    // Команда md2pdf рядом с приложением: без аргументов само приложение
    // открывает окно, а обёртка всегда работает как CLI.
    for (const dir of apps) {
      if (process.platform === 'win32') {
        // cmd ждёт завершения GUI-программы только внутри пакетного файла.
        fs.writeFileSync(path.join(dir, 'md2pdf.cmd'), '@echo off\r\n"%~dp0md2pdfX.exe" %*\r\n');
      } else {
        // Linux: headless — и без дисплея (сервер, CI), и без окна в сеансе.
        const exe = process.platform === 'darwin' ? 'md2pdfX.app/Contents/MacOS/md2pdfX" "$@"'
          : 'md2pdfX" --ozone-platform=headless "$@"';
        fs.writeFileSync(path.join(dir, 'md2pdf'), `#!/bin/sh\nexec "$(dirname "$(readlink -f "$0")")/${exe}\n`, { mode: 0o755 });
      }
      if (process.platform === 'linux') fs.copyFileSync(path.join(root, 'images/icon.png'), path.join(dir, 'md2pdfX.png'));
      console.log(path.relative(root, dir));
    }
  },
  // Установщики из уже собранных приложений (gui).
  installer() {
    const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    for (const arch of ['x64', 'arm64']) {
      const app = path.join(dist, 'gui', `md2pdfX-${process.platform}-${arch}`);
      if (process.platform === 'linux') {
        // Самораспаковывающийся архив: сценарий installer.sh, за ним tar.gz.
        const out = path.join(dist, 'gui', `md2pdfX-linux-${arch}.run`);
        const head = fs.readFileSync(path.join(root, 'scripts/installer.sh'), 'utf8')
          .replaceAll('@VERSION@', version).replaceAll('@ARCH@', arch);
        const payload = execFileSync('tar', ['-cz', '-C', path.dirname(app), path.basename(app)], { maxBuffer: 2 ** 30 });
        fs.writeFileSync(out, Buffer.concat([Buffer.from(head), payload]), { mode: 0o755 });
        console.log(path.relative(root, out));
      } else if (process.platform === 'win32') {
        const out = path.join(dist, 'gui', `md2pdfX-windows-${arch}-setup.exe`);
        execFileSync(makensis(), [`/DVERSION=${version}`, `/DSRC=${app}`, `/DOUT=${out}`,
          path.join(root, 'scripts/installer.nsi')], { stdio: 'inherit' });
        console.log(path.relative(root, out));
      } else {
        throw new Error('Установщики — только для Linux и Windows');
      }
    }
  },
};

if (!targets[target]) {
  console.error(`Использование: node scripts/build.js <${Object.keys(targets).join(' | ')}>`);
  process.exit(1);
}
fs.mkdirSync(dist, { recursive: true });
await targets[target]();

// NSIS из choco в PATH не попадает.
function makensis() {
  const installed = path.join(process.env['ProgramFiles(x86)'] ?? '', 'NSIS/makensis.exe');
  return fs.existsSync(installed) ? installed : 'makensis';
}

async function bundle(entry, outName, { external = [] } = {}) {
  const outfile = path.join(dist, outName);
  await build({
    entryPoints: [path.join(root, entry)],
    outfile,
    bundle: true, platform: 'node', format: 'cjs', target: 'node20', minify: true,
    // В CommonJS нет import.meta.url, а по нему assets.js находит dist/assets/.
    banner: { js: 'const __import_meta_url = require("url").pathToFileURL(__filename).href;' },
    define: { 'import.meta.url': '__import_meta_url' },
    // Необязательные нативные ускорители ws.
    external: ['bufferutil', 'utf-8-validate', ...external],
    legalComments: 'none', logLevel: 'warning',
  });
  return outfile;
}

// → { имя: путь } для конфигурации SEA. Шрифты — в assets/fonts/.
function writeAssets(dir = path.join(dist, 'assets')) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'fonts'), { recursive: true });
  const assets = {};
  for (const name of assetNames) {
    assets[name] = path.join(dir, name);
    fs.writeFileSync(assets[name], buildAsset(name));
  }
  for (const [name, source] of Object.entries(collectFonts().files)) {
    assets[`fonts/${name}`] = path.join(dir, 'fonts', name);
    fs.copyFileSync(source, assets[`fonts/${name}`]);
  }
  // OFL требует распространять шрифты вместе с текстом лицензии.
  for (const license of fs.readdirSync(path.join(root, 'src/fonts')).filter(f => f.endsWith('.txt'))) {
    fs.copyFileSync(path.join(root, 'src/fonts', license), path.join(dir, 'fonts', license));
  }
  fs.copyFileSync(path.join(root, 'node_modules/@fontsource-variable/noto-sans/LICENSE'),
    path.join(dir, 'fonts', 'NotoSans-OFL.txt'));
  return assets;
}
