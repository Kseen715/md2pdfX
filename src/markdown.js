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
import { decodePath, escapeHtml, isExternal, localUrl } from './html.js';
import obsidian, {
  chapterHref, resolveFile, splitFrontmatter,
} from './obsidian.js';

// Блочные формулы плагина KaTeX.
const MATH_BLOCKS =
  ['math_block', 'math_inline_block', 'math_inline_bare_block'];

// Пустые строки-распорки между абзацами (<br>, &nbsp;, одинокий «\»,
// абзац из одного комментария %%…%%) дают в PDF пустое место — убираем.
// Блоки кода — отдельные токены, их это не касается.
const BLANK_HTML = /^(?:\s|&nbsp;|&#160;|<br\s*\/?>)*$/i;

// Нумерация формул, как в LaTeX: блочная формула с \label{ключ} получает
// номер (1), (2), … — или свой, если в ней есть \tag{45}, — а \eqref{ключ}
// в тексте или в $…$ становится ссылкой «(1)» на неё, \ref{ключ} — «1».
// Формулы без \label не нумеруются. Нумерация своя у каждого документа
// (в книге — у каждой главы); неизвестный ключ даёт «??».
const LABEL = /\\label\{([^}]+)\}/;
const TAG = /\\tag\*?\{([^}]+)\}/;
const REF = /\\(eq)?ref\{([^}]+)\}/g;
const ONLY_REF = /^\s*\\(eq)?ref\{[^}]+\}\s*$/;

const md = new MarkdownIt({ html: true, linkify: true, highlight })
  .use(footnote)
  .use(mark)
  .use(emoji)
  // Пакет CommonJS: default лежит то в самом модуле, то в .default.
  .use(katexPlugin.default ?? katexPlugin, {
    katex, enableFencedBlocks: true, throwOnError: false,
  })
  .use(obsidian, { slugify })
  // Порядок важен: правила ниже встают друг за другом.
  .use(headings)
  .use(paragraphs)
  .use(equationNumbers)
  .use(code)
  .use(localLinks);

// Якоря как на GitHub: иначе ссылки оглавления вида (#1-что-развёрнуто)
// не совпадут с id заголовков.
export function slugify(text) {
  return text.trim().toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '')
    .replace(/ /g, '-');
}

// Возвращает HTML тела и заголовок документа: свойство title,
// иначе первый <h1>. book — собрать книгу: к документу главами добавляются
// все локальные .md, на которые он ссылается (вики-ссылками или обычными),
// и так далее по цепочке; каждая глава начинается с новой страницы.
export function renderMarkdown(src, file, { book = false } = {}) {
  const { body, title } = splitFrontmatter(src);
  const abs = path.resolve(file);
  const env = { ...documentEnv(abs, new Map()), title };
  if (!book) return { html: md.render(body, env), title: env.title };

  const chapters = new Map([[abs, 'f0']]);
  let html = '';
  // Map обходится вместе с главами, добавленными по ходу рендера.
  for (const [chapter, id] of chapters) {
    const first = chapter === abs;
    const part = first
      ? { body, title }
      : splitFrontmatter(fs.readFileSync(chapter, 'utf8'));
    const chapterEnv = first ? env : documentEnv(chapter, env.vault);
    Object.assign(chapterEnv, { chapters, idPrefix: id + '-', docId: id });
    html += renderChapter(part, chapter, chapterEnv);
  }
  return { html, title: env.title };
}

// Вход из командной строки или окна → файлы .md: каталог — все .md в нём
// (без подкаталогов).
export function expandInput(p) {
  const stat = fs.statSync(p, { throwIfNoEntry: false });
  if (!stat) throw new Error(`Не найден: ${p}`);
  if (!stat.isDirectory()) return [p];
  return fs.readdirSync(p)
    .filter(f => /\.md$/i.test(f))
    .sort()
    .map(f => path.join(p, f));
}

function highlight(code, lang) {
  if (!lang || !hljs.getLanguage(lang)) return '';
  return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
}

function documentEnv(file, vault) {
  return { baseDir: path.dirname(file), embedStack: [file], vault };
}

