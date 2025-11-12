import { parentPort } from 'node:worker_threads';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

const port = parentPort;

if (!port) {
  throw new Error('[ChecksumWorker] parentPort not available');
}

port.on('message', async (message: { id: string; filePath: string }) => {
  const { id, filePath } = message;

  try {
    const fileStats = await stat(filePath);
    const totalBytes = fileStats.size || 0;
    const hash = createHash('sha256');
    let processedBytes = 0;

    const stream = createReadStream(filePath);

    stream.on('data', (chunk) => {
      hash.update(chunk);
      if (totalBytes > 0) {
        processedBytes += chunk.length;
        port.postMessage({
          id,
          type: 'progress',
          progress: processedBytes / totalBytes,
        });
      }
    });

    stream.on('end', () => {
      port.postMessage({
        id,
        type: 'done',
        checksum: hash.digest('hex'),
      });
    });

    stream.on('error', (error) => {
      port.postMessage({
        id,
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    });
  } catch (error) {
    port.postMessage({
      id,
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});


