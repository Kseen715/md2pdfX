// Темы оформления. Тема — это палитра, из которой выводятся CSS-переменные
// страницы, цвета диаграмм mermaid и колонтитула, плюс свой CSS в
// src/themes/<тема>.css: переопределения переменных из style.css и то, что
// переменными не описать. Новая тема — запись здесь, её .css и пункт
// md2pdfx.theme в package.json.

// Встроенные шрифты (src/fonts.js). Noto Sans для других письменностей и
// CJK подхватывают символы, которых нет в основном шрифте; эмодзи — последними.
const FALLBACK = [
  'Noto Sans Arabic Variable', 'Noto Sans Hebrew Variable', 'Noto Sans Devanagari Variable',
  'Noto Sans Bengali Variable', 'Noto Sans Tamil Variable', 'Noto Sans Thai Variable',
  'Noto Sans Georgian Variable', 'Noto Sans Armenian Variable', 'Noto Sans Ethiopic Variable',
  'Noto Sans SC', 'Noto Sans JP', 'Noto Sans KR', 'Noto Color Emoji',
].map(f => `"${f}"`).join(', ');
export const SANS = `"Noto Sans Variable", ${FALLBACK}, sans-serif`;
export const MONO = `"JetBrainsMono Nerd Font", ${FALLBACK}, monospace`;

// Палитра — CSS-переменные --text, --paper, --accent, --accent-text, --muted,
// --line, --surface, --shade, --highlight, --danger (camelCase → kebab-case):
//   text       — основной текст;
//   paper      — фон листа;
//   accent     — главный цвет: заголовки, шапка таблиц, рамки;
//   accentText — акцент, читаемый как текст: ссылки, маркеры, подзаголовки;
//   muted      — второстепенный текст, сетка графиков;
//   line       — линии и рамки таблиц;
//   surface    — светлая подложка: код, чётные строки, фон разделов;
//   shade      — средний тон заливки (завершённые задачи на Ганте);
//   highlight  — выделение ==текста==, заметки на диаграммах;
//   danger     — ошибки и критичное;
//   series     — цвета рядов графиков и секторов pie, по порядку.
// diagramFont — шрифт диаграмм; mermaid — переопределения выведенных цветов.

// Цвета ветвей mindmap и разделов timeline: [фон, текст] → cScaleN и
// cScaleLabelN.
function branches(colors) {
  return Object.fromEntries(colors.flatMap(([bg, text], i) =>
    [['cScale' + i, bg], ['cScaleLabel' + i, text]]));
}

