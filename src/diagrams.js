// Диаграммы под лист. Выполняется в печатаемой странице после mermaid.run().
// Масштаб — во сколько раз CSS сжимает диаграмму, чтобы она влезла в ширину
// колонки и в высоту листа (max-height из style.css). Мельче MIN_SCALE текст
// не прочитать. Тогда она перерисовывается — с другим направлением,
// раскладкой dagre, обоими сразу, перенесённая змейкой в обоих направлениях —
// и берётся, по порядку: вариант на книжном листе, если он не мельче той же
// диаграммы на альбомном (альбомный лист — всегда отдельный, и под
// небольшой схемой он почти пустой); та же диаграмма на альбомном листе;
// вариант на альбомном. Не помогло —
// режется на куски по листу, только поперёк: кусок всегда во всю ширину
// диаграммы, пусть и мельче MIN_SCALE.
const MIN_SCALE = 0.6;
// Диаграмма, которой чуть-чуть не хватает места до конца листа, может
// ужаться до SQUEEZE своего размера и остаться на нём — иначе она уходит на
// следующий лист вместе с заголовком, а этот остаётся почти пустым.
const SQUEEZE = 0.85;
const PX = 96 / 25.4;  // px в мм

// Типы, которые mermaid рисует в холсте фиксированного размера с большими
// пустыми полями: venn — в 800×450, как бы мало ни было кругов, C4 — с
// запасом сверху, у timeline ось тянется далеко за последний раздел. Холст
// обрезается по содержимому, и диаграмма крупнее.
const PADDED = /^\s*(venn(-beta)?|timeline|C4(Context|Container|Component|Dynamic|Deployment))\b/;

// Типы, у которых есть направление и раскладка на выбор.
const LAYOUT = /^\s*(flowchart|graph|erDiagram|classDiagram|stateDiagram(-v2)?)\b/;

// sources — исходный текст каждой pre.mermaid: mermaid.run() его уже заменил.
// sheets — рабочая область листа в мм: normal — документа, wide — альбомного
// (null, если документ и так альбомный). Мерить колонку по самой странице
// нельзя: до печати её ширина — ширина окна, а не листа.
window.fitDiagrams = async (sources, sheets) => {
  c4Text();
  const room = sheet => sheet && { width: sheet.width * PX, height: (sheet.height - 2) * PX };
  const normal = room(sheets.normal), wide = room(sheets.wide);
  for (const [i, box] of [...document.querySelectorAll('pre.mermaid')].entries()) {
    if (!PADDED.test(sources[i])) continue;
    if (/^\s*timeline/.test(sources[i])) axis(box);
    trim(box);
    // Размер текста зависит от масштаба, а масштаб — от холста, обрезанного
    // уже по тексту: два прохода сходятся с точностью до долей пункта.
    if (/^\s*venn/.test(sources[i]))
      for (let pass = 0; pass < 2; pass++) {
        vennText(box, normal);
        trim(box);
      }
  }
  const boxes = [...document.querySelectorAll('pre.mermaid')];
  for (const [i, box] of boxes.entries()) {
    if (scale(box, normal) >= MIN_SCALE) continue;
    // Замеры каждого варианта: html, масштаб на книжном и альбомном листах и
    // только по ширине их колонок — для нарезки.
    const sizes = () => ({ html: box.innerHTML,
      normal: scale(box, normal), wide: wide ? scale(box, wide) : 0,
      across: fit(box, normal), wideAcross: wide ? fit(box, wide) : 0 });
    const turned = LAYOUT.test(sources[i]) && turn(sources[i]);
    const wrap = wrapping(normal);
    const variants = turned
      ? [[turned], [dagre(sources[i])], [dagre(turned)], [sources[i], wrap], [turned, wrap]] : [];
    const drawn = [sizes()];
    // Книжный вариант должен быть не мельче исходной на альбомном.
    const enough = Math.max(MIN_SCALE, drawn[0].wide);
    for (const [k, [source, elk]] of variants.entries()) {
      window.md2pdfElk = elk;
      try {
        box.innerHTML = (await window.mermaid.render(`md2pdf-${i}-${k}`, source)).svg;
      } catch {
        continue;
      } finally {
        delete window.md2pdfElk;
      }
      drawn.push(sizes());
      if (drawn.at(-1).normal >= enough) break;
    }
    const top = (key, list = drawn) => list.reduce((a, b) => b[key] > a[key] ? b : a);
    const best = top('normal'), roomy = drawn.find(d => d.wide >= MIN_SCALE);
    // Для нарезки на книжных листах — варианты, что влезают в ширину колонки:
    // самый компактный по высоте бывает самым широким, и из-за него длинная
    // узкая диаграмма резалась на альбомные листы.
    const narrow = drawn.filter(d => d.across >= MIN_SCALE);
    if (best.normal >= enough) {
      box.innerHTML = best.html;
    } else if (drawn[0].wide >= MIN_SCALE) {
      box.innerHTML = drawn[0].html;
      landscape(box);
    } else if (best.normal >= MIN_SCALE) {
      box.innerHTML = best.html;
    } else if (roomy) {
      box.innerHTML = roomy.html;
      landscape(box);
    } else if (wide && !narrow.length) {
      box.innerHTML = top('wideAcross').html;
      landscape(box);
      split(box, wide);
    } else {
      box.innerHTML = (narrow.length ? top('normal', narrow) : best).html;
      split(box, normal);
    }
  }
  for (const box of boxes)
    if (!box.classList.contains('mermaid-split'))
      reserve(box, box.classList.contains('mermaid-wide') ? sheets.wide : sheets.normal);
  squeeze(sheets.normal);
};

