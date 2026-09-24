// Окно md2pdfX: очередь файлов, параметры печати, экспорт. Конвейер тот же,
// что у CLI; печатает Chromium самого Electron (print.js), так что ни
// puppeteer, ни отдельный Chrome окну не нужны.
//
// С аргументами это команда md2pdf (command.js) без окна. Без дисплея (сервер,
// CI) Linux-версии нужен --ozone-platform=headless: его передаёт обёртка
// md2pdf рядом с приложением; с ним же и без аргументов — справка, а не
// невидимое окно.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import pkg from '../../package.json' with { type: 'json' };
import { run } from '../command.js';
import { expandInput, renderMarkdown } from '../markdown.js';
import { CHOICES, DEFAULTS, printPdf, THEMES } from '../pdf.js';
import { electronBrowser } from './print.js';

const here = path.dirname(fileURLToPath(import.meta.url));

// Как у CLI: без сглаживания по сетке шрифты в PDF ровнее.
app.commandLine.appendSwitch('font-render-hinting', 'none');

// Аргументы после приложения (в разработке — после main.js); переключатели
// платформы и песочницы (их ставит установщик) — для Chromium, не для команды.
const args = process.argv.slice(process.defaultApp ? 2 : 1).filter(a => !/^--(ozone-platform|no-sandbox)\b/.test(a));
const headless = app.commandLine.getSwitchValue('ozone-platform') === 'headless';

let win;

if (args.length || headless) {
  app.dock?.hide();
  // Окну вне экрана GPU не нужен, а без дисплея его запуск сыплет ошибками EGL.
  app.disableHardwareAcceleration();
  app.whenReady()
    .then(() => run(args, electronBrowser))
    .then(() => app.exit(process.exitCode ?? 0));
} else {
  openWindow();
}

function openWindow() {
  // Electron (41–44) под GNOME на Wayland падает (SIGSEGV) на первом же окне.
  // Платформу Chromium выбирает до запуска скрипта (сам Electron подставляет
  // --ozone-platform=wayland), поэтому appendSwitch не поможет: перезапускаемся
  // под X11 через XWayland.
  if (process.platform === 'linux' && app.commandLine.getSwitchValue('ozone-platform') === 'wayland') {
    app.relaunch({ args: [...process.argv.slice(1), '--ozone-platform=x11'] });
    app.exit(0);
    return;
  }

  app.whenReady().then(() => {
    win = new BrowserWindow({
      width: 1000, height: 760, minWidth: 760, minHeight: 560,
      title: 'md2pdfX', autoHideMenuBar: true, show: false,
      icon: path.join(here, '../../images/icon.png'),
      webPreferences: { preload: path.join(here, 'preload.cjs') },
    });
    win.once('ready-to-show', () => win.show());
    win.loadFile(path.join(here, 'index.html'));
  });

  // Окно печати скрытое: закрыто главное — выходим.
  app.on('window-all-closed', () => app.quit());
}

ipcMain.handle('setup', () => ({
  version: pkg.version, choices: CHOICES, defaults: DEFAULTS,
  themes: Object.fromEntries(Object.entries(THEMES).map(([k, t]) => [k, { label: t.label, palette: t.palette }])),
}));

ipcMain.handle('pick', async (_, kind) => {
  const { filePaths } = await dialog.showOpenDialog(win, kind === 'files'
    ? { properties: ['openFile', 'multiSelections'], filters: [{ name: 'Markdown', extensions: ['md'] }] }
    : { properties: ['openDirectory', 'createDirectory'] });
  return filePaths;
});

// Пути из диалога или перетаскивания → файлы .md; чего нет — пропускаем.
ipcMain.handle('expand', (_, paths) => paths.flatMap(p => {
  try { return expandInput(p); } catch { return []; }
}));

ipcMain.handle('reveal', (_, file) => shell.showItemInFolder(file));
ipcMain.handle('open', (_, file) => shell.openPath(file));

// Файлы печатаются по очереди; ход — событиями 'progress' { file, step, output?, error? },
// step: parse | render | print | done | error.
ipcMain.handle('export', async ({ sender }, { files, options, outDir }) => {
  const report = (file, step, extra) => sender.send('progress', { file, step, ...extra });
  const browser = electronBrowser();
  for (const file of files) {
    try {
      report(file, 'parse');
      const { html, title } = renderMarkdown(fs.readFileSync(file, 'utf8'), file, { book: options.book });
      const pdf = path.basename(file).replace(/\.md$/i, '') + '.pdf';
      const output = path.join(outDir || path.dirname(file), pdf);
      fs.mkdirSync(path.dirname(output), { recursive: true });
      const { errors } = await printPdf(browser, {
        html, output,
        theme: options.theme, orientation: options.orientation, align: options.align,
        sections: options.sections, watermark: options.watermark,
        title: title ?? path.basename(file, '.md'), onStep: step => report(file, step),
      });
      report(file, 'done', { output, warning: errors.join('; ') });
    } catch (e) {
      report(file, 'error', { error: e.message });
    }
  }
  await browser.close();
});