function renderChapter({ body, title }, file, env) {
  const tokens = md.parse(body, env);
  // Как в Obsidian: без своего # заголовка глава называется по свойству
  // title или по имени файла — иначе её нет ни в тексте, ни в закладках.
  if (!tokens.some(t => t.type === 'heading_open' && t.tag === 'h1')) {
    const name = title ?? path.basename(file).replace(/\.md$/i, '');
    tokens.unshift(...md.parse('# ' + name, env));
  }

  const html = md.renderer.render(tokens, md.options, env);
  return `<section class="chapter" id="${env.docId}">\n${html}</section>\n`;
}

// Текст заголовка документа — в <span class="heading-text">: темы могут
// оформить сами строки, а не весь блок (плашка под текстом).
function headings(md) {
  const { rules } = md.renderer;
  md.core.ruler.push('heading_ids', headingIds);
  rules.heading_open = (tokens, idx, options, env, self) =>
    self.renderToken(tokens, idx, options)
    + (tokens[idx].tag === 'h1' ? '<span class="heading-text">' : '');
  rules.heading_close = (tokens, idx, options, env, self) =>
    (tokens[idx].tag === 'h1' ? '</span>' : '')
    + self.renderToken(tokens, idx, options);
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
    const id = seen === undefined ? slug : `${slug}-${seen + 1}`;
    tokens[i].attrSet('id', (state.env.idPrefix ?? '') + id);
    if (tokens[i].tag === 'h1') state.env.title ??= text;
  }
}

function paragraphs(md) {
  md.core.ruler.after('inline', 'task_lists', taskLists);
  md.core.ruler.after('inline', 'empty_paragraphs', emptyParagraphs);
}

// - [ ] задача / - [x] сделано
function taskLists(state) {
  const tokens = state.tokens;
  for (let i = 2; i < tokens.length; i++) {
    const first = tokens[i].children?.[0];
    const inItem = tokens[i - 1].type === 'paragraph_open'
      && tokens[i - 2].type === 'list_item_open';
    if (!inItem || first?.type !== 'text') continue;
    const m = /^\[([ xX])\](?:[ \t]|$)/.exec(first.content);
    if (!m) continue;

    first.content = first.content.slice(m[0].length);
    const box = new state.Token('html_inline', '', 0);
    const checked = m[1] === ' ' ? '' : ' checked';
    box.content = `<input type="checkbox" disabled${checked}> `;
    tokens[i].children.unshift(box);
    tokens[i - 2].attrJoin('class', 'task-list-item');
  }
}

function emptyParagraphs(state) {
  const tokens = state.tokens;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (t.type === 'html_block' && BLANK_HTML.test(t.content)) {
      tokens.splice(i, 1);
    } else if (t.type === 'paragraph_open'
      && tokens[i + 1].children.every(isBlank)) {
      tokens.splice(i, 3);
    }
  }
}

function isBlank(token) {
  switch (token.type) {
    case 'hardbreak':
    case 'softbreak':
      return true;
    case 'text':
    case 'text_special':
      return /^\\?$/.test(token.content.trim());
    case 'html_inline':
      return BLANK_HTML.test(token.content);
    default:
      return false;
  }
}

function equationNumbers(md) {
  // После text_join: иначе «\eqref{…}» разбит на несколько текстовых токенов.
  md.core.ruler.push('equations', equations);
  // Блочная формула с \label получает id — на него ведут ссылки \eqref.
  for (const rule of MATH_BLOCKS) {
    const render = md.renderer.rules[rule];
    md.renderer.rules[rule] = (tokens, idx, options, env, self) =>
      withEqId(render(tokens, idx, options, env, self), tokens[idx], env);
  }
}

function equations(state) {
  const labels = numberEquations(state.tokens);
  for (const block of state.tokens) {
    if (!block.children) continue;
    block.children = block.children.flatMap(t => {
      if (t.type === 'math_inline' && ONLY_REF.test(t.content)) {
        return refTokens(state, t.content.trim(), labels);
      }
      const hasRefs = t.type === 'text' && t.content.includes('ref{');
      return hasRefs ? refTokens(state, t.content, labels) : [t];
    });
  }
}

