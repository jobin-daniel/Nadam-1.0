import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { jobQueue } from '@/lib/worker/queue';
import { jobRepo } from '@/lib/db/repository';
import { validateUrl } from '@/lib/security/ssrf';
import { fetchUrlMetadata } from '@/lib/worker/downloader';
import { BulkJobInput, JobRecord } from '@/lib/types/job';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batchId');

    if (batchId) {
      const jobs = jobQueue.listJobsByBatch(batchId);
      return NextResponse.json({ batchId, jobs });
    }

    // Return all jobs that have a batchId
    const allJobs = jobQueue.listJobs();
    const batchJobs = allJobs.filter((j) => Boolean(j.batchId));
    return NextResponse.json({ jobs: batchJobs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: BulkJobInput = await req.json();
    const {
      urls,
      speedSettings = { speed: 1.0, preservePitch: true, pitchSemitones: 0 },
      audioEnhancements,
      bitrate = '320k',
      appendSpeedTag = true,
      album = 'Bulk Speed Converted',
      expandPlaylists = true,
    } = body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'Please provide a non-empty array of URLs' }, { status: 400 });
    }

    // Clean & deduplicate URLs
    const rawUrls = Array.from(
      new Set(
        urls
          .map((u) => (typeof u === 'string' ? u.trim() : ''))
          .filter((u) => u.length > 0)
      )
    );

    if (rawUrls.length === 0) {
      return NextResponse.json({ error: 'No valid URL strings found' }, { status: 400 });
    }

    const batchId = `batch_${crypto.randomUUID().slice(0, 10)}`;
    const invalidUrls: { url: string; error: string }[] = [];
    const targetUrls: string[] = [];

    // Validate each URL against SSRF protection
    for (const url of rawUrls) {
      const validation = await validateUrl(url);
      if (!validation.valid || !validation.sanitizedUrl) {
        invalidUrls.push({ url, error: validation.error || 'Blocked by security validation' });
        continue;
      }

      // Check if it's a playlist that should be expanded
      if (expandPlaylists && (url.includes('list=') || url.includes('/playlist'))) {
        try {
          const meta = await fetchUrlMetadata(validation.sanitizedUrl);
          if (meta.isPlaylist && meta.playlistItems && meta.playlistItems.length > 0) {
            for (const item of meta.playlistItems) {
              const itemVal = await validateUrl(item.url);
              if (itemVal.valid && itemVal.sanitizedUrl) {
                targetUrls.push(itemVal.sanitizedUrl);
              }
            }
            continue;
          }
        } catch {
          // If inspection fails, still attempt to enqueue the raw URL
        }
      }

      targetUrls.push(validation.sanitizedUrl);
    }

    if (targetUrls.length === 0) {
      return NextResponse.json(
        {
          error: 'No URLs passed validation',
          invalidUrls,
        },
        { status: 400 }
      );
    }

    const enqueuedJobs: JobRecord[] = [];

    for (const url of targetUrls) {
      const job = await jobQueue.enqueueDownloadJob({
        url,
        bitrate,
        batchId,
        speedSettings,
        audioEnhancements,
        skipInitialMetadata: true,
        appendSpeedTag,
        tags: {
          album,
        },
      });
      enqueuedJobs.push(job);
    }

    return NextResponse.json(
      {
        batchId,
        enqueuedCount: enqueuedJobs.length,
        jobs: enqueuedJobs,
        invalidUrls,
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to process bulk jobs' },
      { status: 500 }
    );
  }
}
