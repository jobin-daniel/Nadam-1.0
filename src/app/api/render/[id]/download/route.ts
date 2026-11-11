import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { libraryRepo } from '@/lib/db/repository';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = libraryRepo.getById(id);

  if (!item || !item.filePath || !fs.existsSync(item.filePath)) {
    return NextResponse.json({ error: 'Rendered file not found' }, { status: 404 });
  }

  const stat = fs.statSync(item.filePath);
  const fileStream = fs.createReadStream(item.filePath);

  const readable = new ReadableStream({
    start(controller) {
      fileStream.on('data', (chunk) => controller.enqueue(chunk));
      fileStream.on('end', () => controller.close());
      fileStream.on('error', (err) => controller.error(err));
    },
    cancel() {
      fileStream.destroy();
    },
  });

  const downloadFilename = `${item.title.replace(/[^\w\s.-]/g, '_')}.mp3`;

  return new Response(readable, {
    status: 200,
    headers: {
      'Content-Length': String(stat.size),
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(downloadFilename)}"`,
    },
  });
}
