// Markdown → PDF с отрисовкой диаграмм Mermaid.
//
// Обычные конвертеры (pandoc + LaTeX, wkhtmltopdf) оставляют блоки ```mermaid
// кодом: диаграмму рисует JavaScript, значит нужен браузер. Поэтому цепочка
// такая: pandoc собирает HTML, mermaid.js рисует диаграммы в headless Chrome,
// он же печатает результат в PDF.
//
//   node build.js <файл.md> [файл.pdf]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const puppeteer = require('puppeteer');

const here = __dirname;
const src = process.argv[2];
const out = process.argv[3] || src?.replace(/\.md$/i, '') + '.pdf';

if (!src || !fs.existsSync(src)) {
  console.error('Использование: node build.js <файл.md> [файл.pdf]');
  process.exit(1);
}
try {
  execFileSync('pandoc', ['--version'], { stdio: 'ignore' });
} catch {
  console.error('Не найден pandoc. Установить: sudo apt install pandoc');
  process.exit(1);
}

// gfm_auto_identifiers даёт якоря в стиле GitHub, иначе ссылки оглавления
// вида (#1-что-развёрнуто) не совпадут с id, которые pandoc проставляет по
// умолчанию (он отбрасывает ведущие цифры).
const bodyHtml = execFileSync(
  'pandoc', ['--from', 'gfm+gfm_auto_identifiers', '--to', 'html5', src],
  { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
);

// Подпись в колонтитуле — заголовок документа, то есть первый <h1>.
const titleMatch = bodyHtml.match(/<h1[^>]*>(.*?)<\/h1>/s);
const footerTitle = titleMatch
  ? titleMatch[1].replace(/<[^>]+>/g, '').trim()
  : path.basename(src);

const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<style>${fs.readFileSync(path.join(here, 'style.css'), 'utf8')}</style>
</head><body>
${bodyHtml}
<script>${fs.readFileSync(path.join(here, 'node_modules/mermaid/dist/mermaid.min.js'), 'utf8')}</script>
<script>
  // pandoc отдаёт <pre class="mermaid"><code>…</code></pre>, а mermaid ждёт
  // текст диаграммы прямо в элементе.
  document.querySelectorAll('pre.mermaid > code').forEach(c => {
    c.parentElement.textContent = c.textContent;
  });
  window.mermaid.initialize({
    startOnLoad: false, theme: 'neutral',
    flowchart: { useMaxWidth: true }, sequence: { useMaxWidth: true },
  });
  window.__done = window.mermaid.run().then(() => true).catch(e => String(e));
</script>
</body></html>`;

const tmp = path.join(here, '.doc.html');
fs.writeFileSync(tmp, html);

(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--font-render-hinting=none'],
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('file://' + tmp, { waitUntil: 'networkidle0' });

    const result = await page.evaluate(() => window.__done);
    if (result !== true) throw new Error('mermaid: ' + result);
    const rendered = await page.evaluate(
      () => document.querySelectorAll('.mermaid svg').length);

    await page.pdf({
      path: out, format: 'A4', printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `<div style="width:100%;font-size:7pt;color:#7a848d;
          font-family:'DejaVu Sans',sans-serif;padding:0 16mm;display:flex;
          justify-content:space-between;">
          <span>${footerTitle}</span><span class="pageNumber"></span></div>`,
      margin: { top: '18mm', bottom: '20mm', left: '16mm', right: '16mm' },
    });

    console.log(`${out}: диаграмм отрисовано ${rendered}`);
    if (errors.length) console.log('ошибки страницы:', errors.join('; '));
  } finally {
    await browser.close();
    fs.unlinkSync(tmp);
  }
})();
