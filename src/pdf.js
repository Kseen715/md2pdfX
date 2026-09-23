// Печать HTML в PDF через headless Chrome: он же рисует диаграммы mermaid.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import { loadAsset, loadFont } from './assets.js';
import { FONT_ORIGIN } from './fonts.js';
import { escapeHtml } from './obsidian.js';

const MARGIN = { top: '18mm', bottom: '20mm', left: '16mm', right: '16mm' };


// Встроенные шрифты (src/fonts.js). Noto Sans для других письменностей и
// CJK подхватывают символы, которых нет в основном шрифте; эмодзи — последними.
const FALLBACK = [
  'Noto Sans Arabic Variable', 'Noto Sans Hebrew Variable', 'Noto Sans Devanagari Variable',
  'Noto Sans Bengali Variable', 'Noto Sans Tamil Variable', 'Noto Sans Thai Variable',
  'Noto Sans Georgian Variable', 'Noto Sans Armenian Variable', 'Noto Sans Ethiopic Variable',
  'Noto Sans SC', 'Noto Sans JP', 'Noto Sans KR', 'Noto Color Emoji',
].map(f => `"${f}"`).join(', ');
const SANS = `"Noto Sans Variable", ${FALLBACK}, sans-serif`;
const MONO = `"JetBrainsMono Nerd Font", ${FALLBACK}, monospace`;

