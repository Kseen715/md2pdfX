md2pdf
======

![social-preview](.github/social-preview.png)

Markdown → PDF: GitHub Flavored Markdown, синтаксис Obsidian, диаграммы
Mermaid, формулы LaTeX. A4, номера страниц «N / M» и заголовок документа в
нижнем колонтитуле.

Markdown разбирает markdown-it, формулы рисует KaTeX, а headless Chrome
рисует диаграммы mermaid.js и печатает PDF. Внешних программ (pandoc, LaTeX)
не нужно, поэтому приложение собирается в один исполняемый файл.

Что поддерживается
------------------

| Формат   | Возможности                                                                                         | Пример                                        |
| -------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| GitHub   | таблицы, задачи `- [ ]`, сноски, алерты `> [!NOTE]`, эмодзи `:rocket:`, автоссылки, `<details>`, подсветка кода, якоря заголовков как на GitHub | [github.md](examples/github.md)               |
| Obsidian | свойства (frontmatter), `[[ссылки]]`, `![[встраивание]]` заметок, разделов и картинок, callout'ы, `==подсветка==`, `#теги`, `%%комментарии%%` | [obsidian.md](examples/obsidian.md)           |
| Mermaid  | все типы диаграмм mermaid 12                                                                        | [mermaid.md](examples/mermaid.md)             |
| LaTeX    | `$…$`, `$$…$$`, блоки ` ```math `                                                                  | [math.md](examples/math.md)                   |
| Всё вместе | типичный технический документ                                                                    | [backend-guide.md](examples/backend-guide.md) |

Расширение VS Code
------------------

Команда **md2pdfX: Экспорт в PDF**: кнопка в заголовке редактора `.md`,
контекстное меню редактора и проводника (для папки — все `.md` в ней),
палитра команд. PDF кладётся рядом с исходником, несохранённые правки тоже
попадают в него. Ход сборки и результат видны в строке состояния, подробности
— в панели Output › md2pdfX.

Установка: скачать `.vsix` со страницы
[Releases](https://github.com/Kseen715/md2pdfX/releases), затем в VS Code
Extensions › «…» › Install from VSIX… или `code --install-extension md2pdfX-X.Y.Z.vsix`.

Настройки:

| Параметр                  | Что задаёт                                                        |
| ------------------------- | ----------------------------------------------------------------- |
| `md2pdfx.outputDirectory` | папка для PDF; пусто — рядом с файлом                             |
| `md2pdfx.extraCss`        | CSS поверх встроенных стилей                                      |
| `md2pdfx.chromePath`      | путь к Chrome; пусто — искать самому и при необходимости скачать  |

Относительные пути считаются от папки рабочей области.

Встраиваемые файлы ищутся как в Obsidian: по имени во всём хранилище. Корень
хранилища — ближайший каталог с `.obsidian`, иначе каталог документа.

Запуск из исходников
--------------------

Нужен Node.js 22+.

```bash
npm ci                                   # один раз
node src/cli.js doc.md                   # → doc.pdf рядом
node src/cli.js doc.md -o /tmp/out.pdf
node src/cli.js docs/ a.md -o out/       # несколько файлов, каталог docs/ целиком
npm run examples                         # примеры → examples/out/
npm link                                 # команда md2pdf в PATH
```

В VS Code: конфигурация «Расширение» в «Run and Debug» запускает окно с
расширением из исходников; задача сборки по умолчанию (`Ctrl+Shift+B`)
собирает PDF из открытого файла через CLI.

```bash
npm run package:ext                      # → dist/md2pdfx-<версия>.vsix
```

Опции: `--css extra.css` — свои стили поверх встроенных
([src/style.css](src/style.css)), `--chrome <путь>` — какой браузер использовать.

Один исполняемый файл
---------------------

Готовые файлы для Linux (x64, arm64), Windows (x64) и macOS (arm64) лежат в
[Releases](https://github.com/Kseen715/md2pdfX/releases): распаковать
`md2pdfX-<версия>-<платформа>-<arch>.tar.gz` (Windows — `.zip`) и запускать
`md2pdf doc.md`. Под Linux arm64 нужен
системный Chromium: Google Chrome под эту платформу не выпускается.

Собрать самому:

```bash
npm run build:exe                        # → dist/md2pdf (на Windows dist/md2pdf.exe)
./dist/md2pdf doc.md
```

Нужен Node.js 25.5+ (`node --build-sea`). Файл собирается под ту ОС и
архитектуру, на которой запущена сборка, и весит ~150 МБ: внутри лежит
Node.js. На macOS бинарник после сборки нужно подписать:
`codesign --sign - dist/md2pdf`.

Chrome не входит ни в бинарник, ни в расширение. Его поиск идёт по порядку: `--chrome` или
`MD2PDF_CHROME` → кэш puppeteer (`~/.cache/puppeteer`, `PUPPETEER_CACHE_DIR`)
→ Chrome, Chromium или Edge в системе. Если ничего не нашлось,
`chrome-headless-shell` скачивается в кэш puppeteer (один раз, ~100 МБ).

Сборки и релизы
---------------

- **Nightly** ([nightly.yml](.github/workflows/nightly.yml)): каждый коммит
  и PR проверяются сборкой примеров и упаковкой `.vsix`. Коммит в `main`
  публикует пре-релиз на GitHub с тегом `vYYYYMMDD.N` (N — номер сборки за
  день): `.vsix` и исполняемые файлы под все платформы. Версия внутри такого
  `.vsix` — из `package.json`.
- **Релиз** ([release.yml](.github/workflows/release.yml)): запускается
  вручную (Actions › release › Run workflow). Берёт версию из `package.json`
  и создаёт релиз `vX.Y.Z` с `.vsix` и исполняемыми файлами. Перед запуском поднять `version` в
  `package.json` и дописать `CHANGELOG.md`: если релиз с такой версией уже
  есть, workflow остановится.

Секреты не нужны: хватает встроенного токена GitHub. В VS Code Marketplace
расширение не публикуется.

Картинка для соцсетей — [.github/social-preview.png](.github/social-preview.png)
(исходник рядом, `.svg`); загружается в Settings › General › Social preview.

Оформление
----------

- Каждый раздел `##`, кроме первого, начинается с новой страницы. Линии `---`
  вокруг `##` скрываются, остальные видны. Разрыв в любом месте:
  `<div style="page-break-after: always;"></div>`.
