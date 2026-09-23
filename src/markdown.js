// Markdown → HTML: GitHub Flavored Markdown, синтаксис Obsidian, формулы
// KaTeX (рисуются здесь же, в Node) и блоки mermaid (их рисует браузер).
import fs from 'node:fs';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import mark from 'markdown-it-mark';
import { full as emoji } from 'markdown-it-emoji';
import katexPlugin from '@vscode/markdown-it-katex';
import katex from 'katex';
import hljs from 'highlight.js/lib/common';
import { pathToFileURL } from 'node:url';
import obsidian, { chapterHref, escapeHtml, localUrl, resolveFile, splitFrontmatter } from './obsidian.js';

// Якоря как на GitHub: иначе ссылки оглавления вида (#1-что-развёрнуто)
// не совпадут с id заголовков.
export function slugify(text) {
  return text.trim().toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '')
    .replace(/ /g, '-');
}

const md = new MarkdownIt({
  html: true,
  linkify: true,
  highlight(code, lang) {
    if (!lang || !hljs.getLanguage(lang)) return '';
    return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
  },
})
  .use(footnote)
  .use(mark)
  .use(emoji)
  // Пакет CommonJS: default лежит то в самом модуле, то в .default.
  .use(katexPlugin.default ?? katexPlugin, { katex, enableFencedBlocks: true, throwOnError: false })
  .use(obsidian, { slugify });

md.core.ruler.push('heading_ids', headingIds);
md.core.ruler.after('inline', 'task_lists', taskLists);
md.core.ruler.after('inline', 'empty_paragraphs', emptyParagraphs);
// После text_join: иначе «\eqref{…}» разбит на несколько текстовых токенов.
md.core.ruler.push('equations', equations);

// Диаграмма остаётся текстом в <pre class="mermaid">, mermaid.js заменит его на SVG.
const fence = md.renderer.rules.fence;
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const t = tokens[idx];
  if (t.info.trim().split(/\s+/)[0] === 'mermaid') {
    return `<pre class="mermaid">${escapeHtml(t.content)}</pre>\n`;
  }
  return withEqId(fence(tokens, idx, options, env, self), t, env);
};

// Блочная формула с \label получает id — на него ведут ссылки \eqref.
for (const rule of ['math_block', 'math_inline_block', 'math_inline_bare_block']) {
  const render = md.renderer.rules[rule];
  md.renderer.rules[rule] = (tokens, idx, options, env, self) =>
    withEqId(render(tokens, idx, options, env, self), tokens[idx], env);
}

function withEqId(html, token, env) {
  const id = token.meta?.eqId;
  return id ? html.replace(/^<(\w+)/, `<$1 id="${escapeHtml((env.idPrefix ?? '') + id)}"`) : html;
}

// Длинные идентификаторы (CH_INSPLAN_PLANS_AUDITORS) переносятся после «_»:
// иначе колонка таблицы не сжимается уже самого длинного из них, таблица
// выходит за поле листа, и Chrome обрезает её правую рамку.
const codeInline = md.renderer.rules.code_inline;
md.renderer.rules.code_inline = (...args) => {
  const html = codeInline(...args), open = html.indexOf('>') + 1;
  return html.slice(0, open) + html.slice(open).replaceAll('_', '_<wbr>');
};

const image = md.renderer.rules.image;
md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const t = tokens[idx];
  t.attrSet('src', localUrl(t.attrGet('src'), env.baseDir));
  return image(tokens, idx, options, env, self);
};