// → Map: ключ \label → номер формулы.
function numberEquations(tokens) {
  const labels = new Map();
  let counter = 0;
  for (const t of tokens.flatMap(t => [t, ...(t.children ?? [])])) {
    const m = isDisplayMath(t) && LABEL.exec(t.content);
    if (!m) continue;
    const tag = TAG.exec(t.content);
    const number = tag ? tag[1] : String(++counter);
    t.content = t.content.replace(LABEL, tag ? '' : `\\tag{${number}}`);
    labels.set(m[1], number);
    (t.meta ??= {}).eqId = 'eq-' + m[1];
  }
  return labels;
}

function isDisplayMath(token) {
  return MATH_BLOCKS.includes(token.type)
    || (token.type === 'fence' && token.info.trim() === 'math');
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

function withEqId(html, token, env) {
  const id = token.meta?.eqId;
  if (!id) return html;
  const fullId = escapeHtml((env.idPrefix ?? '') + id);
  return html.replace(/^<(\w+)/, `<$1 id="${fullId}"`);
}

function code(md) {
  const { rules } = md.renderer;

  // Диаграмма остаётся текстом в <pre class="mermaid">, mermaid.js заменит
  // его на SVG. У кода язык — в data-lang блока <pre>: темы подписывают им
  // блок.
  const fence = rules.fence;
  rules.fence = (tokens, idx, options, env, self) => {
    const t = tokens[idx];
    const lang = t.info.trim().split(/\s+/)[0];
    if (lang === 'mermaid') {
      return `<pre class="mermaid">${escapeHtml(t.content)}</pre>\n`;
    }
    let html = fence(tokens, idx, options, env, self);
    if (lang) {
      html = html.replace(/^<pre/, `<pre data-lang="${escapeHtml(lang)}"`);
    }
    return withEqId(html, t, env);
  };

  // Длинные идентификаторы (CH_INSPLAN_PLANS_AUDITORS) переносятся после
  // «_»: иначе колонка таблицы не сжимается уже самого длинного из них,
  // таблица выходит за поле листа, и Chrome обрезает её правую рамку.
  const codeInline = rules.code_inline;
  rules.code_inline = (...args) => {
    const html = codeInline(...args);
    const open = html.indexOf('>') + 1;
    return html.slice(0, open) + html.slice(open).replaceAll('_', '_<wbr>');
  };
}

function localLinks(md) {
  const { rules } = md.renderer;

  const image = rules.image;
  rules.image = (tokens, idx, options, env, self) => {
    const t = tokens[idx];
    t.attrSet('src', localUrl(t.attrGet('src'), env.baseDir));
    return image(tokens, idx, options, env, self);
  };

  const linkOpen = rules.link_open ?? ((tokens, idx, options, env, self) =>
    self.renderToken(tokens, idx, options));
  rules.link_open = (tokens, idx, options, env, self) => {
    const t = tokens[idx];
    const href = t.attrGet('href');
    if (href) t.attrSet('href', linkHref(href, env));
    return linkOpen(tokens, idx, options, env, self);
  };
}

// В книге id заголовков и ссылки на них получают префикс главы: иначе
// одинаковые заголовки разных файлов дадут одинаковые id. Ссылка на
// локальный .md ([текст](файл.md#якорь)) в книге ведёт на главу с этим
// файлом, вне книги — на сам файл: страница печатается из временного
// каталога, и относительная ссылка там никуда не ведёт. Путь ищется как в
// Obsidian: от документа, от корня хранилища, затем по имени во всём
// хранилище — Obsidian пишет только имя, если оно уникально.
function linkHref(href, env) {
  if (href.startsWith('#')) {
    return env.idPrefix ? '#' + env.idPrefix + href.slice(1) : href;
  }
  if (isExternal(href)) return href;

  const [target, anchor] = href.split('#', 2);
  const decoded = decodePath(target);
  const file = resolveFile(decoded, env) ?? path.resolve(env.baseDir, decoded);
  if (env.chapters && /\.md$/i.test(file) && fs.existsSync(file)) {
    return chapterHref(env, file, anchor);
  }
  return pathToFileURL(file).href + (anchor === undefined ? '' : '#' + anchor);
}
