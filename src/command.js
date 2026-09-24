// Команда md2pdf: разбор аргументов и сборка PDF. Общая для исполняемого
// файла (cli.js, печать через Chrome) и окна (gui/main.js, через Electron).
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import pkg from '../package.json' with { type: 'json' };
import { convert, pdfName } from './convert.js';
import { expandInput } from './markdown.js';
import { CHOICES, checkChoice, DEFAULTS } from './pdf.js';

const TITLE = 'Markdown (GitHub, Obsidian, Mermaid, LaTeX) → PDF';

const USAGE = `md2pdf ${pkg.version} — ${TITLE}

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

const OPTIONS = {
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
};

// launch(opts) → браузер с API puppeteer; opts — разобранные параметры.
// Итог — в process.exitCode.
export function run(args, launch) {
  return main(args, launch).catch(e => {
    console.error(e.message);
    process.exitCode = 1;
  });
}

async function main(args, launch) {
  const { values: opts, positionals } =
    parseArgs({ args, options: OPTIONS, allowPositionals: true });
  if (opts.version) return console.log(pkg.version);
  if (opts.help || !positionals.length) {
    console.log(USAGE);
    process.exitCode = opts.help ? 0 : 1;
    return;
  }

  const inputs = positionals.flatMap(expandInput);
  if (!inputs.length) throw new Error('Нет файлов .md для сборки');
  const target = outputPaths(opts.output, inputs);
  const { theme, orientation, align, sections, watermark, book } = opts;
  const extraCss = opts.css ? fs.readFileSync(opts.css, 'utf8') : '';
  const settings =
    { theme, orientation, align, sections, watermark, book, extraCss };
  // Ошибки в параметрах — до запуска Chrome.
  for (const name of Object.keys(CHOICES)) checkChoice(name, opts[name]);

  const browser = await launch(opts);
  let failed = 0;
  try {
    for (const input of inputs) {
      const output = target(input);
      if (!await convertOne(browser, input, output, settings)) failed++;
    }
  } finally {
    await browser.close();
  }
  process.exitCode = failed ? 1 : 0;
}

// output — файл PDF или каталог: каталог, если входов несколько, на конце
// «/» или такой каталог уже есть. Не задан — PDF рядом с исходником.
function outputPaths(output, inputs) {
  const toDir = output && (inputs.length > 1 || /[\\/]$/.test(output)
    || fs.statSync(output, { throwIfNoEntry: false })?.isDirectory());

  return input => {
    if (!output) return path.join(path.dirname(input), pdfName(input));
    return toDir ? path.join(output, pdfName(input)) : output;
  };
}

// → удалось ли. Ошибка в одном файле не останавливает остальные.
async function convertOne(browser, input, output, settings) {
  try {
    const src = fs.readFileSync(input, 'utf8');
    const { diagrams, errors } =
      await convert(browser, { ...settings, src, input, output });
    console.log(
      diagrams ? `${output}: диаграмм отрисовано ${diagrams}` : output);
    if (errors.length) console.warn('  ошибки страницы:', errors.join('; '));
    return true;
  } catch (e) {
    console.error(`${input}: ${e.message}`);
    return false;
  }
}