// Раскладка по листам прикидкой: листов до печати нет, поэтому идём по
// блокам документа в колонке листа и считаем, где кончается лист. Разрывы —
// принудительные (break-before/after: page, альбомные листы), неразрывные
// блоки переходят на новый лист целиком, остальные рвутся где угодно.
// Ошибка прикидки безвредна: не влезшая диаграмма уходит на следующий лист,
// как и без неё, только чуть мельче.
function squeeze(sheet) {
  document.body.style.width = sheet.width + 'mm';
  const height = sheet.height * PX;
  let pageTop = null;
  for (const e of blocks()) {
    if (!e.getClientRects().length) continue;
    const style = getComputedStyle(e);
    const rect = e.getBoundingClientRect();
    const top = rect.top - parseFloat(style.marginTop);
    const wide = e.classList.contains('mermaid-wide');
    // Альбомный лист — свой, со своей раскладкой: следующий блок — с нового.
    if (wide || pageTop === null || style.breakBefore === 'page') pageTop = wide ? null : top;
    if (wide) continue;
    const overflow = rect.bottom - (pageTop + height);
    if (overflow > 0) {
      if (e.matches('pre.mermaid:not(.mermaid-split)') && shrink(e, overflow)) continue;
      const kept = style.breakInside === 'avoid' || e.matches('pre.mermaid');
      // Неразрывный уходит на новый лист вместе с заголовками и вступлением.
      const start = (intro(e).at(-1) ?? e).getBoundingClientRect().top;
      if (kept) pageTop = start > pageTop ? start : pageTop + height;
      else while (rect.bottom > pageTop + height) pageTop += height;
    }
    if (style.breakAfter === 'page') pageTop = null;
  }
  document.body.style.width = '';
}

// Уменьшить диаграмму на overflow px (и 2 мм запаса), если выйдет не мельче SQUEEZE.
function shrink(box, overflow) {
  const svg = box.querySelector('svg');
  const now = svg.getBoundingClientRect().height;
  const target = now - overflow - 2 * PX;
  if (target < now * SQUEEZE) return false;
  svg.style.maxHeight = target + 'px';
  return true;
}

// Блоки документа по порядку; главы книги — по их содержимому.
function blocks() {
  return [...document.body.children].flatMap(e =>
    e.matches('.chapter') ? [...e.children] : e.matches('script') ? [] : [e]);
}

// Ось timeline — до последнего раздела и чуть дальше, под наконечник.
function axis(box) {
  const svg = box.querySelector('svg');
  const line = [...svg.querySelectorAll('.lineWrapper line')]
    .find(l => l.getAttribute('y1') === l.getAttribute('y2'));
  if (!line) return;
  // Правый край разделов — в координатах самой линии: они в группах со сдвигом.
  const { x1: right } = bounds(svg, svg.querySelectorAll('rect, text'), line);
  if (right > +line.getAttribute('x1')) line.setAttribute('x2', right + 40);
}

