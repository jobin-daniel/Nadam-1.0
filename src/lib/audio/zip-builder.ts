import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export interface ZipFileInput {
  name: string;
  path: string;
}

/**
 * Creates a standard PKZip archive with uncompressed (STORE) entries.
 * For MP3 files, this avoids redundant CPU compression while producing
 * standard .zip files compatible with all operating systems.
 */
export async function createZipArchive(
  files: ZipFileInput[],
  outputZipPath: string
): Promise<string> {
  const dir = path.dirname(outputZipPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  // Track filenames to avoid duplicates inside zip
  const seenNames = new Set<string>();

  for (const file of files) {
    if (!fs.existsSync(file.path)) {
      continue;
    }

    let fileName = file.name || path.basename(file.path);
    if (!fileName.toLowerCase().endsWith('.mp3')) {
      fileName += '.mp3';
    }

    // Deduplicate
    let uniqueName = fileName;
    let counter = 1;
    while (seenNames.has(uniqueName)) {
      const ext = path.extname(fileName);
      const base = path.basename(fileName, ext);
      uniqueName = `${base} (${counter})${ext}`;
      counter++;
    }
    seenNames.add(uniqueName);

    const data = fs.readFileSync(file.path);
    const nameBuf = Buffer.from(uniqueName, 'utf8');
    const crc = (zlib as any).crc32(data);
    const size = data.length;

    // Local file header (30 bytes)
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0); // signature
    lfh.writeUInt16LE(20, 4);          // version needed
    lfh.writeUInt16LE(0, 6);           // flags
    lfh.writeUInt16LE(0, 8);           // compression = 0 (store)
    lfh.writeUInt16LE(0, 10);          // time
    lfh.writeUInt16LE(0, 12);          // date
    lfh.writeUInt32LE(crc, 14);        // crc32
    lfh.writeUInt32LE(size, 18);       // compressed size
    lfh.writeUInt32LE(size, 22);       // uncompressed size
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);          // extra length

    const localOffset = offset;
    offset += lfh.length + nameBuf.length + data.length;

    parts.push(lfh, nameBuf, data);

    // Central directory header (46 bytes)
    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0); // signature
    cdh.writeUInt16LE(20, 4);          // version made by
    cdh.writeUInt16LE(20, 6);          // version needed
    cdh.writeUInt16LE(0, 8);           // flags
    cdh.writeUInt16LE(0, 10);          // compression
    cdh.writeUInt16LE(0, 12);          // time
    cdh.writeUInt16LE(0, 14);          // date
    cdh.writeUInt32LE(crc, 16);        // crc32
    cdh.writeUInt32LE(size, 20);       // compressed size
    cdh.writeUInt32LE(size, 24);       // uncompressed size
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt16LE(0, 30);          // extra length
    cdh.writeUInt16LE(0, 32);          // comment length
    cdh.writeUInt16LE(0, 34);          // disk number start
    cdh.writeUInt16LE(0, 36);          // internal file attributes
    cdh.writeUInt32LE(0, 38);          // external file attributes
    cdh.writeUInt32LE(localOffset, 42);

    central.push(cdh, nameBuf);
  }

  const centralSize = central.reduce((acc, b) => acc + b.length, 0);
  const centralOffset = offset;

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(seenNames.size, 8);
  eocd.writeUInt16LE(seenNames.size, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  eocd.writeUInt16LE(0, 20);

  const fullZip = Buffer.concat([...parts, ...central, eocd]);
  fs.writeFileSync(outputZipPath, fullZip);

  return outputZipPath;
}
