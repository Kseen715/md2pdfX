// Диаграммы под лист. Выполняется в печатаемой странице после mermaid.run().
// Масштаб — во сколько раз CSS сжимает диаграмму, чтобы она влезла в ширину
// колонки и в высоту листа (max-height из style.css). Мельче MIN_SCALE текст
// не прочитать. Тогда, по порядку, пока не влезет: та же диаграмма на
// альбомном листе — это ближе к задуманному, чем поворот; перерисованная — с
// другим направлением, раскладкой dagre, обоими сразу — на книжном, потом на
// альбомном. Не помогло — режется на куски по листу, только поперёк: кусок
// всегда во всю ширину диаграммы, пусть и мельче MIN_SCALE.
const MIN_SCALE = 0.6;
const PX = 96 / 25.4;  // px в мм

// Типы, у которых есть направление и раскладка на выбор.
const LAYOUT = /^\s*(flowchart|graph|erDiagram|classDiagram|stateDiagram(-v2)?)\b/;

// sources — исходный текст каждой pre.mermaid: mermaid.run() его уже заменил.
// sheets — рабочая область листа в мм: normal — документа, wide — альбомного
// (null, если документ и так альбомный). Мерить колонку по самой странице
// нельзя: до печати её ширина — ширина окна, а не листа.
window.fitDiagrams = async (sources, sheets) => {
  const room = sheet => sheet && { width: sheet.width * PX, height: (sheet.height - 2) * PX };
  const normal = room(sheets.normal), wide = room(sheets.wide);
  const boxes = [...document.querySelectorAll('pre.mermaid')];
  for (const [i, box] of boxes.entries()) {
    if (scale(box, normal) >= MIN_SCALE) continue;
    if (wide && scale(box, wide) >= MIN_SCALE) {
      landscape(box);
      continue;
    }
    // Замеры каждого варианта: html, масштаб на книжном и альбомном листах и
    // только по ширине их колонок — для нарезки.
    const sizes = () => ({ html: box.innerHTML,
      normal: scale(box, normal), wide: wide ? scale(box, wide) : 0,
      across: fit(box, normal), wideAcross: wide ? fit(box, wide) : 0 });
    const turned = LAYOUT.test(sources[i]) && turn(sources[i]);
    const variants = turned ? [turned, dagre(sources[i]), dagre(turned)] : [];
    const drawn = [sizes()];
    for (const [k, source] of variants.entries()) {
      try {
        box.innerHTML = (await window.mermaid.render(`md2pdf-${i}-${k}`, source)).svg;
      } catch {
        continue;
      }
      drawn.push(sizes());
      if (drawn.at(-1).normal >= MIN_SCALE) break;
    }
    const top = key => drawn.reduce((a, b) => b[key] > a[key] ? b : a);
    const best = top('normal'), roomy = drawn.find(d => d.wide >= MIN_SCALE);
    if (best.normal >= MIN_SCALE) {
      box.innerHTML = best.html;
    } else if (roomy) {
      box.innerHTML = roomy.html;
      landscape(box);
    } else if (wide && best.across < MIN_SCALE) {
      box.innerHTML = top('wideAcross').html;
      landscape(box);
      split(box, wide);
    } else {
      box.innerHTML = best.html;
      split(box, normal);
    }
  }
  for (const box of boxes)
    if (!box.classList.contains('mermaid-split'))
      reserve(box, box.classList.contains('mermaid-wide') ? sheets.wide : sheets.normal);
};

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
// Резать можно по длинным линиям.
const ARROW = 25, LOOP = 60, FRAME = 12, SHADOW = 6;

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