// Холст SVG — по содержимому, с полем в 8 единиц. getBBox всего SVG не
// годится: пустые подписи (у venn — у каждого пересечения) стоят в (0, 0)
// и растягивают рамку до угла холста. Поэтому — объединение рамок видимых
// фигур и текстов, каждая в координатах SVG.
function trim(box) {
  const svg = box.querySelector('svg');
  if (!svg) return;
  // Координаты в процентах (заголовок venn — x="50%") считаются от холста:
  // после обрезки они съехали бы. Переводим их в абсолютные по старому холсту.
  const old = svg.viewBox.baseVal;
  for (const e of svg.querySelectorAll('[x$="%"], [y$="%"]')) {
    for (const [attr, start, size] of [['x', old.x, old.width], ['y', old.y, old.height]]) {
      const v = e.getAttribute(attr);
      if (v?.endsWith('%')) e.setAttribute(attr, start + parseFloat(v) / 100 * size);
    }
  }
  const { x0, y0, x1, y1 } = bounds(svg,
    svg.querySelectorAll('path, rect, circle, ellipse, line, polygon, polyline, text, image'), svg);
  if (!(x1 > x0 && y1 > y0)) return;
  svg.setAttribute('viewBox', `${x0 - 8} ${y0 - 8} ${x1 - x0 + 16} ${y1 - y0 + 16}`);
  svg.style.maxWidth = '';
}

// Общая рамка видимых элементов в координатах элемента space (самого SVG
// или элемента внутри него). Пустые (без ширины и высоты) и служебные — из
// defs и маркеров — не в счёт; у горизонтальной линии высоты нет, но она видна.
function bounds(svg, elements, space) {
  const to = (space === svg ? svg.getScreenCTM() : space.getScreenCTM()).inverse();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const e of elements) {
    const b = e.getBBox();
    if ((!b.width && !b.height) || e.closest('defs, marker')) continue;
    const m = to.multiply(e.getScreenCTM());
    for (const [px, py] of [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]]) {
      const p = new DOMPoint(px, py).matrixTransform(m);
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
    }
  }
  return { x0, y0, x1, y1 };
}

// Подписи venn mermaid задаёт в долях холста, и в обрезанном холсте на всю
// ширину колонки они выходят крупнее заголовков и не влезают в круги. Здесь
// они — в 1.2 раза крупнее текста документа на листе, название — в 1.5.
function vennText(box, room) {
  const svg = box.querySelector('svg');
  const { width, height } = svg.viewBox.baseVal;
  const scale = Math.min(room.width / width, room.height / height);
  const text = parseFloat(getComputedStyle(document.body).fontSize) / scale;
  for (const e of svg.querySelectorAll('text'))
    e.style.setProperty('font-size', (e.matches('.venn-title') ? text * 1.5 : text * 1.2) + 'px', 'important');
}

// Цвета узлов sankey по имени: палитру mermaid задать не даёт, только цвет
// каждого узла. Цвета темы идут по кругу в порядке появления узлов — один
// узел одного цвета во всех диаграммах документа.
window.sankeyNodeColors = (sources, colors) => {
  const names = [];
  for (const source of sources) {
    if (!/^\s*sankey(-beta)?\s*$/m.test(source.split('\n').find(l => l.trim()) ?? '')) continue;
    for (const line of source.split('\n').slice(1)) {
      const cells = line.split(',').map(c => c.trim().replace(/^"(.*)"$/, '$1'));
      if (cells.length === 3) names.push(cells[0], cells[1]);
    }
  }
  return Object.fromEntries([...new Set(names)].map((name, i) => [name, colors[i % colors.length]]));
};

// Текст элементов C4 mermaid всегда красит белым, и на светлой заливке темы
// (src/themes/index.js) его не видно: там он — цвета текста документа.
function c4Text() {
  const dark = getComputedStyle(document.body).color;
  for (const shape of document.querySelectorAll('pre.mermaid .c4-shape')) {
    const fill = [...shape.querySelectorAll('.label-container, .label-container > *')]
      .find(e => e.style.fill)?.style.fill;
    const [r, g, b] = (fill?.match(/\d+(\.\d+)?/g) ?? []).map(Number);
    if (r === undefined || 0.2126 * r + 0.7152 * g + 0.0722 * b < 150) continue;
    for (const e of shape.querySelectorAll('.label, .label text'))
      e.style.setProperty(e.tagName === 'text' ? 'fill' : 'color', dark, 'important');
  }
}

// Вступление прямо над диаграммой и заголовки над ним, снизу вверх: их
// разрывы держат их на одном листе с диаграммой (style.css).
function intro(box) {
  const list = [];
  let e = box.previousElementSibling;
  if (e?.tagName === 'P') e = (list.push(e), e.previousElementSibling);
  while (e && /^(H[1-6]|HR)$/.test(e.tagName)) e = (list.push(e), e.previousElementSibling);
  return list;
}

// На альбомный лист — вместе с заголовками и вступлением, иначе они
// остаются одни на книжном листе.
function landscape(box) {
  for (const e of [box, ...intro(box)]) e.classList.add('mermaid-wide');
}

