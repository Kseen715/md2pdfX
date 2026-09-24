// HTML документа: экранирование и адреса ссылок. Общее для разбора Markdown
// (markdown.js, obsidian.js) и колонтитулов (pdf.js).
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

export function escapeHtml(s) {
  return s.replace(/[&<>"]/g, c => ESCAPES[c]);
}

// Адрес со схемой (https:, mailto:, file:…), а не путь к файлу.
export function isExternal(href) {
  return /^[a-z][a-z\d+.-]+:/i.test(href);
}

// Путь из ссылки Markdown: %20 и прочее раскодируются, а битая
// %-последовательность — скорее всего, просто знак % в имени файла.
export function decodePath(href) {
  try {
    return decodeURIComponent(href);
  } catch {
    return href;
  }
}

// Относительный путь из документа → file:// URL: страница печатается из
// временного каталога, и относительные ссылки на картинки иначе потеряются.
export function localUrl(src, baseDir) {
  if (!src || src.startsWith('#') || isExternal(src)) return src;
  return pathToFileURL(path.resolve(baseDir, decodePath(src))).href;
}
