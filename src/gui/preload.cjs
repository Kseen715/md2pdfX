// Мост окна к главному процессу. CommonJS: в песочнице preload иначе не
// грузится.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('md2pdf', {
  setup: () => ipcRenderer.invoke('setup'),
  pick: kind => ipcRenderer.invoke('pick', kind),
  expand: paths => ipcRenderer.invoke('expand', paths),
  exportFiles: job => ipcRenderer.invoke('export', job),
  reveal: file => ipcRenderer.invoke('reveal', file),
  open: file => ipcRenderer.invoke('open', file),
  // У File из перетаскивания пути нет: его знает только Electron.
  pathOf: file => webUtils.getPathForFile(file),
  onProgress: handler =>
    ipcRenderer.on('progress', (_, event) => handler(event)),
});
