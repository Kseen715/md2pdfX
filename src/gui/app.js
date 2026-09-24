// Интерфейс окна: очередь файлов и параметры. Всё, что трогает диск и
// печать, — в главном процессе (main.js) через window.md2pdf (preload.cjs).
const $ = id => document.getElementById(id);
const api = window.md2pdf;

const LABELS = {
  orientation: { portrait: 'Portrait', landscape: 'Landscape' },
  align: { justify: 'Justify', left: 'Left', center: 'Center', right: 'Right' },
  sections: { page: 'New page', flow: 'Continuous' },
};
const STATUS = { queued: 'Queued', parse: 'Parsing', render: 'Rendering', print: 'Printing', done: 'Done', error: 'Failed' };

const { version, choices, defaults, themes } = await api.setup();
$('version').textContent = `v${version}`;

// Параметры запоминаются между запусками; хранилище может быть недоступно.
const saved = (() => { try { return JSON.parse(localStorage.getItem('options')) ?? {}; } catch { return {}; } })();
const options = { ...defaults, watermark: '', book: false, outDir: '', ...saved };
for (const name of Object.keys(choices)) {
  if (!choices[name].includes(options[name])) options[name] = defaults[name];
}
const save = () => { try { localStorage.setItem('options', JSON.stringify(options)); } catch {} };

// path → { status, output?, error?, warning? }
const queue = new Map();
let busy = false;

// Параметры
function pressable(container, name, items) {
  const buttons = items.map(([value, content, className]) => {
    const b = document.createElement('button');
    b.className = className ?? '';
    b.dataset.value = value;
    b.append(...content);
    b.onclick = () => { options[name] = value; save(); sync(); };
    return b;
  });
  container.replaceChildren(...buttons);
  const sync = () => buttons.forEach(b => b.setAttribute('aria-pressed', b.dataset.value === options[name]));
  sync();
}

// Папка вывода обрезается слева (direction: rtl в CSS), а без меток LRM
// ведущий «/» уезжает в конец строки.
const ltr = s => `\u200e${s}\u200e`;

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

pressable($('theme'), 'theme', choices.theme.map(key => {
  const { label, palette: p } = themes[key];
  const sheet = el('div', 'sheet');
  sheet.style.background = p.paper;
  sheet.append(...[p.accent, p.accentText, ...p.series.slice(0, 4)].map(color => {
    const s = el('span');
    s.style.background = color;
    return s;
  }));
  return [key, [sheet, el('span', 'label', label)], 'theme'];
}));
for (const name of ['orientation', 'align', 'sections']) {
  pressable($(name), name, choices[name].map(v => [v, [LABELS[name][v]]]));
}

$('watermark').value = options.watermark;
$('watermark').oninput = e => { options.watermark = e.target.value; save(); };
$('book').checked = options.book;
$('book').onchange = e => { options.book = e.target.checked; save(); };

function showOutDir() {
  $('out-dir').textContent = options.outDir ? ltr(options.outDir) : 'Next to each source file';
  $('out-dir').title = options.outDir;
  $('reset-out').hidden = !options.outDir;
}
showOutDir();
$('pick-out').onclick = async () => {
  const [dir] = await api.pick('folder');
  if (dir) { options.outDir = dir; save(); showOutDir(); }
};
$('reset-out').onclick = () => { options.outDir = ''; save(); showOutDir(); };

// Очередь
async function add(paths) {
  for (const file of await api.expand(paths)) {
    if (!queue.has(file)) queue.set(file, { status: 'queued' });
  }
  render();
}

$('add-files').onclick = async () => add(await api.pick('files'));
$('add-folder').onclick = async () => add(await api.pick('folder'));
$('clear').onclick = () => { queue.clear(); render(); };

const drop = $('drop');
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragging'); });
drop.addEventListener('dragleave', e => { if (!drop.contains(e.relatedTarget)) drop.classList.remove('dragging'); });
drop.addEventListener('drop', e => {
  e.preventDefault();
  drop.classList.remove('dragging');
  if (!busy) add([...e.dataTransfer.files].map(api.pathOf).filter(Boolean));
});
// Файл, брошенный мимо очереди, иначе откроется в самом окне.
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => e.preventDefault());

function render() {
  $('empty').hidden = queue.size > 0;
  $('files').replaceChildren(...[...queue].map(([file, item]) => {
    const li = el('li', 'file');
    const info = el('div');
    const parts = file.split(/[\\/]/);
    info.append(el('div', 'name', parts.pop()), el('div', 'dir', parts.join('/')));
    info.lastChild.title = file;
    if (item.error) info.append(el('div', 'detail', item.error));
    else if (item.warning) info.append(el('div', 'detail warn', `Page errors: ${item.warning}`));

    const side = el('div', 'links');
    if (item.output) {
      const open = el('button', '', 'Open');
      open.onclick = () => api.open(item.output);
      const reveal = el('button', '', 'Show');
      reveal.onclick = () => api.reveal(item.output);
      side.append(open, reveal);
    }
    const status = el('span', 'status ' + ({ done: 'done', error: 'error', queued: '' }[item.status] ?? 'busy'), STATUS[item.status]);
    const remove = el('button', 'icon-btn', '×');
    remove.title = 'Remove';
    remove.setAttribute('aria-label', 'Remove');
    remove.disabled = busy;
    remove.onclick = () => { queue.delete(file); render(); };
    const right = el('div', 'links');
    right.append(status, remove);
    li.append(info, side, right);
    return li;
  }));

  const count = s => [...queue.values()].filter(i => i.status === s).length;
  const done = count('done');
  const failed = count('error');
  $('summary').textContent = !queue.size ? 'No files'
    : busy ? `Exporting ${done + failed + 1} of ${queue.size}…`
    : `${queue.size} file${queue.size > 1 ? 's' : ''}` + (done ? ` · ${done} done` : '') + (failed ? ` · ${failed} failed` : '');
  $('export').disabled = busy || !queue.size;
  $('clear').disabled = busy || !queue.size;
  for (const id of ['add-files', 'add-folder']) $(id).disabled = busy;
}

api.onProgress(({ file, step, ...extra }) => {
  queue.set(file, { status: step, ...extra });
  render();
});

$('export').onclick = async () => {
  busy = true;
  for (const item of queue.values()) Object.assign(item, { status: 'queued', output: '', error: '', warning: '' });
  render();
  try {
    const { outDir, ...rest } = options;
    await api.exportFiles({ files: [...queue.keys()], options: rest, outDir });
  } finally {
    busy = false;
    render();
  }
};

render();
