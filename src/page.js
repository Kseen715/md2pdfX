// Подготовка страницы к печати. Выполняется в печатаемой странице, параметры
// pdf.js кладёт в window.md2pdfPage. Итог — в window.__ready: true, когда
// можно печатать, или текст ошибки.

// Свёрнутый <details> на бумаге не раскрыть — печатаем раскрытым.
document.querySelectorAll('details').forEach(d => { d.open = true; });

// Ошибка разбора у mermaid — не Error, а объект с полем str.
window.__ready = prepare()
  .catch(e => (e && (e.message || e.str)) || String(e));

async function prepare() {
  // mermaid pdf.js подключает, только если в документе есть диаграммы.
  if (window.mermaid) await drawDiagrams();
  await document.fonts.ready;
  window.keepTables(window.md2pdfPage.sheets.normal);
  return true;
}

async function drawDiagrams() {
  const { font, mermaid, sankeyColors, sheets } = window.md2pdfPage;
  const sources = [...document.querySelectorAll('pre.mermaid')]
    .map(e => e.textContent);

  // C4 раскладывает элементы в ряд шириной screen.availWidth, а экран у
  // печати разный: у Chrome 800×600, у Electron без дисплея — 1×1, и
  // диаграмма вытягивается в столбик. Экран — как у Chrome.
  Object.defineProperty(screen, 'availWidth', { get: () => 800 });

  // Шрифт темы — и для рисования, и для замеров: у диаграмм
  // последовательностей свои настройки шрифтов (по умолчанию Trebuchet), и
  // без них рамки заметок и участников считаются под другой шрифт и текст из
  // них вылезает.
  window.mermaid.initialize({
    ...mermaid,
    startOnLoad: false, fontFamily: font,
    flowchart: { useMaxWidth: true },
    sequence: {
      useMaxWidth: true,
      actorFontFamily: font, noteFontFamily: font, messageFontFamily: font,
    },
    sankey: { nodeColors: window.sankeyNodeColors(sources, sankeyColors) },
  });

  // mermaid меряет подписи при отрисовке: шрифт для них должен быть уже
  // загружен, иначе подписи не влезут в рамки.
  const text = sources.join(' ');
  await Promise.all(['400', '700'].map(weight =>
    document.fonts.load(`${weight} 16px ${font}`, text)));

  await window.mermaid.run();
  await window.fitDiagrams(sources, sheets);
}
