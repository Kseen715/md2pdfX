// Расширение VS Code: команды «Export to PDF» (с параметрами из настроек) и
// «Export to PDF with Options…» (параметры спрашиваются перед экспортом) для
// .md-файлов и папок. Конвейер тот же, что у CLI; прогресс и результат — в
// строке состояния, всплывают только ошибки.
import fs from 'node:fs';
import path from 'node:path';
import * as vscode from 'vscode';
import { renderMarkdown } from './markdown.js';
import { findBrowser } from './browser.js';
import { CHOICES, launchBrowser, printPdf, THEMES } from './pdf.js';

let log;

export function activate(context) {
  log = vscode.window.createOutputChannel('md2pdfX');
  context.subscriptions.push(
    log,
    vscode.commands.registerCommand('md2pdfx.export', (uri, selected) => exportCommand(uri, selected)),
    vscode.commands.registerCommand('md2pdfx.exportWithOptions', async (uri, selected) => {
      const files = await collectTargets(uri, selected);
      if (!files) return;
      const options = await askOptions(files[0]);
      if (options) await exportFiles(files, options);
    }),
  );
}

export function deactivate() {}

async function exportCommand(uri, selected) {
  const files = await collectTargets(uri, selected);
  if (files) await exportFiles(files, {});
}

// Из меню проводника приходят (кликнутый uri, все выделенные), из заголовка
// редактора — только uri, из палитры команд — ничего.
async function collectTargets(uri, selected) {
  const targets = selected?.length ? selected : [uri ?? vscode.window.activeTextEditor?.document.uri];
  const files = (await Promise.all(targets.filter(Boolean).map(markdownFiles))).flat();
  if (files.length) return files;
  vscode.window.showWarningMessage('md2pdfX: no Markdown files to export.');
  return null;
}

const LABELS = {
  theme: Object.fromEntries(Object.entries(THEMES).map(([k, t]) => [k, t.label])),
  orientation: { portrait: 'Portrait', landscape: 'Landscape' },
  align: { justify: 'Justify', left: 'Left', center: 'Center', right: 'Right' },
};
const TITLES = { theme: 'Theme', orientation: 'Orientation', align: 'Text alignment' };

// Шаги по очереди, текущее значение из настроек — первым и отмечено.
// Escape на любом шаге отменяет экспорт. → { theme, orientation, align, watermark } | undefined
async function askOptions(file) {
  const config = settings(file);
  const names = Object.keys(CHOICES);
  const steps = names.length + 1;
  const options = {};
  for (const [i, name] of names.entries()) {
    const current = config.get(name);
    const items = CHOICES[name].map(value => ({
      label: LABELS[name][value], value,
      description: value === current ? 'current' : undefined,
    })).sort((a, b) => (b.value === current) - (a.value === current));
    const picked = await vscode.window.showQuickPick(items, {
      title: `md2pdfX: ${TITLES[name]} (${i + 1}/${steps})`, ignoreFocusOut: true,
    });
    if (!picked) return undefined;
    options[name] = picked.value;
  }
  const watermark = await vscode.window.showInputBox({
    title: `md2pdfX: Watermark (${steps}/${steps})`,
    prompt: 'Text in the middle of the footer. Leave empty for none.',
    value: config.get('watermark'), ignoreFocusOut: true,
  });
  if (watermark === undefined) return undefined;
  return { ...options, watermark };
}

// overrides — параметры поверх настроек (из askOptions).
async function exportFiles(files, overrides) {
  const failed = [];
  const done = [];
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Window, title: 'md2pdfX' },
    async progress => {
      let browser;
      try {
        // Chrome запускается на одну команду: держать его в фоне между
        // экспортами — лишняя память ради секунды на запуск.
        browser = await startBrowser(files[0], progress);
        for (const file of files) {
          progress.report({ message: path.basename(file.fsPath) });
          try {
            done.push(await exportFile(browser, file, overrides));
          } catch (e) {
            failed.push(file);
            log.appendLine(`${file.fsPath}: ${e.message}`);
          }
        }
      } catch (e) {
        // Сюда попадают только ошибки запуска Chrome: до файлов дело не дошло.
        failed.push(...files);
        log.appendLine(e.message);
      } finally {
        await browser?.close().catch(() => {});
      }
    },
  );

  if (failed.length) {
    const choice = await vscode.window.showErrorMessage(
      `md2pdfX: failed to export ${failed.map(f => path.basename(f.fsPath)).join(', ')}.`,
      'Show Log',
    );
    if (choice) log.show(true);
  } else {
    const names = done.map(f => path.basename(f)).join(', ');
    vscode.window.setStatusBarMessage(`$(check) md2pdfX: ${names}`, 5000);
  }
}

async function markdownFiles(uri) {
  if (uri.scheme !== 'file') return [];
  const stat = await vscode.workspace.fs.stat(uri);
  if (stat.type & vscode.FileType.Directory) {
    const entries = await vscode.workspace.fs.readDirectory(uri);
    return entries
      .filter(([name, type]) => type === vscode.FileType.File && /\.md$/i.test(name))
      .map(([name]) => vscode.Uri.joinPath(uri, name));
  }
  return /\.md$/i.test(uri.fsPath) ? [uri] : [];
}

async function startBrowser(file, progress) {
  const chromePath = settings(file).get('chromePath') || process.env.MD2PDF_CHROME;
  const options = await findBrowser(chromePath, {
    log: message => log.appendLine(message),
    onProgress: (bytes, total) => progress.report({
      message: `downloading Chrome ${Math.round((bytes / total) * 100)}%`,
    }),
  });
  return launchBrowser(options);
}

async function exportFile(browser, file, overrides) {
  const config = settings(file);
  const option = name => overrides[name] ?? config.get(name);
  // Несохранённые правки тоже попадают в PDF.
  const open = vscode.workspace.textDocuments.find(d => d.uri.toString() === file.toString());
  const src = open ? open.getText() : fs.readFileSync(file.fsPath, 'utf8');
  const { html, title } = renderMarkdown(src, file.fsPath);

  const outDir = config.get('outputDirectory');
  const name = path.basename(file.fsPath).replace(/\.md$/i, '') + '.pdf';
  const output = outDir ? path.join(resolvePath(file, outDir), name) : file.fsPath.replace(/\.md$/i, '.pdf');
  fs.mkdirSync(path.dirname(output), { recursive: true });

  const css = config.get('extraCss');
  const extraCss = css ? fs.readFileSync(resolvePath(file, css), 'utf8') : '';

  const { diagrams, errors } = await printPdf(browser, {
    html, output, extraCss,
    theme: option('theme'), orientation: option('orientation'), align: option('align'),
    watermark: option('watermark'),
    title: title ?? path.basename(file.fsPath, '.md'),
  });
  log.appendLine(`${output}${diagrams ? ` (diagrams: ${diagrams})` : ''}`);
  if (errors.length) log.appendLine(`  page errors: ${errors.join('; ')}`);
  return output;
}

function settings(file) {
  return vscode.workspace.getConfiguration('md2pdfx', file);
}

// Относительные пути в настройках — от папки рабочей области файла.
function resolvePath(file, p) {
  const base = vscode.workspace.getWorkspaceFolder(file)?.uri.fsPath ?? path.dirname(file.fsPath);
  return path.resolve(base, p);
}
