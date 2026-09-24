// Печать HTML в PDF через headless Chrome: он же рисует диаграммы mermaid.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import { loadAsset, loadFont } from './assets.js';
import { FONT_ORIGIN } from './fonts.js';
import { escapeHtml } from './html.js';
import {
  footerStyle, mermaidConfig, MONO, paletteCss, sankeyColors, SANS, THEMES,
} from './themes/index.js';

export { THEMES };

const MARGIN = { top: '18mm', bottom: '20mm', left: '16mm', right: '16mm' };

// Параметры печати с фиксированным набором значений; первое — по умолчанию.
export const CHOICES = {
  theme: Object.keys(THEMES),
  orientation: ['portrait', 'landscape'],
  // justify — по ширине: край ровный с обеих сторон.
  align: ['justify', 'left', 'center', 'right'],
  // page — каждый раздел (h2) с новой страницы, flow — сплошным текстом.
  sections: ['page', 'flow'],
};

export const DEFAULTS = Object.fromEntries(
  Object.entries(CHOICES).map(([name, values]) => [name, values[0]]));

export function checkChoice(name, value) {
  if (!CHOICES[name].includes(value)) {
    const known = CHOICES[name].join(', ');
    throw new Error(`Неизвестное значение ${name}: «${value}». Есть: ${known}`);
  }
}

export function launchBrowser({ executablePath, headless }) {
  return puppeteer.launch({
    executablePath, headless,
    args: ['--no-sandbox', '--font-render-hinting=none'],
  });
}

