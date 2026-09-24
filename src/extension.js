// Расширение VS Code: команды «Export to PDF» (с параметрами из настроек),
// «Export to PDF with Options…» (параметры спрашиваются перед экспортом) и их
// книжные варианты «Export as Book…» для .md-файлов и папок. Конвейер тот же,
// что у CLI; прогресс и результат — в строке состояния, всплывают только
// ошибки.
import fs from 'node:fs';
import path from 'node:path';
import * as vscode from 'vscode';
import { findBrowser } from './browser.js';
import { convert, pdfName } from './convert.js';
import { CHOICES, launchBrowser, THEMES } from './pdf.js';

const COMMANDS = {
  'md2pdfx.export': {},
  'md2pdfx.exportBook': { book: true },
  'md2pdfx.exportWithOptions': { ask: true },
  'md2pdfx.exportBookWithOptions': { book: true, ask: true },
};

const LABELS = {
  theme: Object.fromEntries(
    Object.entries(THEMES).map(([name, theme]) => [name, theme.label])),
  orientation: { portrait: 'Portrait', landscape: 'Landscape' },
  align: { justify: 'Justify', left: 'Left', center: 'Center', right: 'Right' },
  sections: { page: 'Each section on a new page', flow: 'Continuous' },
};

const TITLES = {
  theme: 'Theme',
  orientation: 'Orientation',
  align: 'Text alignment',
  sections: 'Sections',
};

// Этапы экспорта одного файла: parse, затем этапы printPdf.
const STEPS = ['parse', 'render', 'print'];

let log;

export function activate(context) {
  log = vscode.window.createOutputChannel('md2pdfX');
  context.subscriptions.push(log);
  for (const [id, flags] of Object.entries(COMMANDS)) {
    context.subscriptions.push(vscode.commands.registerCommand(id,
      (uri, selected) => exportCommand(uri, selected, flags)));
  }
}

export function deactivate() {}

// ask — спросить параметры перед экспортом (askOptions).
async function exportCommand(uri, selected, { book = false, ask = false }) {
  const files = await collectTargets(uri, selected);
  if (!files) return;
  const options = ask ? await askOptions(files[0]) : {};
  if (options) await exportFiles(files, { ...options, book });
}

// Из меню проводника приходят (кликнутый uri, все выделенные), из заголовка
// редактора — только uri, из палитры команд — ничего.
async function collectTargets(uri, selected) {
  const targets = selected?.length
    ? selected
    : [uri ?? vscode.window.activeTextEditor?.document.uri];
  const found = await Promise.all(targets.filter(Boolean).map(markdownFiles));
  const files = found.flat();
  if (files.length) return files;
  vscode.window.showWarningMessage('md2pdfX: no Markdown files to export.');
  return null;
}

// Шаги по очереди, текущее значение из настроек — первым и отмечено.
// Escape на любом шаге отменяет экспорт.
// → { theme, orientation, align, sections, watermark } | undefined
async function askOptions(file) {
  const config = settings(file);
  const names = Object.keys(CHOICES);
  const steps = names.length + 1;
  const options = {};
  for (const [i, name] of names.entries()) {
    const title = `md2pdfX: ${TITLES[name]} (${i + 1}/${steps})`;
    const picked = await pickChoice(name, config.get(name), title);
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

function pickChoice(name, current, title) {
  const items = CHOICES[name].map(value => ({
    label: LABELS[name][value], value,
    description: value === current ? 'current' : undefined,
  })).sort((a, b) => (b.value === current) - (a.value === current));
  return vscode.window.showQuickPick(items, { title, ignoreFocusOut: true });
}

// overrides — параметры поверх настроек (из askOptions); book — собрать
// книгу из файла и всех локальных .md по ссылкам из него.
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
        for (const [i, file] of files.entries()) {
          const onStep = stepReporter(progress, files, i);
          try {
            done.push(await exportFile(browser, file, overrides, onStep));
          } catch (e) {
            failed.push(file);
            log.appendLine(`${file.fsPath}: ${e.message}`);
          }
        }
      } catch (e) {
        // Сюда попадают только ошибки запуска Chrome: до файлов дело не
        // дошло.
        failed.push(...files);
        log.appendLine(e.message);
      } finally {
        await browser?.close().catch(() => {});
      }
    },
  );

  if (failed.length) return reportFailures(failed);
  const names = done.map(f => path.basename(f)).join(', ');
  vscode.window.setStatusBarMessage(`$(check) md2pdfX: ${names}`, 5000);
}

