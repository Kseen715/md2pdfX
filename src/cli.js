#!/usr/bin/env node
// md2pdf: Markdown (GitHub, Obsidian, Mermaid, LaTeX) → PDF.
import { findBrowser } from './browser.js';
import { run } from './command.js';
import { launchBrowser } from './pdf.js';

run(process.argv.slice(2), async opts =>
  launchBrowser(await findBrowser(opts.chrome ?? process.env.MD2PDF_CHROME)));
