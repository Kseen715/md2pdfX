// Сборка бандлов. esbuild склеивает код с зависимостями в один CommonJS-файл,
// стили и mermaid.js кладутся рядом готовыми ассетами.
//
//   node scripts/build.js extension   →  dist/extension.cjs + dist/assets/
//   node scripts/build.js exe         →  dist/md2pdf (dist/md2pdf.exe на Windows),
//                                        один файл Node.js SEA; нужен Node 25.5+
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
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
};

if (!targets[target]) {
  console.error(`Использование: node scripts/build.js <${Object.keys(targets).join(' | ')}>`);
  process.exit(1);
}
fs.mkdirSync(dist, { recursive: true });
await targets[target]();

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
function writeAssets() {
  const dir = path.join(dist, 'assets');
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
