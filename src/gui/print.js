// Печать через Chromium самого Electron: скрытое окно вместо вкладки
// puppeteer. Объект повторяет ту часть API puppeteer, что нужна printPdf
// (pdf.js), — конвейер печати у CLI, расширения и окна один.
import fs from 'node:fs';
import { BrowserWindow } from 'electron';

// Одно окно на все страницы: новое окно сразу после destroy() прежнего
// попадает в отмирающий процесс отрисовки и не грузит страницу (ERR_FAILED).
export function electronBrowser() {
  let win;
  return {
    async newPage() {
      // Скрытое окно по умолчанию притормаживает таймеры и кадры, а mermaid
      // рисует по ним. Окно вне экрана не нужен дисплей: обычное, даже
      // скрытое, без него (--ozone-platform=headless) роняет Electron.
      win ??= new BrowserWindow({
        show: false,
        webPreferences: { backgroundThrottling: false, offscreen: true },
      });
      return page(win);
    },
    async close() {
      win?.destroy();
      win = undefined;
    },
  };
}

function page(win) {
  const contents = win.webContents;
  const listeners = [];
  return {
    // Из событий страницы printPdf нужны только необработанные ошибки JS.
    on(event, handler) {
      if (event !== 'pageerror') return;
      const listener = ({ level, message }) => {
        if (level === 'error' && message.startsWith('Uncaught')) {
          handler(new Error(message));
        }
      };
      contents.on('console-message', listener);
      listeners.push(listener);
    },
    goto: url => win.loadURL(url),
    evaluate: fn => contents.executeJavaScript(`(${fn})()`, true),
    async pdf({ path, margin, outline, tagged, ...options }) {
      const margins = Object.fromEntries(Object.entries(margin)
        .map(([side, mm]) => [side, parseFloat(mm) / 25.4]));
      const data = await contents.printToPDF({
        ...options,
        margins,
        generateDocumentOutline: outline, generateTaggedPDF: tagged,
      });
      fs.writeFileSync(path, data);
    },
    async close() {
      for (const listener of listeners) {
        contents.off('console-message', listener);
      }
    },
  };
}
