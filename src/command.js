// Команда md2pdf: разбор аргументов и сборка PDF. Общая для исполняемого
// файла (cli.js, печать через Chrome) и окна (gui/main.js, через Electron).
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import pkg from '../package.json' with { type: 'json' };
import { expandInput, renderMarkdown } from './markdown.js';
import { CHOICES, checkChoice, DEFAULTS, printPdf } from './pdf.js';

const USAGE = `md2pdf ${pkg.version} — Markdown (GitHub, Obsidian, Mermaid, LaTeX) → PDF

Использование:
  md2pdf <файл.md | каталог>... [-o <файл.pdf | каталог>] [--css <файл.css>]

  -o, --output   куда писать: файл PDF (при одном входе) или каталог.
                 По умолчанию PDF кладётся рядом с исходником.
      --theme        ${CHOICES.theme.join(' | ')} — оформление
      --orientation  ${CHOICES.orientation.join(' | ')} — ориентация листа
      --align        ${CHOICES.align.join(' | ')} — выравнивание текста
                     (justify — по ширине)
      --sections     ${CHOICES.sections.join(' | ')} — раздел (h2) с новой
                     страницы или сплошным текстом
                     По умолчанию — первое значение в каждом списке.
      --watermark <текст>  надпись по центру нижнего колонтитула
      --book     книга: к документу добавляются главами все локальные .md,
                 на которые он ссылается ([[…]] или [текст](файл.md)), и так
                 далее по цепочке; каждая глава — с новой страницы
      --css      дополнительные стили поверх встроенных
      --chrome   путь к Chrome/Chromium/Edge (по умолчанию ищется сам,
                 при необходимости скачивается в кэш puppeteer)
  -h, --help
  -v, --version

Каталог на входе — все .md в нём (без подкаталогов).`;

// launch(opts) → браузер с API puppeteer; opts — разобранные параметры.
// Итог — в process.exitCode.
export function run(args, launch) {
  return main(args, launch).catch(e => {
    console.error(e.message);
    process.exitCode = 1;
  });
}

async function main(args, launch) {
  const { values: opts, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      output: { type: 'string', short: 'o' },
      css: { type: 'string' },
      theme: { type: 'string', default: DEFAULTS.theme },
      orientation: { type: 'string', default: DEFAULTS.orientation },
      align: { type: 'string', default: DEFAULTS.align },
      sections: { type: 'string', default: DEFAULTS.sections },
      watermark: { type: 'string', default: '' },
      book: { type: 'boolean' },
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

  const browser = await launch(opts);
  let failed = 0;
  try {
    for (const input of inputs) {
      try {
        const { html, title } = renderMarkdown(fs.readFileSync(input, 'utf8'), input, { book: opts.book });
        const output = target(input);
        fs.mkdirSync(path.dirname(output), { recursive: true });
        const { diagrams, errors } = await printPdf(browser, {
          html, output, extraCss, theme: opts.theme, watermark: opts.watermark,
          orientation: opts.orientation, align: opts.align, sections: opts.sections,
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