// Тема: CSS поверх style.css, настройки mermaid, вид нижнего колонтитула и,
// если нужно, свои поля листа. Колонтитул Chrome рисует отдельно от страницы,
// стили ему только инлайном; number: false — без заголовка и номера страницы
// (тема ставит номер сама, через @page в CSS).
export const THEMES = {
  classic: {
    label: 'Classic',
    css: 'theme-classic.css',
    mermaid: { theme: 'neutral', themeVariables: { fontFamily: SANS } },
    footer: { font: SANS, color: '#7a848d', page: '' },
  },
  gost: {
    label: 'ГОСТ Р 7.0.97-2025',
    css: 'theme-gost.css',
    // Не меньше 20 мм слева (30 — для документов долгого хранения), 10 справа,
    // 20 сверху и снизу.
    margin: { top: '20mm', bottom: '20mm', left: '30mm', right: '10mm' },
    // Чёрно-белая, как и сам документ: белые блоки в чёрной рамке, подписи
    // стрелок на сером — на белом подпись разрывает линию и теряется.
    mermaid: {
      theme: 'base',
      themeVariables: {
        fontFamily: SANS, dropShadow: 'none', useGradient: false,
        primaryColor: '#ffffff', primaryTextColor: '#000000', primaryBorderColor: '#000000',
        secondaryColor: '#ffffff', tertiaryColor: '#ffffff', lineColor: '#000000',
        edgeLabelBackground: '#e6e6e6', clusterBkg: '#ffffff', clusterBorder: '#000000',
        noteBkgColor: '#ffffff', noteBorderColor: '#000000', noteTextColor: '#000000',
        actorBkg: '#ffffff', actorBorder: '#000000', actorTextColor: '#000000',
        signalColor: '#000000', signalTextColor: '#000000',
        pie1: '#000000', pie2: '#ffffff', pie3: '#808080', pie4: '#d0d0d0',
        pieStrokeColor: '#000000', pieOuterStrokeColor: '#000000',
        taskBkgColor: '#ffffff', taskBorderColor: '#000000',
        taskTextColor: '#000000', taskTextDarkColor: '#000000',
        taskTextLightColor: '#000000', taskTextOutsideColor: '#000000',
        activeTaskBkgColor: '#d0d0d0', activeTaskBorderColor: '#000000',
        doneTaskBkgColor: '#808080', doneTaskBorderColor: '#000000',
        critBkgColor: '#000000', critBorderColor: '#000000',
        sectionBkgColor: '#f0f0f0', altSectionBkgColor: '#ffffff', sectionBkgColor2: '#f0f0f0',
        gridColor: '#808080', todayLineColor: '#000000',
      },
    },
    footer: { font: SANS, color: '#000', page: '', number: false },
  },
  vectorheart: {
    label: 'Neo-Vectorheart',
    css: 'theme-vectorheart.css',
    mermaid: {
      theme: 'base',
      themeVariables: {
        fontFamily: MONO,
        primaryColor: '#ffffff', primaryTextColor: '#0a0a0a', primaryBorderColor: '#0a0a0a',
        secondaryColor: '#c6ff00', tertiaryColor: '#f3f3f3', lineColor: '#0a0a0a',
        noteBkgColor: '#c6ff00', noteBorderColor: '#0a0a0a',
        actorBkg: '#0a0a0a', actorTextColor: '#ffffff', actorBorder: '#0a0a0a',
        pie1: '#0a0a0a', pie2: '#c6ff00', pie3: '#8a8a8a', pie4: '#5c7a00',
        // Гант: у темы base нет цветов для состояний задач, и активная
        // выходит белой без рамки — на белом листе её не видно.
        taskBkgColor: '#ffffff', taskBorderColor: '#0a0a0a',
        taskTextColor: '#0a0a0a', taskTextDarkColor: '#0a0a0a',
        taskTextLightColor: '#0a0a0a', taskTextOutsideColor: '#0a0a0a',
        activeTaskBkgColor: '#c6ff00', activeTaskBorderColor: '#0a0a0a',
        doneTaskBkgColor: '#d9d9d9', doneTaskBorderColor: '#0a0a0a',
        critBkgColor: '#ffd6d0', critBorderColor: '#c62828',
        sectionBkgColor: '#f3f3f3', altSectionBkgColor: '#ffffff', sectionBkgColor2: '#f3f3f3',
        gridColor: '#8a8a8a', todayLineColor: '#5c7a00',
      },
    },
    footer: {
      font: MONO, color: '#0a0a0a',
      page: 'background:#0a0a0a;color:#c6ff00;padding:0.5mm 2mm;',
    },
  },
};

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
// колонтитула (пусто — нет).
export async function printPdf(browser, {
  html, title, output, extraCss = '', watermark = '',
  theme = DEFAULTS.theme, orientation = DEFAULTS.orientation, align = DEFAULTS.align,
  sections = DEFAULTS.sections,
}) {
  checkChoice('theme', theme);
  checkChoice('orientation', orientation);
  checkChoice('align', align);
  checkChoice('sections', sections);
  const look = THEMES[theme];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'md2pdf-'));
  const file = path.join(dir, 'doc.html');
  fs.writeFileSync(file, page(html, look, align, sections, extraCss));

  const tab = await browser.newPage();
  try {
    const errors = [];
    tab.on('pageerror', e => errors.push(e.message));
    // Шрифты отдаются из памяти (см. fonts.js). Страница открыта с file://,
    // так что для неё это сторонний адрес — нужен заголовок CORS.
    await tab.setRequestInterception(true);
    tab.on('request', request => {
      if (!request.url().startsWith(FONT_ORIGIN)) return request.continue();
      const font = loadFont(request.url().slice(FONT_ORIGIN.length));
      return font
        ? request.respond({ status: 200, contentType: 'font/woff2', body: font,
            headers: { 'Access-Control-Allow-Origin': '*' } })
        : request.respond({ status: 404 });
    });
    await tab.goto(pathToFileURL(file).href, { waitUntil: 'load' });

    const result = await tab.evaluate(() => window.__ready);
    if (result !== true) throw new Error('mermaid: ' + result);
    const diagrams = await tab.evaluate(async () => {
      await document.fonts.ready;
      return document.querySelectorAll('.mermaid svg').length;
    });

    await tab.pdf({
      path: output, format: 'A4', landscape: orientation === 'landscape',
      printBackground: true, margin: look.margin ?? MARGIN,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: footer(look.footer, look.margin ?? MARGIN, title, watermark),
    });
    return { diagrams, errors };
  } finally {
    await tab.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Три колонки: заголовок слева, водяной знак ровно по центру, номер справа.
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

function page(body, look, align, sections, extraCss) {
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<style>${loadAsset('fonts.css')}</style>
<style>:root { --font-sans: ${SANS}; --font-mono: ${MONO}; --text-align: ${align}; }</style>
<style>${loadAsset('katex.css')}</style>
<style>${loadAsset('highlight.css')}</style>
<style>${loadAsset('style.css')}</style>
<style>${loadAsset(look.css)}</style>
<style>${extraCss}</style>
</head><body class="sections-${sections}">
${body}
<script>${loadAsset('mermaid.js')}</script>
<script>
  // Свёрнутый <details> на бумаге не раскрыть — печатаем раскрытым.
  document.querySelectorAll('details').forEach(d => { d.open = true; });
  // Шрифт темы — и для рисования, и для замеров: у диаграмм последовательностей
  // свои настройки шрифтов (по умолчанию Trebuchet), и без них рамки заметок
  // и участников считаются под другой шрифт и текст из них вылезает.
  const font = ${JSON.stringify(look.mermaid.themeVariables.fontFamily)};
  window.mermaid.initialize({
    ...${JSON.stringify(look.mermaid)},
    startOnLoad: false, fontFamily: font,
    flowchart: { useMaxWidth: true },
    sequence: { useMaxWidth: true, actorFontFamily: font, noteFontFamily: font, messageFontFamily: font },
  });
  window.__ready = (async () => {
    // mermaid меряет подписи при отрисовке: шрифт для них должен быть уже
    // загружен, иначе подписи не влезут в рамки.
    const text = [...document.querySelectorAll('pre.mermaid')].map(e => e.textContent).join(' ');
    if (text) await Promise.all(['400', '700'].map(w => document.fonts.load(w + ' 16px ' + font, text)));
    await window.mermaid.run();
    return true;
  })().catch(e => (e && (e.message || e.str)) || String(e));  // ошибка разбора — объект с полем str
</script>
</body></html>`;
}
