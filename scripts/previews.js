// Картинки тем для README: examples/showcase.md печатается в каждой теме,
// первая страница сохраняется в docs/previews/<тема>.png. Документ должен
// уместиться на одной странице — иначе ошибка.
//
//   node scripts/previews.js      нужны Chrome (как для md2pdf) и poppler-utils
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { renderMarkdown } from '../src/markdown.js';
import { findBrowser } from '../src/browser.js';
import { CHOICES, launchBrowser, printPdf } from '../src/pdf.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = path.join(root, 'examples/showcase.md');
const outDir = path.join(root, 'docs/previews');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'md2pdf-previews-'));

fs.mkdirSync(outDir, { recursive: true });
const { html, title } = renderMarkdown(fs.readFileSync(source, 'utf8'), source);
const browser = await launchBrowser(await findBrowser(process.env.MD2PDF_CHROME));
try {
  for (const theme of CHOICES.theme) {
    const pdf = path.join(tmp, `${theme}.pdf`);
    await printPdf(browser, { html, title, output: pdf, theme, watermark: 'PREVIEW' });
    const pages = Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [pdf], { encoding: 'utf8' }))[1]);
    if (pages !== 1) throw new Error(`${theme}: showcase.md занял ${pages} стр., а должен одну`);
    // 110 dpi: A4 выходит ~910 px в ширину — чётко и не тяжело для README.
    execFileSync('pdftoppm', ['-png', '-r', '110', '-singlefile', pdf, path.join(outDir, theme)]);
    console.log(path.relative(root, path.join(outDir, `${theme}.png`)));
  }
} finally {
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