// Поля margin — свои поля листа. Колонтитул Chrome рисует отдельно от
// страницы, стили ему только инлайном; footer.color по умолчанию — muted;
// number: false — без заголовка и номера страницы (тема ставит номер сама,
// через @page в CSS); watermarkTop — водяной знак в верхнем колонтитуле, а не
// в нижнем.
export const THEMES = {
  classic: {
    label: 'Classic',
    palette: {
      text: '#1a1a1a', paper: '#ffffff', accent: '#0b3c5d', accentText: '#14507a',
      muted: '#7a848d', line: '#ccd3da', surface: '#f7f8fa', shade: '#ccd3da',
      highlight: '#fff1a8', danger: '#b3261e',
      series: ['#6b8fb3', '#1f2d3a', '#c0853a', '#9fb8cf'],
    },
    diagramFont: SANS,
    footer: { font: SANS, page: '' },
  },
  gost: {
    label: 'ГОСТ Р 7.0.97-2025',
    // Чёрно-белая, как и сам документ.
    palette: {
      text: '#000000', paper: '#ffffff', accent: '#000000', accentText: '#000000',
      muted: '#808080', line: '#000000', surface: '#f0f0f0', shade: '#808080',
      highlight: '#ffffff', danger: '#000000',
      series: ['#808080', '#000000', '#d0d0d0', '#ffffff'],
    },
    diagramFont: SANS,
    // Без теней и градиентов. Подписи стрелок на сером — на белом подпись
    // разрывает линию и теряется.
    mermaid: {
      dropShadow: 'none', useGradient: false,
      edgeLabelBackground: '#e6e6e6', activeTaskBkgColor: '#d0d0d0',
    },
    // Не меньше 20 мм слева (30 — для документов долгого хранения), 10 справа,
    // 20 сверху и снизу.
    margin: { top: '20mm', bottom: '20mm', left: '30mm', right: '10mm' },
    footer: { font: SANS, color: '#000', page: '', number: false },
    watermarkTop: true,
  },
  vectorheart: {
    label: 'Neo-Vectorheart',
    // Лайм #c6ff00 на белом не читается, поэтому он только заливка под
    // чёрным текстом; для текста — тёмная версия #5c7a00.
    palette: {
      text: '#0a0a0a', paper: '#ffffff', accent: '#0a0a0a', accentText: '#5c7a00',
      muted: '#8a8a8a', line: '#0a0a0a', surface: '#f3f3f3', shade: '#d9d9d9',
      highlight: '#c6ff00', danger: '#c62828',
      series: ['#5c7a00', '#0a0a0a', '#c6ff00', '#8a8a8a'],
    },
    diagramFont: MONO,
    mermaid: {
      secondaryColor: '#c6ff00', edgeLabelBackground: '#c6ff00',
      actorBkg: '#0a0a0a', actorTextColor: '#ffffff',
      critBkgColor: '#ffd6d0',
      // Mindmap: без этого ветви выходят серыми оттенками белого, а подписи —
      // белыми (берутся из actorTextColor). Корень — git0 и gitBranchLabel0.
      // Подпись последней ветви — ещё и цвет оси timeline.
      git0: '#0a0a0a', gitBranchLabel0: '#c6ff00',
      ...branches([
        ['#0a0a0a', '#c6ff00'], ['#c6ff00', '#0a0a0a'], ['#2f6fc0', '#ffffff'],
        ['#d0661a', '#ffffff'], ['#7b4fc4', '#ffffff'], ['#138a8a', '#ffffff'],
        ['#c62828', '#ffffff'], ['#b7860b', '#0a0a0a'], ['#2e8540', '#ffffff'],
        ['#6b7680', '#ffffff'], ['#5c7a00', '#ffffff'], ['#0a0a0a', '#c6ff00'],
      ]),
    },
    footer: {
      font: MONO, color: '#0a0a0a',
      page: 'background:#0a0a0a;color:#c6ff00;padding:0.5mm 2mm;',
    },
  },
  nord: {
    label: 'Nord Light',
    // https://www.nordtheme.com: Polar Night — текст, Snow Storm — подложки,
    // Frost — акцент, Aurora — ряды графиков. nord10 как текст на белом
    // бледноват, для ссылок — он же темнее.
    palette: {
      text: '#2e3440', paper: '#ffffff', accent: '#5e81ac', accentText: '#43648c',
      muted: '#4c566a', line: '#d8dee9', surface: '#eceff4', shade: '#d8dee9',
      highlight: '#ebcb8b', danger: '#bf616a',
      series: ['#5e81ac', '#bf616a', '#a3be8c', '#d08770', '#b48ead', '#88c0d0'],
    },
    diagramFont: SANS,
    mermaid: {
      primaryColor: '#eceff4', primaryBorderColor: '#81a1c1', lineColor: '#4c566a',
      // Ветви mindmap, разделы timeline, ряды radar, venn и treemap — Aurora и
      // Frost. Подпись последней ветви — ещё и цвет оси timeline: она тёмная.
      ...branches([
        ['#5e81ac', '#ffffff'], ['#bf616a', '#ffffff'], ['#a3be8c', '#2e3440'],
        ['#d08770', '#ffffff'], ['#b48ead', '#ffffff'], ['#88c0d0', '#2e3440'],
        ['#ebcb8b', '#2e3440'], ['#8fbcbb', '#2e3440'], ['#81a1c1', '#ffffff'],
        ['#4c566a', '#ffffff'], ['#5e81ac', '#ffffff'], ['#d8dee9', '#2e3440'],
      ]),
    },
    footer: { font: SANS, page: 'background:#e5e9f0;color:#2e3440;border-radius:2mm;padding:0.5mm 2.5mm;' },
  },
  gruvbox: {
    label: 'Gruvbox Light',
    // https://github.com/morhetz/gruvbox, светлый вариант: кремовые подложки,
    // тёмные оттенки цветов — для текста, яркие — для заливок. Лист белый:
    // поля листа Chrome не закрашивает, и кремовый фон вышел бы рамкой.
    palette: {
      text: '#3c3836', paper: '#ffffff', accent: '#af3a03', accentText: '#076678',
      muted: '#7c6f64', line: '#d5c4a1', surface: '#fbf1c7', shade: '#d5c4a1',
      highlight: '#fabd2f', danger: '#9d0006',
      series: ['#458588', '#d65d0e', '#98971a', '#b16286', '#689d6a', '#d79921'],
    },
    diagramFont: MONO,
    mermaid: {
      primaryColor: '#ebdbb2', primaryBorderColor: '#7c6f64', lineColor: '#504945',
      // Ветви mindmap, разделы timeline, ряды radar, venn и treemap. Подпись
      // последней ветви — ещё и цвет оси timeline: она тёмная.
      ...branches([
        ['#458588', '#fbf1c7'], ['#d65d0e', '#fbf1c7'], ['#98971a', '#fbf1c7'],
        ['#b16286', '#fbf1c7'], ['#689d6a', '#fbf1c7'], ['#d79921', '#3c3836'],
        ['#cc241d', '#fbf1c7'], ['#7c6f64', '#fbf1c7'], ['#076678', '#fbf1c7'],
        ['#af3a03', '#fbf1c7'], ['#79740e', '#fbf1c7'], ['#ebdbb2', '#3c3836'],
      ]),
    },
    // Номер страницы — как в строке состояния vim.
    footer: { font: MONO, page: 'background:#d65d0e;color:#fbf1c7;font-weight:bold;padding:0.5mm 2mm;' },
  },
};

