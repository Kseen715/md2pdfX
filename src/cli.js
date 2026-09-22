#!/usr/bin/env node
// md2pdf: Markdown (GitHub, Obsidian, Mermaid, LaTeX) → PDF.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import pkg from '../package.json' with { type: 'json' };
import { renderMarkdown } from './markdown.js';
import { findBrowser } from './browser.js';
import { CHOICES, checkChoice, DEFAULTS, launchBrowser, printPdf } from './pdf.js';

const USAGE = `md2pdf ${pkg.version} — Markdown (GitHub, Obsidian, Mermaid, LaTeX) → PDF

Использование:
  md2pdf <файл.md | каталог>... [-o <файл.pdf | каталог>] [--css <файл.css>]

  -o, --output   куда писать: файл PDF (при одном входе) или каталог.
                 По умолчанию PDF кладётся рядом с исходником.
      --theme        ${CHOICES.theme.join(' | ')} — оформление
      --orientation  ${CHOICES.orientation.join(' | ')} — ориентация листа
      --align        ${CHOICES.align.join(' | ')} — выравнивание текста
                     (justify — по ширине)
                     По умолчанию — первое значение в каждом списке.
      --watermark <текст>  надпись по центру нижнего колонтитула
      --css      дополнительные стили поверх встроенных
      --chrome   путь к Chrome/Chromium/Edge (по умолчанию ищется сам,
                 при необходимости скачивается в кэш puppeteer)
  -h, --help
  -v, --version

Каталог на входе — все .md в нём (без подкаталогов).`;

async function main() {
  const { values: opts, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      output: { type: 'string', short: 'o' },
      css: { type: 'string' },
      theme: { type: 'string', default: DEFAULTS.theme },
      orientation: { type: 'string', default: DEFAULTS.orientation },
      align: { type: 'string', default: DEFAULTS.align },
      watermark: { type: 'string', default: '' },
      chrome: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  });
  if (opts.version) return console.log(pkg.version);
  if (opts.help || !positionals.length) {
    console.log(USAGE);
    process.exitCode = opts.help ? 0 : 1;
    return;
  }

  const inputs = positionals.flatMap(expandInput);
  if (!inputs.length) throw new Error('Нет файлов .md для сборки');
  const outDir = opts.output && (inputs.length > 1 || /[\\/]$/.test(opts.output)
    || fs.statSync(opts.output, { throwIfNoEntry: false })?.isDirectory());
  const target = input => {
    const pdf = path.basename(input).replace(/\.md$/i, '') + '.pdf';
    if (!opts.output) return path.join(path.dirname(input), pdf);
    return outDir ? path.join(opts.output, pdf) : opts.output;
  };
  const extraCss = opts.css ? fs.readFileSync(opts.css, 'utf8') : '';
  // Ошибки в параметрах — до запуска Chrome.
  for (const name of Object.keys(CHOICES)) checkChoice(name, opts[name]);

  const browser = await launchBrowser(await findBrowser(opts.chrome ?? process.env.MD2PDF_CHROME));
  let failed = 0;
  try {
    for (const input of inputs) {
      try {
        const { html, title } = renderMarkdown(fs.readFileSync(input, 'utf8'), input);
        const output = target(input);
        fs.mkdirSync(path.dirname(output), { recursive: true });
        const { diagrams, errors } = await printPdf(browser, {
          html, output, extraCss, theme: opts.theme, watermark: opts.watermark,
          orientation: opts.orientation, align: opts.align,
          title: title ?? path.basename(input, '.md'),
        });
        console.log(`${output}${diagrams ? `: диаграмм отрисовано ${diagrams}` : ''}`);
        if (errors.length) console.warn('  ошибки страницы:', errors.join('; '));
      } catch (e) {
        failed++;
        console.error(`${input}: ${e.message}`);
      }
    }
  } finally {
    await browser.close();
  }
  process.exitCode = failed ? 1 : 0;
}

function expandInput(p) {
  const stat = fs.statSync(p, { throwIfNoEntry: false });
  if (!stat) throw new Error(`Не найден: ${p}`);
  if (!stat.isDirectory()) return [p];
  return fs.readdirSync(p).filter(f => /\.md$/i.test(f)).sort().map(f => path.join(p, f));
}

main().catch(e => {
  console.error(e.message);
  process.exitCode = 1;
});
