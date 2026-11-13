import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';
import { jobQueue } from '@/lib/worker/queue';
import { jobRepo } from '@/lib/db/repository';
import { createZipArchive, ZipFileInput } from '@/lib/audio/zip-builder';
import { sanitizeFilename } from '@/lib/security/sanitizer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batchId');
    const jobIdsParam = searchParams.get('jobIds');

    let jobIds: string[] = [];
    if (batchId) {
      const batchJobs = jobQueue.listJobsByBatch(batchId);
      jobIds = batchJobs.map((j) => j.id);
    } else if (jobIdsParam) {
      jobIds = jobIdsParam.split(',').map((s) => s.trim()).filter(Boolean);
    }

    if (jobIds.length === 0) {
      return NextResponse.json({ error: 'Please specify batchId or jobIds' }, { status: 400 });
    }

    const completedFiles: ZipFileInput[] = [];

    for (const id of jobIds) {
      const job = jobQueue.getJob(id);
      if (job && job.status === 'completed' && job.outputPath && fs.existsSync(job.outputPath)) {
        const cleanTitle = sanitizeFilename(job.title.replace(/\.mp3$/i, ''), 'audio');
        completedFiles.push({
          name: `${cleanTitle}.mp3`,
          path: job.outputPath,
        });
      }
    }

    if (completedFiles.length === 0) {
      return NextResponse.json(
        { error: 'No completed MP3 files found for this batch yet' },
        { status: 404 }
      );
    }

    const storageDir = path.resolve(process.env.STORAGE_DIR || './storage');
    const tempZipName = `bulk_${batchId || 'audio'}_${Date.now()}.zip`;
    const tempZipPath = path.join(storageDir, 'temp', tempZipName);

    await createZipArchive(completedFiles, tempZipPath);

    const stat = fs.statSync(tempZipPath);
    const fileStream = fs.createReadStream(tempZipPath);

    const readable = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk) => controller.enqueue(chunk));
        fileStream.on('end', () => {
          controller.close();
          // Clean up temp zip file
          try {
            if (fs.existsSync(tempZipPath)) {
              fs.unlinkSync(tempZipPath);
            }
          } catch {}
        });
        fileStream.on('error', (err) => {
          controller.error(err);
          try {
            if (fs.existsSync(tempZipPath)) {
              fs.unlinkSync(tempZipPath);
            }
          } catch {}
        });
      },
      cancel() {
        fileStream.destroy();
        try {
          if (fs.existsSync(tempZipPath)) {
            fs.unlinkSync(tempZipPath);
          }
        } catch {}
      },
    });

    const downloadFilename = `Video2MP3_Bulk_${batchId || 'export'}.zip`;

    return new Response(readable, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${downloadFilename}"`,
        'Content-Length': String(stat.size),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to generate ZIP archive' }, { status: 500 });
  }
}
