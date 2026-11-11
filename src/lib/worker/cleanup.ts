import fs from 'node:fs';
import path from 'node:path';

export function cleanupTempFiles(maxAgeHours = 24): { deletedFiles: number; freedBytes: number } {
  const storageDir = path.resolve(process.env.STORAGE_DIR || './storage');
  const tempDir = path.join(storageDir, 'temp');

  if (!fs.existsSync(tempDir)) {
    return { deletedFiles: 0, freedBytes: 0 };
  }

  const now = Date.now();
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
  let deletedFiles = 0;
  let freedBytes = 0;

  try {
    const files = fs.readdirSync(tempDir);
    for (const file of files) {
      const fullPath = path.join(tempDir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (now - stat.mtimeMs > maxAgeMs) {
          freedBytes += stat.size;
          fs.unlinkSync(fullPath);
          deletedFiles++;
        }
      } catch {}
    }
  } catch {}

  return { deletedFiles, freedBytes };
}
