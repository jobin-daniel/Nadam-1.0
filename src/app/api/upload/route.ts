import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { jobQueue } from '@/lib/worker/queue';
import { sanitizeFilename, ensureStorageSubdirs } from '@/lib/security/sanitizer';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const bitrate = (formData.get('bitrate') as any) || '320k';
    const title = (formData.get('title') as string) || '';
    const artist = (formData.get('artist') as string) || '';
    const album = (formData.get('album') as string) || '';

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const maxSizeBytes = parseInt(process.env.MAX_FILE_SIZE_MB || '500', 10) * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        { error: `File exceeds maximum allowed size of ${process.env.MAX_FILE_SIZE_MB || '500'}MB` },
        { status: 413 }
      );
    }

    const storageDir = path.resolve(process.env.STORAGE_DIR || './storage');
    ensureStorageSubdirs(storageDir);

    const safeName = sanitizeFilename(file.name, 'upload_media');
    const uploadId = crypto.randomUUID().slice(0, 10);
    const destPath = path.join(storageDir, 'uploads', `${uploadId}_${safeName}`);

    // Stream uploaded bytes to disk
    const arrayBuffer = await file.arrayBuffer();
    fs.writeFileSync(destPath, Buffer.from(arrayBuffer));

    const job = await jobQueue.enqueueUploadJob({
      originalFilePath: destPath,
      originalFileName: file.name,
      bitrate,
      tags: {
        title: title || file.name.replace(/\.[^/.]+$/, ''),
        artist: artist || 'Local File',
        album: album || 'Local Uploads',
      },
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'File upload failed' }, { status: 500 });
  }
}
