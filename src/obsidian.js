// Синтаксис Obsidian поверх markdown-it: свойства (frontmatter), вики-ссылки
// и встраивание [[…]] / ![[…]], callout'ы (они же GitHub alerts), теги,
// комментарии %%…%%. Подсветка ==…== — плагин markdown-it-mark.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const IMAGE_EXT = /\.(png|jpe?g|gif|svg|webp|bmp|avif)$/i;
const MAX_EMBED_DEPTH = 8;

// Цвет callout'а по типу. Покрывает типы Obsidian и пять алертов GitHub.
const CALLOUT_COLORS = {
  note: 'blue', info: 'blue', todo: 'blue',
  abstract: 'teal', summary: 'teal', tldr: 'teal', tip: 'teal', hint: 'teal',
  important: 'purple', example: 'purple',
  success: 'green', check: 'green', done: 'green',
  question: 'yellow', help: 'yellow', faq: 'yellow',
  warning: 'orange', attention: 'orange',
  caution: 'red', failure: 'red', fail: 'red', missing: 'red',
  danger: 'red', error: 'red', bug: 'red',
  quote: 'gray', cite: 'gray',
};

// Свойства заметки. Полноценный YAML не нужен: из них берётся только title.
export function splitFrontmatter(src) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(src);
  if (!m) return { body: src, title: undefined };
  const title = /^title:[ \t]*(.+?)[ \t]*$/m.exec(m[1])?.[1].replace(/^(['"])(.*)\1$/, '$2');
  return { body: src.slice(m[0].length), title };
}

export function escapeHtml(s) {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

// Относительный путь из документа → file:// URL: страница печатается из
// временного каталога, и относительные ссылки на картинки иначе потеряются.
export function localUrl(src, baseDir) {
  if (!src || src.startsWith('#') || /^[a-z][a-z\d+.-]+:/i.test(src)) return src;
  let decoded = src;
  try { decoded = decodeURIComponent(src); } catch { /* оставить как есть */ }
  return pathToFileURL(path.resolve(baseDir, decoded)).href;
}

// Книга: каждый файл, на который ссылаются, — одна глава, env.chapters
// (путь → id главы) общий на всю книгу. Файл, уже включённый в книгу
// (в том числе по циклической ссылке), второй раз не добавляется: ссылка
// ведёт на его главу. anchor — id заголовка внутри главы.
export function chapterHref(env, file, anchor) {
  let id = env.chapters.get(file);
  if (!id) env.chapters.set(file, id = 'f' + env.chapters.size);
  return '#' + (anchor ? `${id}-${anchor}` : id);
}

export default function obsidian(md, { slugify }) {
  md.block.ruler.before('paragraph', 'obsidian_comment', commentBlock);
  md.inline.ruler.before('link', 'obsidian_comment', commentInline);
  md.inline.ruler.before('link', 'wikilink', wikilink);
  md.inline.ruler.push('tag', tag);
  md.core.ruler.before('inline', 'callout', callouts);

  md.renderer.rules.wikilink = (tokens, idx, _options, env) => {
    const { file, heading, alias } = parseTarget(tokens[idx].content);
    const text = escapeHtml(alias || [file, heading].filter(Boolean).join(' › '));
    const anchor = heading && slugify(heading);
    // Ссылка на заголовок этого же документа работает и в PDF, на другие
    // заметки — только в книге (глава), иначе остаётся подпись: вне
    // хранилища им некуда вести.
    if (!file) return `<a class="wikilink" href="#${env.idPrefix ?? ''}${anchor}">${text}</a>`;
    const found = env.chapters && resolveFile(file, env);
    return found?.endsWith('.md')
      ? `<a class="wikilink" href="${chapterHref(env, found, anchor)}">${text}</a>`
      : `<span class="wikilink">${text}</span>`;
  };

  md.renderer.rules.wiki_embed = (tokens, idx, _options, env) => {
    const raw = tokens[idx].content;
    const { file, heading, alias } = parseTarget(raw);
    const found = file && resolveFile(file, env);
    if (!found) return `<span class="wikilink missing" title="не найдено">${escapeHtml(raw)}</span>`;
    const url = pathToFileURL(found).href;

    if (IMAGE_EXT.test(found)) {
      // ![[img.png|300]] или ![[img.png|300x200]] — размер, иначе подпись.
      const size = /^(\d+)(?:x(\d+))?$/.exec(alias ?? '');
      const attrs = size
        ? ` width="${size[1]}"${size[2] ? ` height="${size[2]}"` : ''}`
        : ` alt="${escapeHtml(alias ?? path.basename(found))}"`;
      return `<img src="${url}"${attrs}>`;
    }
    if (!found.endsWith('.md')) {
      return `<a href="${url}">${escapeHtml(alias ?? path.basename(found))}</a>`;
    }
    if (env.embedStack.includes(found) || env.embedStack.length > MAX_EMBED_DEPTH) {
      return `<span class="wikilink missing" title="циклическое встраивание">${escapeHtml(raw)}</span>`;
    }

    let body = splitFrontmatter(fs.readFileSync(found, 'utf8')).body;
    if (heading) body = extractSection(body, heading, slugify);
    // Своё окружение: иначе сноски родителя продублируются во вложенной
    // заметке. Счётчик якорей общий, чтобы id заголовков не повторялись.
    const inner = md.render(body, {
      baseDir: path.dirname(found),
      embedStack: [...env.embedStack, found],
      slugs: env.slugs,
      vault: env.vault,
      chapters: env.chapters,
      idPrefix: env.idPrefix,
    });
    return `<div class="embed">${inner}</div>`;
  };
}

// [[Заметка#Заголовок|подпись]]
function parseTarget(raw) {
  const inner = raw.replace(/\\\|/g, '|');  // внутри таблиц пишут \|
  const bar = inner.indexOf('|');
  const target = bar < 0 ? inner : inner.slice(0, bar);
  const alias = bar < 0 ? undefined : inner.slice(bar + 1).trim();
  const hash = target.indexOf('#');
  const file = (hash < 0 ? target : target.slice(0, hash)).trim();
  // Ссылки на блоки (#^id) в PDF не адресуются — ведут на заметку целиком.
  const heading = hash < 0 ? undefined : target.slice(hash + 1).trim().replace(/^\^.*/, '') || undefined;
  return { file, heading, alias };
}

function wikilink(state, silent) {
  const src = state.src;
  const embed = src.charCodeAt(state.pos) === 0x21 /* ! */;
  const start = state.pos + (embed ? 1 : 0);
  if (!src.startsWith('[[', start)) return false;
  const end = src.indexOf(']]', start + 2);
  if (end < 0 || end > state.posMax) return false;
  const inner = src.slice(start + 2, end);
  if (!inner.trim() || inner.includes('\n') || inner.includes('[[')) return false;
  if (!silent) state.push(embed ? 'wiki_embed' : 'wikilink', '', 0).content = inner;
  state.pos = end + 2;
  return true;
}

// #тег: только после пробела или в начале строки и не из одних цифр,
// чтобы не ловить «C#», «#1» и якоря.
function tag(state, silent) {
  if (state.src.charCodeAt(state.pos) !== 0x23 /* # */) return false;
  if (state.pos > 0 && !/\s/.test(state.src[state.pos - 1])) return false;
  const m = /^#([\p{L}\p{N}_/-]+)/u.exec(state.src.slice(state.pos, state.posMax));
  if (!m || /^[\d/-]+$/.test(m[1])) return false;
  if (!silent) {
    const t = state.push('html_inline', '', 0);
    t.content = `<span class="tag">${escapeHtml(m[0])}</span>`;
  }
  state.pos += m[0].length;
  return true;
}

function commentInline(state, silent) {
  if (!state.src.startsWith('%%', state.pos)) return false;
  const end = state.src.indexOf('%%', state.pos + 2);
  if (end < 0 || end + 2 > state.posMax) return false;
  state.pos = end + 2;
  return true;
}

// Комментарий, который начинается с новой строки и может занимать несколько
// абзацев. Если после закрывающих %% идёт текст — это дело инлайн-правила.
function commentBlock(state, startLine, endLine) {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  if (!state.src.startsWith('%%', start)) return false;
  const close = state.src.indexOf('%%', start + 2);
  if (close < 0) return false;
  let line = startLine;
  while (line < endLine && state.eMarks[line] < close) line++;
  if (line >= endLine || state.src.slice(close + 2, state.eMarks[line]).trim()) return false;
  state.line = line + 1;
  return true;
}

// > [!type]± Заголовок  →  <div class="callout …">. Работает до разбора
// инлайнов, поэтому заголовок размечается как обычный markdown.
function callouts(state) {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    const open = tokens[i];
    const inline = tokens[i + 2];
    if (open.type !== 'blockquote_open' || tokens[i + 1]?.type !== 'paragraph_open'
        || inline?.type !== 'inline') continue;
    const m = /^\[!([\w-]+)\][+-]?[ \t]*(.*)(?:\n|$)/.exec(inline.content);
    if (!m) continue;

    let depth = 0, close = i;
    for (; close < tokens.length; close++) {
      if (tokens[close].type === 'blockquote_open') depth++;
      if (tokens[close].type === 'blockquote_close' && --depth === 0) break;
    }
    const type = m[1].toLowerCase();
    open.tag = tokens[close].tag = 'div';
    open.attrSet('class', `callout callout-${CALLOUT_COLORS[type] ?? 'blue'}`);
    open.attrSet('data-callout', type);

    const title = new state.Token('inline', '', 0);
    title.content = m[2].trim() || type[0].toUpperCase() + type.slice(1);
    title.children = [];
    const html = content => Object.assign(new state.Token('html_block', '', 0), { content });
    const header = [html('<div class="callout-title">'), title, html('</div>\n')];

    inline.content = inline.content.slice(m[0].length);
    // Callout из одного заголовка: пустой абзац не нужен.
    tokens.splice(i + 1, inline.content.trim() ? 0 : 3, ...header);
  }
}

// Раздел заметки от заголовка до следующего заголовка того же или старшего уровня.
function extractSection(src, heading, slugify) {
  const lines = src.split('\n');
  const want = slugify(heading);
  let from = -1, level = 0;
  for (let i = 0; i < lines.length; i++) {
    const h = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(lines[i]);
    if (!h) continue;
    if (from < 0 && slugify(h[2]) === want) { from = i; level = h[1].length; }
    else if (from >= 0 && h[1].length <= level) return lines.slice(from, i).join('\n');
  }
  return from < 0 ? `*Раздел «${heading}» не найден.*` : lines.slice(from).join('\n');
}

// Obsidian ищет файл по имени во всём хранилище. Корень хранилища — ближайший
// каталог с .obsidian, иначе каталог документа. Список файлов кэшируется на
// один документ (env.vault): в долгоживущем процессе расширения он иначе
// устаревал бы.
export function resolveFile(name, env) {
  const baseDir = env.baseDir;
  const wanted = path.extname(name) ? name : name + '.md';
  const root = vaultRoot(baseDir);
  for (const dir of [baseDir, root]) {
    const direct = path.resolve(dir, wanted);
    if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
  }
  const suffix = path.sep + path.normalize(wanted).toLowerCase();
  return indexVault(root, env.vault).find(f => f.toLowerCase().endsWith(suffix));
}

function vaultRoot(dir) {
  for (let d = dir; ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, '.obsidian'))) return d;
    if (path.dirname(d) === d) return dir;
  }
}

function indexVault(root, vaultIndex) {
  if (!vaultIndex.has(root)) {
    const files = [];
    const walk = dir => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name.startsWith('.') || e.name === 'node_modules') continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full); else files.push(full);
      }
    };
    walk(root);
    vaultIndex.set(root, files);
  }
  return vaultIndex.get(root);
}