// Диаграмма ниже листа на высоту заголовков и вступления над ней (--intro,
// см. style.css), иначе в высоту листа она выталкивает их на предыдущий,
// а вступление рвётся пополам. Мерим в колонке листа: переносы строк
// зависят от ширины. Скрытый hr перед h2 не в счёт: у него нет положения, и
// его верх — 0, начало документа.
function reserve(box, sheet) {
  const first = intro(box).filter(e => e.getClientRects().length).at(-1);
  if (!first) return;
  document.body.style.width = sheet.width + 'mm';
  const top = first.getBoundingClientRect().top - parseFloat(getComputedStyle(first).marginTop);
  box.style.setProperty('--intro', box.getBoundingClientRect().top - top + 'px');
  document.body.style.width = '';
}

// Та же диаграмма с раскладкой dagre. По умолчанию mermaid 12 раскладывает
// ELK, а dagre иначе располагает ветви и бывает компактнее. Директива — в
// конце: в начале она сломала бы frontmatter, а mermaid ищет её везде.
function dagre(source) {
  return source + '\n%%{init: {"layout": "dagre"}}%%';
}

// Параметры ELK (assets.js вставляет их в корень графа), с которыми он
// переносит слишком длинный граф змейкой: ряды у LR, колонки у TB — и сам
// проводит все линии между ними. Пропорции — как у листа. На раскладку
// dagre не действуют.
function wrapping(room) {
  return { 'elk.layered.wrapping.strategy': 'MULTI_EDGE', 'elk.aspectRatio': String(room.width / room.height) };
}

function measure(box) {
  const svg = box.querySelector('svg');
  const { x, y, width, height } = svg.viewBox.baseVal;
  return { svg, x, y, width, height };
}

// room — место под диаграмму, px. У диаграмм без viewBox (размер задан в
// процентах) width и height — 0, и масштаб выходит 1: их не трогаем.
function scale(box, room) {
  const { height } = measure(box);
  return Math.min(fit(box, room), room.height / height);
}

// Масштаб только по ширине колонки.
function fit(box, room) {
  return Math.min(1, room.width / measure(box).width);
}

// Та же диаграмма с другим направлением: сверху вниз ⇄ слева направо.
function turn(source) {
  const lines = source.split('\n');
  const head = lines.findIndex(l => LAYOUT.test(l));
  const other = dir => /LR|RL/.test(dir ?? 'TB') ? 'TB' : 'LR';
  const flow = /^(\s*(?:flowchart|graph))(?:\s+(TB|TD|BT|LR|RL))?/;
  if (flow.test(lines[head])) {
    lines[head] = lines[head].replace(flow, (_, kind, dir) => `${kind} ${other(dir)}`);
    return lines.join('\n');
  }
  // ponytail: первая строка direction считается общей для диаграммы; если
  // она внутри вложенного состояния, повернётся только оно.
  const dir = lines.findIndex(l => /^\s*direction\s+(TB|BT|LR|RL)\s*$/.test(l));
  if (dir < 0) lines.splice(head + 1, 0, 'direction LR');
  else lines[dir] = lines[dir].replace(/TB|BT|LR|RL/, other);
  return lines.join('\n');
}

// Куски по листу, сверху вниз. Каждый — копия SVG со своим окном viewBox,
// во всю ширину диаграммы. Масштаб — самый крупный при том же числе листов,
// но не шире колонки. Кусок ниже листа на RESERVE: первый делит лист с
// заголовком и вступлением над диаграммой.
const RESERVE = 30 * PX;

function split(box, room) {
  const { svg, x, y, width, height } = measure(box);
  const rows = room.height - RESERVE;
  const across = fit(box, room);
  const s = across < MIN_SCALE ? across
    : Math.min(across, Math.ceil(height * MIN_SCALE / rows) * rows / height);
  const step = rows / s;
  const { hard, short, groups } = obstacles(svg);
  // Сперва — между группами, потом внутри группы, потом по середине короткой
  // линии; не нашлось и так — режем как есть.
  const lines = short.map(([a, b]) => [a - ARROW, b + ARROW]);
  const tries = [[...hard, ...lines, ...groups], [...hard, ...lines]];
  const parts = [];
  for (let top = 0; top < height;) {
    const limit = Math.min(height, top + step);
    const bottom = tries.reduce((found, blocks) => found ?? cut(blocks, top, limit, step), null)
      ?? above(cut(hard, top, limit, step), hard, short, top + step / 2) ?? limit;
    const part = svg.cloneNode(true);
    part.setAttribute('viewBox', `${x} ${y + top} ${width} ${bottom - top}`);
    part.setAttribute('width', width * s);
    part.style.maxWidth = 'none';
    parts.push(part);
    top = bottom;
  }
  box.replaceChildren(...parts);
  box.classList.add('mermaid-split');
}

