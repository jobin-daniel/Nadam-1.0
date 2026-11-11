import path from 'node:path';

export function sanitizeFilename(filename: string, fallback = 'audio.mp3'): string {
  if (!filename || typeof filename !== 'string') {
    return fallback;
  }

  // Remove directory traversals and path separators
  let clean = path.basename(filename);

  // Replace invalid characters: control chars, quotes, colons, slashes, backslashes, pipes, question marks, asterisks
  clean = clean.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');

  // Strip leading dots and spaces
  clean = clean.replace(/^[\s.]+/, '');

  // Collapse multiple spaces or underscores
  clean = clean.replace(/\s+/g, ' ').replace(/_+/g, '_');

  // Ensure reasonable length (max 100 characters before extension)
  const ext = path.extname(clean) || '.mp3';
  const nameWithoutExt = path.basename(clean, ext).slice(0, 100).trim();

  if (!nameWithoutExt) {
    return fallback;
  }

  return `${nameWithoutExt}${ext.toLowerCase()}`;
}

export function ensureStorageSubdirs(baseStorageDir: string) {
  const fs = require('node:fs');
  const dirs = [
    baseStorageDir,
    path.join(baseStorageDir, 'downloads'),
    path.join(baseStorageDir, 'uploads'),
    path.join(baseStorageDir, 'renders'),
    path.join(baseStorageDir, 'temp'),
    path.join(baseStorageDir, 'thumbnails'),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
