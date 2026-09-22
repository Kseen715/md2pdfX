// Markdown → HTML: GitHub Flavored Markdown, синтаксис Obsidian, формулы
// KaTeX (рисуются здесь же, в Node) и блоки mermaid (их рисует браузер).
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import mark from 'markdown-it-mark';
import { full as emoji } from 'markdown-it-emoji';
import katexPlugin from '@vscode/markdown-it-katex';
import katex from 'katex';
import hljs from 'highlight.js/lib/common';
import obsidian, { escapeHtml, localUrl, splitFrontmatter } from './obsidian.js';

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

// Диаграмма остаётся текстом в <pre class="mermaid">, mermaid.js заменит его на SVG.
const fence = md.renderer.rules.fence;
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const t = tokens[idx];
  if (t.info.trim().split(/\s+/)[0] === 'mermaid') {
    return `<pre class="mermaid">${escapeHtml(t.content)}</pre>\n`;
  }
  return fence(tokens, idx, options, env, self);
};

const image = md.renderer.rules.image;
md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const t = tokens[idx];
  t.attrSet('src', localUrl(t.attrGet('src'), env.baseDir));
  return image(tokens, idx, options, env, self);
};

// Возвращает HTML тела и заголовок документа: свойство title,
// иначе первый <h1>.
export function renderMarkdown(src, file) {
  const { body, title } = splitFrontmatter(src);
  const abs = path.resolve(file);
  const env = { baseDir: path.dirname(abs), embedStack: [abs], vault: new Map(), title };
  const html = md.render(body, env);
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
    tokens[i].attrSet('id', seen === undefined ? slug : `${slug}-${seen + 1}`);
    if (tokens[i].tag === 'h1') state.env.title ??= text;
  }
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