// → { diagrams: число отрисованных диаграмм, errors: ошибки JS на странице }.
// theme, orientation, align, sections — из CHOICES; watermark — текст по центру
// колонтитула (пусто — нет). onStep(name) — начало этапа: 'render', 'print'.
export async function printPdf(browser, {
  html, title, output, extraCss = '', watermark = '', onStep = () => {},
  theme = DEFAULTS.theme, orientation = DEFAULTS.orientation,
  align = DEFAULTS.align, sections = DEFAULTS.sections,
}) {
  checkChoice('theme', theme);
  checkChoice('orientation', orientation);
  checkChoice('align', align);
  checkChoice('sections', sections);
  const margin = THEMES[theme].margin ?? MARGIN;
  const sheets = {
    normal: sheet(orientation, margin),
    // Альбомный лист для диаграмм, которым тесно на книжном (см. diagrams.js).
    wide: orientation === 'portrait' ? sheet('landscape', margin) : null,
  };

  const fonts = await serveFonts();
  const fontsUrl = `http://127.0.0.1:${fonts.address().port}/`;
  const fontsCss = loadAsset('fonts.css').replaceAll(FONT_ORIGIN, fontsUrl);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'md2pdf-'));
  const file = path.join(dir, 'doc.html');
  fs.writeFileSync(file,
    page(html, theme, align, sections, sheets, extraCss, fontsCss));

  let tab;
  try {
    tab = await browser.newPage();
    const errors = [];
    tab.on('pageerror', e => errors.push(e.message));
    onStep('render');
    const diagrams = await render(tab, file);

    onStep('print');
    await tab.pdf({
      // Размер листа — из @page: у диаграмм бывает свой, альбомный.
      path: output, preferCSSPageSize: true,
      printBackground: true, margin,
      // Закладки PDF из h1–h6: оглавление в просмотрщике, переходы по разделам.
      outline: true, tagged: true,
      displayHeaderFooter: true,
      ...pageMarks(theme, margin, title, watermark),
    });
    return { diagrams, errors };
  } finally {
    await tab?.close();
    fonts.closeAllConnections();
    fonts.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Рабочая область листа A4, мм: поля везде в мм.
function sheet(orientation, margin) {
  const [width, height] =
    orientation === 'landscape' ? [297, 210] : [210, 297];
  return {
    orientation,
    width: width - parseFloat(margin.left) - parseFloat(margin.right),
    height: height - parseFloat(margin.top) - parseFloat(margin.bottom),
  };
}

// → число отрисованных диаграмм.
async function render(tab, file) {
  await tab.goto(pathToFileURL(file).href, { waitUntil: 'load' });
  const result = await tab.evaluate(() => window.__ready);
  if (result !== true) throw new Error('mermaid: ' + result);

  return tab.evaluate(async () => {
    await document.fonts.ready;
    // Разрезанная на части диаграмма — одна.
    return document.querySelectorAll('.mermaid:has(svg)').length;
  });
}

// Шрифты (fonts.js) отдаёт локальный HTTP-сервер из памяти. Файлы по file://
// Chrome прочесть может не суметь: snap-Chromium не видит скрытых каталогов
// вроде ~/.vscode, а в исполняемом файле шрифты вообще не на диске. Перехват
// запросов puppeteer справлялся, но его включение стоит ~2.5 с на запуск
// Chrome.
async function serveFonts() {
  const server = http.createServer((request, response) => {
    const font = loadFont(request.url.slice(1));
    response.writeHead(font ? 200 : 404, {
      'Content-Type': 'font/woff2',
      // Страница открыта с file://, для неё сервер — сторонний адрес.
      'Access-Control-Allow-Origin': '*',
    });
    response.end(font ?? undefined);
  });

  await new Promise((resolve, reject) =>
    server.once('error', reject).listen(0, '127.0.0.1', resolve));
  return server;
}

// Водяной знак — в нижнем колонтитуле, а у тем с watermarkTop — в верхнем.
function pageMarks(theme, margin, title, watermark) {
  const style = footerStyle(theme);
  const top = THEMES[theme].watermarkTop;
  return {
    headerTemplate: top
      ? footer({ ...style, number: false }, margin, title, watermark)
      : '<div></div>',
    footerTemplate: footer(style, margin, title, top ? '' : watermark),
  };
}

// Колонтитул в три колонки: заголовок слева, водяной знак ровно по центру,
// номер справа.
function footer(
  { font, color, page, number = true }, margin, title, watermark,
) {
  // Колонтитул — отдельный документ, встроенные шрифты ему недоступны: там
  // работают только системные, а список семейств — лишь с одинарными
  // кавычками.
  const family = font.replaceAll('"', "'");
  const mark = escapeHtml(watermark);
  const pages = `<span style="justify-self:end;${page}">`
    + '<span class="pageNumber"></span> / <span class="totalPages"></span>'
    + '</span>';

  return `<div style="width:100%;font-size:7pt;color:${color};
      font-family:${family};padding:0 ${margin.right} 0 ${margin.left};
      display:grid;grid-template-columns:1fr auto 1fr;align-items:center;
      gap:4mm;-webkit-print-color-adjust:exact;">
      <span>${number ? escapeHtml(title) : ''}</span>
      <span style="font-weight:bold;letter-spacing:0.08em;">${mark}</span>
      ${number ? pages : ''}
    </div>`;
}

function page(body, theme, align, sections, sheets, extraCss, fontsCss) {
  const mermaid = mermaidConfig(theme);
  const settings = {
    font: mermaid.themeVariables.fontFamily, mermaid,
    sankeyColors: sankeyColors(theme), sheets,
  };
  // mermaid.js — 5 МБ и ~0.5 с на разбор: только если есть диаграммы.
  const diagrams = !body.includes('<pre class="mermaid">') ? '' : `
<script>${loadAsset('mermaid.js')}</script>
<script>${loadAsset('diagrams.js')}</script>`;

  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<style>${fontsCss}</style>
<style>:root { --font-sans: ${SANS}; --font-mono: ${MONO};
  --text-align: ${align};
  ${paletteCss(theme)}
  --page-height: ${sheets.normal.height}mm;
  --wide-height: ${sheets.wide?.height}mm; }
@page { size: A4 ${sheets.normal.orientation}; }
@page wide { size: A4 landscape; }</style>
<style>${loadAsset('katex.css')}</style>
<style>${loadAsset('highlight.css')}</style>
<style>${loadAsset('style.css')}</style>
<style>${loadAsset(`theme-${theme}.css`)}</style>
<style>${extraCss}</style>
</head><body class="sections-${sections}">
${body}${diagrams}
<script>${loadAsset('tables.js')}</script>
<script>window.md2pdfPage = ${JSON.stringify(settings)};</script>
<script>${loadAsset('page.js')}</script>
</body></html>`;
}
