// Один документ: Markdown → PDF. Общий шаг команды md2pdf, окна и
// расширения VS Code: каждый сам решает, откуда брать текст и куда класть PDF.
import fs from 'node:fs';
import path from 'node:path';
import { renderMarkdown } from './markdown.js';
import { printPdf } from './pdf.js';

// Имя PDF по имени исходника: notes.md → notes.pdf.
export function pdfName(input) {
  return stem(input) + '.pdf';
}

// src — текст документа: у расширения он с несохранёнными правками, поэтому
// не читается здесь с диска. book — собрать книгу (renderMarkdown), onStep —
// начало этапа: 'parse', затем этапы printPdf. Остальное — параметры
// printPdf. → { diagrams, errors } из printPdf.
export async function convert(browser, {
  src, input, output, book = false, onStep = () => {}, ...print
}) {
  onStep('parse');
  const { html, title } = renderMarkdown(src, input, { book });

  fs.mkdirSync(path.dirname(output), { recursive: true });
  return printPdf(browser, {
    ...print, html, output, onStep, title: title ?? stem(input),
  });
}

function stem(input) {
  return path.basename(input).replace(/\.md$/i, '');
}