// В книге id заголовков и ссылки на них получают префикс главы: иначе
// одинаковые заголовки разных файлов дадут одинаковые id. Ссылка на
// локальный .md ([текст](файл.md#якорь)) в книге ведёт на главу с этим
// файлом, вне книги — на сам файл: страница печатается из временного
// каталога, и относительная ссылка там никуда не ведёт. Путь ищется как в
// Obsidian: от документа, от корня хранилища, затем по имени во всём
// хранилище — Obsidian пишет только имя, если оно уникально.
const linkOpen = md.renderer.rules.link_open
  ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const t = tokens[idx];
  const href = t.attrGet('href') ?? '';
  if (href.startsWith('#')) {
    if (env.idPrefix) t.attrSet('href', '#' + env.idPrefix + href.slice(1));
  } else if (href && !/^[a-z][a-z\d+.-]+:/i.test(href)) {
    const [target, anchor] = href.split('#', 2);
    let decoded = target;
    try { decoded = decodeURIComponent(target); } catch { /* оставить как есть */ }
    const file = resolveFile(decoded, env) ?? path.resolve(env.baseDir, decoded);
    t.attrSet('href', env.chapters && /\.md$/i.test(file) && fs.existsSync(file)
      ? chapterHref(env, file, anchor)
      : pathToFileURL(file).href + (anchor === undefined ? '' : '#' + anchor));
  }
  return linkOpen(tokens, idx, options, env, self);
};

// Возвращает HTML тела и заголовок документа: свойство title,
// иначе первый <h1>. book — собрать книгу: к документу главами добавляются
// все локальные .md, на которые он ссылается (вики-ссылками или обычными),
// и так далее по цепочке; каждая глава начинается с новой страницы.
export function renderMarkdown(src, file, { book = false } = {}) {
  const { body, title } = splitFrontmatter(src);
  const abs = path.resolve(file);
  const vault = new Map();
  const env = { baseDir: path.dirname(abs), embedStack: [abs], vault, title };
  if (!book) return { html: md.render(body, env), title: env.title };

  const chapters = new Map([[abs, 'f0']]);
  let html = '';
  // Map обходится вместе с главами, добавленными по ходу рендера.
  for (const [chapter, id] of chapters) {
    const part = chapter === abs ? { body, title } : splitFrontmatter(fs.readFileSync(chapter, 'utf8'));
    const chapterEnv = chapter === abs ? env : { baseDir: path.dirname(chapter), embedStack: [chapter], vault };
    Object.assign(chapterEnv, { chapters, idPrefix: id + '-', docId: id });
    const tokens = md.parse(part.body, chapterEnv);
    // Как в Obsidian: без своего # заголовка глава называется по свойству
    // title или по имени файла — иначе её нет ни в тексте, ни в закладках.
    if (!tokens.some(t => t.type === 'heading_open' && t.tag === 'h1')) {
      const name = part.title ?? path.basename(chapter).replace(/\.md$/i, '');
      tokens.unshift(...md.parse('# ' + name, chapterEnv));
    }
    html += `<section class="chapter" id="${id}">\n${md.renderer.render(tokens, md.options, chapterEnv)}</section>\n`;
  }
  return { html, title: env.title };
}

function headingIds(state) {
  const slugs = state.env.slugs ??= new Map();
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== 'heading_open') continue;
    const text = tokens[i + 1].children
      .filter(c => c.type === 'text' || c.type === 'code_inline')
      .map(c => c.content).join('');
    const slug = slugify(text);
    const seen = slugs.get(slug);
    slugs.set(slug, (seen ?? -1) + 1);
    tokens[i].attrSet('id', (state.env.idPrefix ?? '') + (seen === undefined ? slug : `${slug}-${seen + 1}`));
    if (tokens[i].tag === 'h1') state.env.title ??= text;
  }
}

// Пустые строки-распорки между абзацами (<br>, &nbsp;, одинокий «\»,
// абзац из одного комментария %%…%%) дают в PDF пустое место — убираем.
// Блоки кода — отдельные токены, их это не касается.
const BLANK_HTML = /^(?:\s|&nbsp;|&#160;|<br\s*\/?>)*$/i;
function emptyParagraphs(state) {
  const tokens = state.tokens;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (t.type === 'html_block' && BLANK_HTML.test(t.content)) {
      tokens.splice(i, 1);
    } else if (t.type === 'paragraph_open' && tokens[i + 1].children.every(c =>
      c.type === 'hardbreak' || c.type === 'softbreak'
        || ((c.type === 'text' || c.type === 'text_special') && /^\\?$/.test(c.content.trim()))
        || (c.type === 'html_inline' && BLANK_HTML.test(c.content)))) {
      tokens.splice(i, 3);
    }
  }
}

