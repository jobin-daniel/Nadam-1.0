import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { jobRepo, libraryRepo } from '@/lib/db/repository';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type, Accept, Origin, User-Agent',
  'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 1. Resolve file path
  let targetPath: string | undefined;

  const job = jobRepo.getById(id);
  if (job?.outputPath && fs.existsSync(job.outputPath)) {
    targetPath = job.outputPath;
  } else if (job?.originalPath && fs.existsSync(job.originalPath)) {
    targetPath = job.originalPath;
  } else {
    const libItem = libraryRepo.getById(id);
    if (libItem?.filePath && fs.existsSync(libItem.filePath)) {
      targetPath = libItem.filePath;
    }
  }

  if (!targetPath || !fs.existsSync(targetPath)) {
    return NextResponse.json(
      { error: 'Audio file not found' },
      { status: 404, headers: CORS_HEADERS }
    );
  }

  const stat = fs.statSync(targetPath);
  const fileSize = stat.size;
  const range = req.headers.get('range');

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize) {
      return new Response(null, {
        status: 416,
        headers: {
          ...CORS_HEADERS,
          'Content-Range': `bytes */${fileSize}`,
        },
      });
    }

    const chunkSize = end - start + 1;
    const fileStream = fs.createReadStream(targetPath, { start, end });

    // Stream chunk as Web ReadableStream
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

    return new Response(readable, {
      status: 206,
      headers: {
        ...CORS_HEADERS,
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunkSize),
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
      },
    });
  }

  const fileStream = fs.createReadStream(targetPath);
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

  return new Response(readable, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Length': String(fileSize),
      'Content-Type': 'audio/mpeg',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
