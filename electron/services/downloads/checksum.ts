import { Worker } from 'node:worker_threads';
import { randomUUID } from 'node:crypto';

type ChecksumProgressHandler = (progress: number) => void;

interface ChecksumMessage {
  id: string;
  type: 'progress' | 'done' | 'error';
  progress?: number;
  checksum?: string;
  error?: string;
}

const workerUrl = new URL('./checksum-worker.js', import.meta.url);

export async function computeFileChecksum(
  filePath: string,
  onProgress?: ChecksumProgressHandler,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerUrl, { type: 'module' } as any);
    const messageId = randomUUID();
    let settled = false;

    const cleanUp = () => {
      worker.removeAllListeners('message');
      worker.removeAllListeners('error');
      worker.removeAllListeners('exit');
      worker.terminate().catch(() => {});
    };

    worker.on('message', (message: ChecksumMessage) => {
      if (message.id !== messageId || settled) {
        return;
      }

      if (message.type === 'progress' && typeof message.progress === 'number') {
        onProgress?.(message.progress);
        return;
      }

      if (message.type === 'done' && message.checksum) {
        settled = true;
        cleanUp();
        resolve(message.checksum);
        return;
      }

      if (message.type === 'error') {
        settled = true;
        cleanUp();
        reject(new Error(message.error || 'Checksum worker failed'));
      }
    });

    worker.once('error', (error) => {
      if (settled) return;
      settled = true;
      cleanUp();
      reject(error);
    });

    worker.once('exit', (code) => {
      if (settled) return;
      settled = true;
      cleanUp();
      if (code !== 0) {
        reject(new Error(`Checksum worker exited with code ${code}`));
      }
    });

    worker.postMessage({ id: messageId, filePath });
  });
}