// → onStep(step) для i-го из files: полоса по всем этапам всех файлов.
function stepReporter(progress, files, i) {
  const name = path.basename(files[i].fsPath);
  const count = files.length > 1 ? ` ${i + 1}/${files.length}` : '';
  const total = files.length * STEPS.length;
  return step => {
    const done = i * STEPS.length + STEPS.indexOf(step);
    progress.report({
      message: `${bar(done, total)}${count} ${name}: ${step}`,
    });
  };
}

async function reportFailures(failed) {
  const names = failed.map(f => path.basename(f.fsPath)).join(', ');
  const choice = await vscode.window.showErrorMessage(
    `md2pdfX: failed to export ${names}.`, 'Show Log');
  if (choice) log.show(true);
}

// Window-прогресс в статус-баре — только спиннер и текст, настоящей полосы
// там нет, поэтому рисуем её символами.
function bar(done, total, width = 10) {
  const filled = Math.round((done / total) * width);
  return '▰'.repeat(filled) + '▱'.repeat(width - filled);
}

async function markdownFiles(uri) {
  if (uri.scheme !== 'file') return [];
  const isMarkdown = name => /\.md$/i.test(name);
  const stat = await vscode.workspace.fs.stat(uri);
  if (!(stat.type & vscode.FileType.Directory)) {
    return isMarkdown(uri.fsPath) ? [uri] : [];
  }

  const entries = await vscode.workspace.fs.readDirectory(uri);
  return entries
    .filter(([name, type]) =>
      type === vscode.FileType.File && isMarkdown(name))
    .map(([name]) => vscode.Uri.joinPath(uri, name));
}

async function startBrowser(file, progress) {
  const chromePath =
    settings(file).get('chromePath') || process.env.MD2PDF_CHROME;
  const options = await findBrowser(chromePath, {
    log: message => log.appendLine(message),
    onProgress: (bytes, total) => progress.report({
      message: `downloading Chrome ${Math.round((bytes / total) * 100)}%`,
    }),
  });
  return launchBrowser(options);
}

// → путь к PDF.
async function exportFile(browser, file, overrides, onStep) {
  const config = settings(file);
  const option = name => overrides[name] ?? config.get(name);
  const outDir = config.get('outputDirectory');
  const output = path.join(
    outDir ? resolvePath(file, outDir) : path.dirname(file.fsPath),
    pdfName(file.fsPath));
  const css = config.get('extraCss');
  const extraCss = css ? fs.readFileSync(resolvePath(file, css), 'utf8') : '';

  const { diagrams, errors } = await convert(browser, {
    src: documentText(file), input: file.fsPath, output, extraCss, onStep,
    book: overrides.book,
    theme: option('theme'), orientation: option('orientation'),
    align: option('align'), sections: option('sections'),
    watermark: option('watermark'),
  });
  log.appendLine(`${output}${diagrams ? ` (diagrams: ${diagrams})` : ''}`);
  if (errors.length) log.appendLine(`  page errors: ${errors.join('; ')}`);
  return output;
}

// Несохранённые правки тоже попадают в PDF.
function documentText(file) {
  const open = vscode.workspace.textDocuments
    .find(d => d.uri.toString() === file.toString());
  return open ? open.getText() : fs.readFileSync(file.fsPath, 'utf8');
}

function settings(file) {
  return vscode.workspace.getConfiguration('md2pdfx', file);
}

// Относительные пути в настройках — от папки рабочей области файла.
function resolvePath(file, p) {
  const folder = vscode.workspace.getWorkspaceFolder(file);
  return path.resolve(folder?.uri.fsPath ?? path.dirname(file.fsPath), p);
}
