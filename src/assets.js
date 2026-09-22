// Стили и скрипты, которые встраиваются в печатаемую страницу. Откуда они
// берутся:
//   - исполняемый файл — ассеты SEA;
//   - расширение VS Code — каталог assets/ рядом с бандлом;
//   - исходники — src/ и node_modules.
// Готовые ассеты для первых двух случаев собирает scripts/build.js.
import fs from 'node:fs';
import path from 'node:path';
import sea from 'node:sea';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const sources = {
  'style.css': () => fs.readFileSync(fileURLToPath(new URL('./style.css', import.meta.url)), 'utf8'),
  'mermaid.js': () => fs.readFileSync(resolve('mermaid/dist/mermaid.min.js'), 'utf8'),
  'katex.css': () => inlineFonts(resolve('katex/dist/katex.min.css')),
  'highlight.css': () => fs.readFileSync(resolve('highlight.js/styles/github.min.css'), 'utf8'),
};

export const assetNames = Object.keys(sources);

const cache = new Map();

export function loadAsset(name) {
  if (!cache.has(name)) cache.set(name, readAsset(name));
  return cache.get(name);
}

export function buildAsset(name) {
  return sources[name]();
}

function readAsset(name) {
  if (sea.isSea?.()) return sea.getAsset(name, 'utf8');
  const prebuilt = fileURLToPath(new URL(`./assets/${name}`, import.meta.url));
  return fs.existsSync(prebuilt) ? fs.readFileSync(prebuilt, 'utf8') : buildAsset(name);
}

function resolve(id) {
  return createRequire(import.meta.url).resolve(id);
}

// Шрифты KaTeX лежат отдельными файлами рядом с CSS. Страница печатается из
// временного каталога, поэтому они вшиваются в CSS; Chrome хватает woff2.
function inlineFonts(cssPath) {
  const dir = path.dirname(cssPath);
  return fs.readFileSync(cssPath, 'utf8').replace(/src:([^;}]+)/g, (decl, list) => {
    const woff2 = /url\(([^)]+?\.woff2)\)/.exec(list);
    if (!woff2) return decl;
    const data = fs.readFileSync(path.join(dir, woff2[1])).toString('base64');
    return `src:url(data:font/woff2;base64,${data}) format("woff2")`;
  });
}