- Одиночный перевод строки абзац не разрывает, как на GitHub. В Obsidian это
  соответствует включённой настройке «Strict line breaks».
- Свёрнутые `<details>` и callout'ы `[!note]-` печатаются раскрытыми.
- Эмодзи видны, только если в системе есть шрифт с ними (Noto Color Emoji,
  Segoe UI Emoji).

Разметка: о чём стоит помнить
-----------------------------

- Заголовок вида `1. Название` markdown читает как **пункт списка**, а не
  как заголовок: и в PDF, и на GitHub. Писать `## 1. Название`.
- Слишком длинные подписи в диаграммах Mermaid растягивают схему, после чего
  она ужимается под ширину страницы и становится нечитаемой. Длинные подписи
  разбивать через `<br/>`, лишних участников выносить в текст.
- Ссылка `[[Заметка]]` на заметку, которая не встроена в документ, в PDF
  остаётся просто подписью: вести ей некуда.

Устройство
----------

| Файл                                       | Что делает                                        |
| ------------------------------------------ | ------------------------------------------------- |
| [src/cli.js](src/cli.js)                   | CLI: разбор аргументов, обход файлов              |
| [src/extension.js](src/extension.js)       | расширение VS Code                                |
| [src/markdown.js](src/markdown.js)         | markdown-it, плагины GFM, KaTeX, mermaid, якоря   |
| [src/obsidian.js](src/obsidian.js)         | синтаксис Obsidian                                |
| [src/pdf.js](src/pdf.js)                   | HTML-страница и печать через Chrome              |
| [src/browser.js](src/browser.js)           | поиск или скачивание Chrome                       |
| [src/assets.js](src/assets.js)             | стили и скрипты: из node_modules или из бинарника |
| [scripts/build.js](scripts/build.js)       | бандлы расширения и исполняемого файла           |
