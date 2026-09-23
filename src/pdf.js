// Печать HTML в PDF через headless Chrome: он же рисует диаграммы mermaid.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import { loadAsset, loadFont } from './assets.js';
import { FONT_ORIGIN } from './fonts.js';
import { escapeHtml } from './obsidian.js';
import { footerStyle, mermaidConfig, MONO, paletteCss, sankeyColors, SANS, THEMES } from './themes/index.js';

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
export const DEFAULTS = Object.fromEntries(Object.entries(CHOICES).map(([k, v]) => [k, v[0]]));

export function checkChoice(name, value) {
  if (!CHOICES[name].includes(value)) {
    throw new Error(`Неизвестное значение ${name}: «${value}». Есть: ${CHOICES[name].join(', ')}`);
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
  theme = DEFAULTS.theme, orientation = DEFAULTS.orientation, align = DEFAULTS.align,
  sections = DEFAULTS.sections,
}) {
  checkChoice('theme', theme);
  checkChoice('orientation', orientation);
  checkChoice('align', align);
  checkChoice('sections', sections);
  const look = THEMES[theme];
  const margin = look.margin ?? MARGIN;
  // Рабочая область листа A4, мм: поля везде в мм. wide — альбомный лист для
  // диаграмм, которым тесно на книжном (см. diagrams.js).
  const area = o => {
    const [width, height] = o === 'landscape' ? [297, 210] : [210, 297];
    return { orientation: o,
      width: width - parseFloat(margin.left) - parseFloat(margin.right),
      height: height - parseFloat(margin.top) - parseFloat(margin.bottom) };
  };
  const sheets = { normal: area(orientation), wide: orientation === 'portrait' ? area('landscape') : null };
  const fonts = await serveFonts();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'md2pdf-'));
  const file = path.join(dir, 'doc.html');
  const fontsCss = loadAsset('fonts.css').replaceAll(FONT_ORIGIN, `http://127.0.0.1:${fonts.address().port}/`);
  fs.writeFileSync(file, page(html, theme, align, sections, sheets, extraCss, fontsCss));

  let tab;
  try {
    tab = await browser.newPage();
    const errors = [];
    tab.on('pageerror', e => errors.push(e.message));
    onStep('render');
    await tab.goto(pathToFileURL(file).href, { waitUntil: 'load' });

    const result = await tab.evaluate(() => window.__ready);
    if (result !== true) throw new Error('mermaid: ' + result);
    const diagrams = await tab.evaluate(async () => {
      await document.fonts.ready;
      return document.querySelectorAll('.mermaid:has(svg)').length;  // разрезанная — одна
    });

    onStep('print');
    await tab.pdf({
      // Размер листа — из @page: у диаграмм бывает свой, альбомный.
      path: output, preferCSSPageSize: true,
      printBackground: true, margin,
      // Закладки PDF из h1–h6: оглавление в просмотрщике, переходы по разделам.
      outline: true, tagged: true,
      displayHeaderFooter: true,
      headerTemplate: look.watermarkTop ? footer({ ...footerStyle(theme), number: false }, margin, title, watermark) : '<div></div>',
      footerTemplate: footer(footerStyle(theme), margin, title, look.watermarkTop ? '' : watermark),
    });
    return { diagrams, errors };
  } finally {
    await tab?.close();
    fonts.closeAllConnections();
    fonts.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Шрифты (fonts.js) отдаёт локальный HTTP-сервер из памяти. Файлы по file://
// Chrome прочесть может не суметь: snap-Chromium не видит скрытых каталогов
// вроде ~/.vscode, а в исполняемом файле шрифты вообще не на диске. Перехват
// запросов puppeteer справлялся, но его включение стоит ~2.5 с на запуск Chrome.
async function serveFonts() {
  const server = http.createServer((request, response) => {
    const font = loadFont(request.url.slice(1));
    // Страница открыта с file://, для неё сервер — сторонний адрес: нужен CORS.
    response.writeHead(font ? 200 : 404, { 'Content-Type': 'font/woff2', 'Access-Control-Allow-Origin': '*' });
    response.end(font ?? undefined);
  });
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  return server;
}

// Колонтитул в три колонки: заголовок слева, водяной знак ровно по центру, номер справа.
function footer({ font, color, page, number = true }, margin, title, watermark) {
  // Колонтитул — отдельный документ, встроенные шрифты ему недоступны: там
  // работают только системные, а список семейств — лишь с одинарными кавычками.
  return `<div style="width:100%;font-size:7pt;color:${color};font-family:${font.replaceAll('"', "'")};
      padding:0 ${margin.right} 0 ${margin.left};display:grid;grid-template-columns:1fr auto 1fr;
      align-items:center;gap:4mm;-webkit-print-color-adjust:exact;">
      <span>${number ? escapeHtml(title) : ''}</span>
      <span style="font-weight:bold;letter-spacing:0.08em;">${escapeHtml(watermark)}</span>
      ${number ? `<span style="justify-self:end;${page}"><span class="pageNumber"></span> / <span class="totalPages"></span></span>` : ''}
    </div>`;
}

function page(body, theme, align, sections, sheets, extraCss, fontsCss) {
  const mermaid = mermaidConfig(theme);
  const diagrams = body.includes('<pre class="mermaid">');
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<style>${fontsCss}</style>
<style>:root { --font-sans: ${SANS}; --font-mono: ${MONO}; --text-align: ${align};
  ${paletteCss(theme)}
  --page-height: ${sheets.normal.height}mm; --wide-height: ${sheets.wide?.height}mm; }
@page { size: A4 ${sheets.normal.orientation}; }
@page wide { size: A4 landscape; }</style>
<style>${loadAsset('katex.css')}</style>
<style>${loadAsset('highlight.css')}</style>
<style>${loadAsset('style.css')}</style>
<style>${loadAsset(`theme-${theme}.css`)}</style>
<style>${extraCss}</style>
</head><body class="sections-${sections}">
${body}
${diagrams ? `<script>${loadAsset('mermaid.js')}</script>
<script>${loadAsset('diagrams.js')}</script>` : ''}
<script>${loadAsset('tables.js')}</script>
<script>
  // Свёрнутый <details> на бумаге не раскрыть — печатаем раскрытым.
  document.querySelectorAll('details').forEach(d => { d.open = true; });
  window.__ready = (async () => {
    // mermaid.js — 5 МБ и ~0.5 с на разбор: подключается, только если есть диаграммы.
    if (window.mermaid) {
      // Шрифт темы — и для рисования, и для замеров: у диаграмм последовательностей
      // свои настройки шрифтов (по умолчанию Trebuchet), и без них рамки заметок
      // и участников считаются под другой шрифт и текст из них вылезает.
      const font = ${JSON.stringify(mermaid.themeVariables.fontFamily)};
      const sources = [...document.querySelectorAll('pre.mermaid')].map(e => e.textContent);
      window.mermaid.initialize({
        ...${JSON.stringify(mermaid)},
        startOnLoad: false, fontFamily: font,
        flowchart: { useMaxWidth: true },
        sequence: { useMaxWidth: true, actorFontFamily: font, noteFontFamily: font, messageFontFamily: font },
        sankey: { nodeColors: window.sankeyNodeColors(sources, ${JSON.stringify(sankeyColors(theme))}) },
      });
      // mermaid меряет подписи при отрисовке: шрифт для них должен быть уже
      // загружен, иначе подписи не влезут в рамки.
      await Promise.all(['400', '700'].map(w => document.fonts.load(w + ' 16px ' + font, sources.join(' '))));
      await window.mermaid.run();
      await window.fitDiagrams(sources, ${JSON.stringify(sheets)});
    }
    await document.fonts.ready;
    window.keepTables(${JSON.stringify(sheets.normal)});
    return true;
  })().catch(e => (e && (e.message || e.str)) || String(e));  // ошибка разбора — объект с полем str
</script>
</body></html>`;
}