// Нумерация формул, как в LaTeX: блочная формула с \label{ключ} получает
// номер (1), (2), … — или свой, если в ней есть \tag{45}, — а \eqref{ключ}
// в тексте или в $…$ становится ссылкой «(1)» на неё, \ref{ключ} — «1».
// Формулы без \label не нумеруются. Нумерация своя у каждого документа
// (в книге — у каждой главы); неизвестный ключ даёт «??».
const LABEL = /\\label\{([^}]+)\}/;
const TAG = /\\tag\*?\{([^}]+)\}/;
const REF = /\\(eq)?ref\{([^}]+)\}/g;
function equations(state) {
  const labels = new Map();
  let counter = 0;
  const all = state.tokens.flatMap(t => [t, ...(t.children ?? [])]);
  for (const t of all) {
    const display = t.type === 'math_block' || t.type === 'math_inline_block'
      || t.type === 'math_inline_bare_block' || (t.type === 'fence' && t.info.trim() === 'math');
    const m = display && LABEL.exec(t.content);
    if (!m) continue;
    const tag = TAG.exec(t.content);
    const number = tag ? tag[1] : String(++counter);
    t.content = t.content.replace(LABEL, tag ? '' : `\\tag{${number}}`);
    labels.set(m[1], number);
    (t.meta ??= {}).eqId = 'eq-' + m[1];
  }

  for (const block of state.tokens) {
    if (!block.children) continue;
    block.children = block.children.flatMap(t => {
      if (t.type === 'math_inline' && /^\s*\\(eq)?ref\{[^}]+\}\s*$/.test(t.content)) {
        return refTokens(state, t.content.trim(), labels);
      }
      return t.type === 'text' && t.content.includes('ref{') ? refTokens(state, t.content, labels) : [t];
    });
  }
}

// Текст со ссылками \eqref/\ref → текстовые токены и ссылки.
function refTokens(state, text, labels) {
  const out = [];
  const push = (type, tag, nesting, content) => {
    const t = new state.Token(type, tag, nesting);
    if (content !== undefined) t.content = content;
    out.push(t);
    return t;
  };
  let last = 0;
  for (const m of text.matchAll(REF)) {
    if (m.index > last) push('text', '', 0, text.slice(last, m.index));
    const number = labels.get(m[2]);
    const label = number === undefined ? '??' : number;
    const shown = m[1] ? `(${label})` : label;
    if (number === undefined) {
      push('text', '', 0, shown);
    } else {
      push('link_open', 'a', 1).attrSet('href', '#eq-' + m[2]);
      push('text', '', 0, shown);
      push('link_close', 'a', -1);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) push('text', '', 0, text.slice(last));
  return out;
}

// - [ ] задача / - [x] сделано
function taskLists(state) {
  const tokens = state.tokens;
  for (let i = 2; i < tokens.length; i++) {
    const first = tokens[i].children?.[0];
    if (tokens[i - 1].type !== 'paragraph_open' || tokens[i - 2].type !== 'list_item_open'
        || first?.type !== 'text') continue;
    const m = /^\[([ xX])\](?:[ \t]|$)/.exec(first.content);
    if (!m) continue;
    first.content = first.content.slice(m[0].length);
    const box = new state.Token('html_inline', '', 0);
    box.content = `<input type="checkbox" disabled${m[1] === ' ' ? '' : ' checked'}> `;
    tokens[i].children.unshift(box);
    tokens[i - 2].attrJoin('class', 'task-list-item');
  }
}