// Палитра темы как CSS-переменные для :root.
export function paletteCss(theme) {
  return Object.entries(THEMES[theme].palette)
    .filter(([, value]) => typeof value === 'string')
    .map(([key, value]) => `--${key.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}: ${value};`)
    .join(' ');
}

export function footerStyle(theme) {
  const { footer, palette } = THEMES[theme];
  return { color: palette.muted, ...footer };
}

// Настройки mermaid: тема base, цвета — из палитры. У base нет цветов для
// состояний задач Ганта, и активная выходит белой без рамки, а столбцы
// xychart красятся от primaryColor — белым по белому: всё это задано явно.
export function mermaidConfig(theme) {
  const { palette: p, diagramFont, mermaid } = THEMES[theme];
  return {
    theme: 'base',
    themeVariables: {
      fontFamily: diagramFont, titleColor: p.text,
      primaryColor: p.paper, primaryTextColor: p.text, primaryBorderColor: p.accent,
      secondaryColor: p.surface, tertiaryColor: p.surface, lineColor: p.text,
      edgeLabelBackground: p.surface, clusterBkg: p.surface, clusterBorder: p.line,
      noteBkgColor: p.highlight, noteBorderColor: p.accent, noteTextColor: p.text,
      actorBkg: p.paper, actorBorder: p.accent, actorTextColor: p.text,
      signalColor: p.text, signalTextColor: p.text,
      ...Object.fromEntries(p.series.map((color, i) => ['pie' + (i + 1), color])),
      pieStrokeColor: p.text, pieOuterStrokeColor: p.text,
      taskBkgColor: p.paper, taskBorderColor: p.accent,
      taskTextColor: p.text, taskTextDarkColor: p.text,
      taskTextLightColor: p.text, taskTextOutsideColor: p.text,
      activeTaskBkgColor: p.highlight, activeTaskBorderColor: p.accent,
      doneTaskBkgColor: p.shade, doneTaskBorderColor: p.accent,
      critBkgColor: p.danger, critBorderColor: p.danger,
      sectionBkgColor: p.surface, altSectionBkgColor: p.paper, sectionBkgColor2: p.surface,
      gridColor: p.muted, todayLineColor: p.accentText,
      xyChart: { plotColorPalette: p.series.join(', ') },
      // Круги venn — иначе все оттенки primaryColor и не различаются.
      ...Object.fromEntries(p.series.map((color, i) => ['venn' + (i + 1), color])),
      ...mermaid,
    },
  };
}
