// Таблица не рвётся так, чтобы на листе осталось меньше 4 строк текста её
// тела — как orphans/widows у абзаца: считаются строки текста, а не строки
// таблицы, так что хватает и одной строки таблицы в 4 строки текста.
// Выполняется в печатаемой странице; sheet — рабочая область листа, мм.
const LINES = 4;

window.keepTables = sheet => {
  // Переносы строк зависят от ширины: мерим в колонке листа, а не окна.
  document.body.style.width = sheet.width + 'mm';
  for (const table of document.querySelectorAll('table')) {
    const rows = [...table.querySelectorAll(':scope > tbody > tr')];
    const lines = rows.map(count);
    let sum = 0;
    for (const [i, row] of rows.entries())
      if ((sum += lines[i]) < LINES) row.style.breakAfter = 'avoid';
    sum = 0;
    for (let i = rows.length - 1; i >= 0; i--)
      if ((sum += lines[i]) < LINES) rows[i].style.breakBefore = 'avoid';
  }
  document.body.style.width = '';
};

// Строк текста в строке таблицы — по самой высокой ячейке.
function count(row) {
  return Math.max(1, ...[...row.cells].map(cell => {
    const s = getComputedStyle(cell);
    const text = cell.clientHeight - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom);
    return Math.round(text / parseFloat(s.lineHeight));
  }));
}
