// Печать HTML в PDF через headless Chrome: он же рисует диаграммы mermaid.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import { loadAsset } from './assets.js';
import { escapeHtml } from './obsidian.js';

const MARGIN = { top: '18mm', bottom: '20mm', left: '16mm', right: '16mm' };

export function launchBrowser({ executablePath, headless }) {
  return puppeteer.launch({
    executablePath, headless,
    args: ['--no-sandbox', '--font-render-hinting=none'],
  });
}

// → { diagrams: число отрисованных диаграмм, errors: ошибки JS на странице }
export async function printPdf(browser, { html, title, output, extraCss = '' }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'md2pdf-'));
  const file = path.join(dir, 'doc.html');
  fs.writeFileSync(file, page(html, extraCss));

  const tab = await browser.newPage();
  try {
    const errors = [];
    tab.on('pageerror', e => errors.push(e.message));
    await tab.goto(pathToFileURL(file).href, { waitUntil: 'load' });

    const result = await tab.evaluate(() => window.__ready);
    if (result !== true) throw new Error('mermaid: ' + result);
    const diagrams = await tab.evaluate(async () => {
      await document.fonts.ready;
      return document.querySelectorAll('.mermaid svg').length;
    });

    await tab.pdf({
      path: output, format: 'A4', printBackground: true, margin: MARGIN,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `<div style="width:100%;font-size:7pt;color:#7a848d;
          font-family:'DejaVu Sans',sans-serif;padding:0 ${MARGIN.left};
          display:flex;justify-content:space-between;">
          <span>${escapeHtml(title)}</span>
          <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>`,
    });
    return { diagrams, errors };
  } finally {
    await tab.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function page(body, extraCss) {
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<style>${loadAsset('katex.css')}</style>
<style>${loadAsset('highlight.css')}</style>
<style>${loadAsset('style.css')}</style>
<style>${extraCss}</style>
</head><body>
${body}
<script>${loadAsset('mermaid.js')}</script>
<script>
  // Свёрнутый <details> на бумаге не раскрыть — печатаем раскрытым.
  document.querySelectorAll('details').forEach(d => { d.open = true; });
  window.mermaid.initialize({
    startOnLoad: false, theme: 'neutral',
    flowchart: { useMaxWidth: true }, sequence: { useMaxWidth: true },
  });
  // Ошибка разбора диаграммы — не Error, а объект с полем str.
  window.__ready = window.mermaid.run().then(() => true)
    .catch(e => (e && (e.message || e.str)) || String(e));
</script>
</body></html>`;
}
