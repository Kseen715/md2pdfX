// Встроенные шрифты: PDF выглядит одинаково на любой машине и не зависит от
// того, что установлено в системе. Все шрифты — под SIL Open Font License 1.1.
//
//   текст    — Noto Sans и Noto Sans для других письменностей и CJK
//              (пакеты @fontsource, разбиты на подмножества по unicode-range);
//   моно     — JetBrainsMono Nerd Font (src/fonts/, из ryanoasis/nerd-fonts):
//              JetBrains Mono плюс значки Nerd Fonts;
//   эмодзи   — Noto Color Emoji в формате COLRv1 (src/fonts/, из
//              googlefonts/noto-emoji). Вариант из @fontsource сделан на
//              OpenType-SVG, а его Chrome не рисует.
//
// В fonts.css шрифты записаны как FONT_ORIGIN + имя файла, pdf.js заменяет
// FONT_ORIGIN на адрес своего локального сервера и отдаёт их из памяти:
// Chrome скачивает только подмножества, символы которых есть в документе,
// и в PDF попадают только они.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const FONT_ORIGIN = 'https://md2pdf.fonts/';

const FONTSOURCE = [
  '@fontsource-variable/noto-sans/wght.css',
  '@fontsource-variable/noto-sans/wght-italic.css',
  '@fontsource-variable/noto-sans-arabic/wght.css',
  '@fontsource-variable/noto-sans-hebrew/wght.css',
  '@fontsource-variable/noto-sans-devanagari/wght.css',
  '@fontsource-variable/noto-sans-bengali/wght.css',
  '@fontsource-variable/noto-sans-tamil/wght.css',
  '@fontsource-variable/noto-sans-thai/wght.css',
  '@fontsource-variable/noto-sans-georgian/wght.css',
  '@fontsource-variable/noto-sans-armenian/wght.css',
  '@fontsource-variable/noto-sans-ethiopic/wght.css',
  // У CJK нет переменных версий: только обычное и жирное начертания.
  '@fontsource/noto-sans-sc/400.css', '@fontsource/noto-sans-sc/700.css',
  '@fontsource/noto-sans-jp/400.css', '@fontsource/noto-sans-jp/700.css',
  '@fontsource/noto-sans-kr/400.css', '@fontsource/noto-sans-kr/700.css',
];

// [семейство, файл в src/fonts/, насыщенность, начертание]
const VENDORED = [
  ['JetBrainsMono Nerd Font', 'JetBrainsMonoNerdFont-Regular.woff2', 400, 'normal'],
  ['JetBrainsMono Nerd Font', 'JetBrainsMonoNerdFont-Bold.woff2', 700, 'normal'],
  ['JetBrainsMono Nerd Font', 'JetBrainsMonoNerdFont-Italic.woff2', 400, 'italic'],
  ['JetBrainsMono Nerd Font', 'JetBrainsMonoNerdFont-BoldItalic.woff2', 700, 'italic'],
  ['Noto Color Emoji', 'NotoColorEmoji-COLRv1.woff2', '100 900', 'normal'],
];

// → { css: правила @font-face, files: { имя файла: путь на диске } }.
// Работает только из исходников: в сборках результат лежит готовым.
export function collectFonts() {
  const require = createRequire(import.meta.url);
  const files = {};
  const css = FONTSOURCE.map(id => {
    const cssPath = require.resolve(id);
    return fs.readFileSync(cssPath, 'utf8').replace(/src:([^;]+);/g, (_, list) => {
      // Из вариантов woff2/woff Chrome хватает woff2.
      const file = /url\(\.\/files\/([^)]+\.woff2)\)\s*(format\([^)]+\))/.exec(list);
      files[file[1]] = path.join(path.dirname(cssPath), 'files', file[1]);
      return `src:url(${FONT_ORIGIN}${file[1]}) ${file[2]};`;
    });
  });
  const vendored = fileURLToPath(new URL('./fonts/', import.meta.url));
  for (const [family, file, weight, style] of VENDORED) {
    files[file] = path.join(vendored, file);
    css.push(`@font-face { font-family: '${family}'; font-weight: ${weight};
  font-style: ${style}; src: url(${FONT_ORIGIN}${file}) format('woff2'); }`);
  }
  return { css: css.join('\n'), files };
}
