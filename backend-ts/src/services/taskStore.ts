import { InMemoryTaskStore, FileStore } from '@artinet/sdk';
import fs from 'fs';
import path from 'path';

function resolveTaskStore() {
  const mode = String(process.env.A2A_TASK_STORE || 'inmemory').toLowerCase();
  if (mode === 'file' || mode === 'filestore' || mode === 'filesystem') {
    // Resolve directory robustly: if env is absolute, use it; otherwise resolve relative to project root
    const dirFromEnv = process.env.A2A_TASK_STORE_DIR || 'backend-ts/data';
    const baseDir = path.isAbsolute(dirFromEnv)
      ? dirFromEnv
      : path.resolve(process.cwd(), dirFromEnv);
    try {
      if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
      }
      // eslint-disable-next-line no-console
      console.log(`[a2a:taskstore] Using FileStore at: ${baseDir}`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[a2a:taskstore] Failed to ensure data directory', { baseDir, error: (e as any)?.message || String(e) });
    }
    return new FileStore(baseDir) as any;
  }
  // eslint-disable-next-line no-console
  console.log('[a2a:taskstore] Using InMemoryTaskStore');
  return new InMemoryTaskStore() as any;
}

// Shared TaskStore, configurable via env:
// A2A_TASK_STORE=inmemory|file
// A2A_TASK_STORE_DIR=<path> (only for file mode)
export const taskStore: any = resolveTaskStore();


