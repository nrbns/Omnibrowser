#!/usr/bin/env node

/**
 * Copies the pdf.js worker into public asset folders so it can be loaded
 * at runtime without inflating the main bundle.
 */

const { promises: fs } = require('fs');
const path = require('path');

async function copyWorker() {
  const workerSource = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs');
  const targets = [
    path.join(__dirname, '..', 'public', 'workers', 'pdf.worker.js'),
    path.join(__dirname, '..', 'tauri-migration', 'public', 'workers', 'pdf.worker.js'),
  ];

  await Promise.all(
    targets.map(async target => {
      const dir = path.dirname(target);
      await fs.mkdir(dir, { recursive: true });
      await fs.copyFile(workerSource, target);
      console.log(`[prepare-workers] Copied pdf worker to ${path.relative(process.cwd(), target)}`);
    })
  );
}

copyWorker().catch(err => {
  console.error('[prepare-workers] Failed to copy pdf worker', err);
  process.exit(1);
});
