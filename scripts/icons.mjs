// Значки Windows из SVG: images/icon.svg → icon.ico,
// uninstall.svg → uninstall.ico.
// Рисует сам Electron, отдельная графическая библиотека не нужна:
//   npm run icons
// ICO из PNG-кадров 16…256 (такие Windows читает начиная с Vista).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow } from 'electron';

const images = fileURLToPath(new URL('../images/', import.meta.url));
const SIZES = [16, 24, 32, 48, 64, 128, 256];

app.disableHardwareAcceleration();
// Не top-level await: пока он ждёт, Electron не доходит до ready.
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false, webPreferences: { offscreen: true },
  });
  await win.loadURL('data:text/html,');

  for (const name of ['icon', 'uninstall']) {
    const svg = fs.readFileSync(path.join(images, `${name}.svg`), 'base64');
    const pngs = await rasterize(win, svg);
    fs.writeFileSync(path.join(images, `${name}.ico`), ico(pngs));
    console.log(`images/${name}.ico`);
  }
  app.exit(0);
});

// → PNG каждого размера из SIZES.
async function rasterize(win, svg) {
  const pngs = await win.webContents.executeJavaScript(`(async () => {
    const img = new Image();
    img.src = 'data:image/svg+xml;base64,${svg}';
    await img.decode();
    return ${JSON.stringify(SIZES)}.map(size => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      canvas.getContext('2d').drawImage(img, 0, 0, size, size);
      return canvas.toDataURL('image/png').split(',')[1];
    });
  })()`);
  return pngs.map(png => Buffer.from(png, 'base64'));
}

function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(1, 2);  // тип: значок
  head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach((png, i) => {
    const entry = 6 + 16 * i;
    head[entry] = head[entry + 1] = SIZES[i] % 256;  // 0 — это 256
    head.writeUInt16LE(1, entry + 4);   // плоскости
    head.writeUInt16LE(32, entry + 6);  // бит на пиксель
    head.writeUInt32LE(png.length, entry + 8);
    head.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([head, ...pngs]);
}