// Вертикальные границы [верх, низ] в координатах диаграммы (от её верхнего
// края), сквозь которые резать нельзя, — по строгости:
// - hard: узлы, подписи, концы линий с запасом ARROW — наконечник и заметный
//   отрезок линии к нему; у группы (subgraph) — шапка с подписью от верхней
//   рамки до первого узла внутри и низ от последнего узла до нижней рамки,
//   иначе на листе остаётся пустая рамка или одна подпись; верхняя рамка — с
//   запасом FRAME на наконечник стрелки, что в неё упирается, нижняя — только
//   на линию и тень (SHADOW), чтобы под ней на листе осталось начало стрелки;
// - short: короткие линии, без запаса — петли, сообщения sequence, стрелки
//   между соседними группами;
// - groups: группы целиком.
// Резать можно по длинным линиям. Сообщение sequence — подпись вместе с его
// линией и запасом MARK на кружок номера (autonumber) и наконечник: у
// горизонтальной линии высоты нет, а кружок — маркер, в её рамку не входит,
// и разрез проходил между подписью и стрелкой, прямо по кружку.
const ARROW = 25, LOOP = 60, FRAME = 12, SHADOW = 6, MARK = 12;

function obstacles(svg) {
  const frame = svg.getBoundingClientRect();
  const unit = svg.viewBox.baseVal.height / frame.height;
  const at = y => (y - frame.top) * unit;
  const span = e => {
    const r = e.getBoundingClientRect();
    return [at(r.top), at(r.bottom)];
  };
  const hard = [...svg.querySelectorAll('.node, .actor, .note, .edgeLabel, .cluster-label, text')].map(span);
  const short = [], groups = [];
  const nodes = [...svg.querySelectorAll('.node')].map(e => e.getBoundingClientRect());
  for (const group of svg.querySelectorAll('.cluster')) {
    const g = group.getBoundingClientRect();
    groups.push(span(group));
    const inside = nodes.filter(r => r.left >= g.left && r.right <= g.right && r.top >= g.top && r.bottom <= g.bottom);
    if (!inside.length) hard.push(span(group));
    else hard.push([at(g.top) - FRAME, at(Math.min(...inside.map(r => r.top)))],
      [at(Math.max(...inside.map(r => r.bottom))), at(g.bottom) + SHADOW]);
  }
  for (const line of svg.querySelectorAll('path, line')) {
    if (line.closest('marker, defs, .node, .cluster')) continue;
    const [a, b] = span(line);
    if (b - a < LOOP) {
      short.push([a, b]);
      continue;
    }
    const m = line.getScreenCTM(), length = line.getTotalLength();
    for (const p of [line.getPointAtLength(0), line.getPointAtLength(length)]) {
      const y = at(p.matrixTransform(m).y);
      hard.push([y - ARROW, y + ARROW]);
    }
  }
  const labels = [...svg.querySelectorAll('.messageText')].map(span);
  for (const line of svg.querySelectorAll('.messageLine0, .messageLine1')) {
    const [a, b] = span(line);
    const label = labels.filter(([, bottom]) => bottom <= a + 1 && a - bottom < LOOP)
      .reduce((best, l) => !best || l[1] > best[1] ? l : best, null);
    hard.push([(label?.[0] ?? a) - 1, b + MARK].map((v, i) => i ? v : Math.min(v, a - MARK)));
  }
  const valid = list => list.filter(([a, b]) => b > a);
  return { hard: valid(hard), short: valid(short), groups: valid(groups) };
}

// Граница куска: не ниже limit, по промежутку между препятствиями, в нижней
// половине куска; нет такой — null.
function cut(blocks, top, limit, step) {
  let at = limit;
  for (let hit; (hit = blocks.find(([a, b]) => a < at && at < b));) at = hit[0] - 1;
  return at > top + step / 2 ? at : null;
}

// Разрез at, пришедшийся на короткую линию или её наконечник (он за концом
// линии, FRAME), — поднять к её середине: начало линии остаётся на этом
// листе, видно, откуда она выходит, а конец с наконечником — на следующем.
// Но не выше ближайшего препятствия над ним и не выше половины куска (half).
function above(at, hard, short, half) {
  const line = at && short.find(([a, b]) => a < at && at < b + FRAME);
  if (!line) return at;
  const floor = Math.max(half, ...hard.map(([, b]) => b).filter(b => b <= at));
  return Math.max(Math.min(at, (line[0] + line[1]) / 2), floor);
}
